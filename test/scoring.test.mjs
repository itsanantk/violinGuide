// Run: node test/scoring.test.mjs
//
// The scorer is what the whole app claims to do — tell you honestly whether you
// played the note. These lock in two behaviours that were wrong once already.

import { RunScorer } from '../js/audio/scheduler.js';
import { resolveNotes, parseNotation } from '../js/notation.js';
import { SONGS } from '../js/data/songs.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) passed++;
  else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const notes = resolveNotes(parseNotation('D4 q, E4 q, rest q, F#4 q, G4 q').notes);

function reading(midi, cents, name = 'x') {
  return { midi, cents, name };
}

console.log('\nbasic scoring');
{
  const s = new RunScorer(notes, { tolerance: 25 });
  s.observe(0, reading(62, 5)); s.close(0);   // in tune
  s.observe(1, reading(64, 40)); s.close(1);  // out of tune, right note
  s.observe(3, reading(60, 0)); s.close(3);   // wrong note
  s.close(4);                                  // never played

  const r = s.summary();
  check('rests are not scored', r.total === 4, `got ${r.total}`);
  check('in-tune note is a hit', r.hits === 1, `got ${r.hits}`);
  check('out-of-tune note is close', r.close === 1, `got ${r.close}`);
  check('wrong note is wrong', r.wrong === 1, `got ${r.wrong}`);
  check('unplayed note is missed', r.missed === 1, `got ${r.missed}`);
  check('accuracy counts only hits', Math.round(r.accuracy) === 25, `got ${r.accuracy}`);
}

console.log('\na note is judged on its best moment, not its last');
{
  // A bowed note drifts as the bow releases. Grading the final frame would
  // downgrade a note that was held perfectly in tune.
  const s = new RunScorer(notes, { tolerance: 25 });
  s.observe(0, reading(62, 3));   // nailed it
  s.observe(0, reading(62, 8));
  s.observe(0, reading(62, 35));  // wobbled on release
  s.close(0);

  check('release wobble does not downgrade a hit', s.results[0].status === 'hit',
    s.results[0].status);
  check('bestCents keeps the best reading', s.results[0].bestCents === 3,
    String(s.results[0].bestCents));

  const never = new RunScorer(notes, { tolerance: 25 });
  never.observe(1, reading(64, 45));
  never.observe(1, reading(64, 30));
  never.close(1);
  check('a note never in tune stays close', never.results[1].status === 'close',
    never.results[1].status);

  const late = new RunScorer(notes, { tolerance: 25 });
  late.observe(1, reading(64, 45));  // started badly
  late.observe(1, reading(64, 6));   // then found it
  late.close(1);
  check('finding the note late still counts', late.results[1].status === 'hit',
    late.results[1].status);
}

console.log('\nsection looping scores only the section');
{
  const ode = SONGS.find((s) => s.id === 'ode-to-joy');
  const all = resolveNotes(ode.notes);
  const section = all.filter((n) => n.section === 'Middle section');
  check('the section is a real subset', section.length > 0 && section.length < all.length,
    `${section.length} of ${all.length}`);

  const s = new RunScorer(all, { tolerance: 25 });
  for (const note of section) {
    s.observe(note.index, reading(note.midi, 2));
    s.close(note.index);
  }

  const whole = s.summary();
  const just = s.summary(section.map((n) => n.index));

  check('scoring the whole song looks bad', Math.round(whole.accuracy) < 50,
    `got ${Math.round(whole.accuracy)}%`);
  check('scoring the section is 100%', Math.round(just.accuracy) === 100,
    `got ${Math.round(just.accuracy)}%`);
  check('section total is the section size', just.total === section.length,
    `${just.total} vs ${section.length}`);
  check('no missed notes inside the section', just.missed === 0, `got ${just.missed}`);
}

console.log('\ntolerance is respected');
{
  for (const [tolerance, cents, expected] of [
    [25, 20, 'hit'], [25, 30, 'close'], [10, 20, 'close'], [50, 40, 'hit'],
  ]) {
    const s = new RunScorer(notes, { tolerance });
    s.observe(0, reading(62, cents));
    s.close(0);
    check(`${cents} cents at tolerance ${tolerance} is ${expected}`,
      s.results[0].status === expected, s.results[0].status);
  }

  const negative = new RunScorer(notes, { tolerance: 25 });
  negative.observe(0, reading(62, -10));
  negative.close(0);
  check('flat is judged the same as sharp', negative.results[0].status === 'hit',
    negative.results[0].status);
}

console.log('\nreset clears everything');
{
  const s = new RunScorer(notes, { tolerance: 25 });
  s.observe(0, reading(62, 2));
  s.close(0);
  s.reset(notes);
  check('statuses go back to pending', s.results[0].status === 'pending', s.results[0].status);
  check('bestCents clears', s.results[0].bestCents === null, String(s.results[0].bestCents));
  check('summary is empty after reset', s.summary().hits === 0);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
