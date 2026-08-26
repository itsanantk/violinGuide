// Run: node test/notation.test.mjs
import {
  parseNotation, formatNotation, resolveNotes, withTimings,
  transpose, suggestOctaveShift, isRest, durationName,
  withBowing, bowStrokes,
} from '../js/notation.js';
import { SONGS, totalBeats } from '../js/data/songs.js';
import { midiFromName } from '../js/theory.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) passed++;
  else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\nparsing');
{
  const { notes, errors } = parseNotation('D4 q, E4 q, F#4 h');
  check('reads three notes', notes.length === 3, `got ${notes.length}`);
  check('no errors', errors.length === 0, JSON.stringify(errors));
  check('durations resolve', notes.map((n) => n.beats).join() === '1,1,2');
  check('note names normalise', notes[2].note === 'F#4', notes[2].note);

  const dotted = parseNotation('D4 q., E4 e').notes;
  check('dotted quarter is 1.5', dotted[0].beats === 1.5, String(dotted[0].beats));
  check('eighth is 0.5', dotted[1].beats === 0.5, String(dotted[1].beats));

  const explicit = parseNotation('A4 2.25').notes;
  check('explicit beats work', explicit[0].beats === 2.25, String(explicit[0].beats));

  const newlines = parseNotation('D4 q\nE4 q\nF#4 q').notes;
  check('newlines separate too', newlines.length === 3, `got ${newlines.length}`);
}

console.log('\nrests');
{
  const { notes } = parseNotation('D4 q, rest q, E4 q, r h, F#4 q');
  check('rests parse', notes.length === 5, `got ${notes.length}`);
  check('"rest" is a rest', isRest(notes[1]));
  check('"r" is a rest too', isRest(notes[3]));
  check('rests keep duration', notes[3].beats === 2, String(notes[3].beats));
  check('rests have no pitch', notes[1].midi === undefined);
  check('notes are not rests', !isRest(notes[0]));
}

console.log('\nsections, bars, comments');
{
  const text = [
    '# Verse',
    'D4 q, E4 q, F#4 q, G4 q |',
    '// this line is a comment',
    'A4 w |',
    '# Chorus',
    'B4 h, A4 h |',
  ].join('\n');
  const { notes, errors, warnings } = parseNotation(text);
  check('comments ignored', errors.length === 0, JSON.stringify(errors));
  check('sections attach', notes[0].section === 'Verse', String(notes[0].section));
  check('second section attaches', notes.at(-1).section === 'Chorus', String(notes.at(-1).section));
  check('bar lines dropped from notes', notes.length === 7, `got ${notes.length}`);
  check('full bars raise no warning', warnings.length === 0, JSON.stringify(warnings));

  const short = parseNotation('D4 q, E4 q |\nF#4 w |');
  check('short bar warns', short.warnings.length === 1, JSON.stringify(short.warnings));
  check('warning names the bar', /2 beats/.test(short.warnings[0].message), short.warnings[0].message);
}

console.log('\nerrors are useful, not fatal');
{
  const { notes, errors } = parseNotation('D4 q, H9 q, E4 zzz, F#4 q');
  check('good notes survive', notes.length === 2, `got ${notes.length}`);
  check('two errors reported', errors.length === 2, JSON.stringify(errors));
  check('bad pitch explained', /not a note/.test(errors[0].message), errors[0].message);
  check('bad duration explained', /not a duration/.test(errors[1].message), errors[1].message);
  check('errors carry a line number', errors[0].line === 1, String(errors[0].line));

  check('empty input is fine', parseNotation('').notes.length === 0);
  check('null input is fine', parseNotation(null).notes.length === 0);
}

console.log('\nround trip');
{
  const original = '# Verse\nD4 q, E4 q, F#4 q, G4 q | A4 h, rest h';
  const first = parseNotation(original).notes;
  const text = formatNotation(first);
  const second = parseNotation(text).notes;

  check('same note count', first.length === second.length, `${first.length} vs ${second.length}`);
  check('same pitches',
    first.map((n) => n.note ?? 'rest').join() === second.map((n) => n.note ?? 'rest').join(),
    text);
  check('same durations',
    first.map((n) => n.beats).join() === second.map((n) => n.beats).join());
  check('sections survive', second.every((n) => n.section === 'Verse'));
  check('rests survive', second.filter(isRest).length === 1);

  check('durationName picks shorthand', durationName(1.5) === 'q.', durationName(1.5));
  check('durationName keeps odd values', durationName(2.25) === '2.25', durationName(2.25));
}

console.log('\nslurs');
{
  const { notes, errors, warnings } = parseNotation('(D4 q, E4 q), F#4 q, G4 q');
  check('slur parses cleanly', errors.length === 0 && warnings.length === 0,
    JSON.stringify([...errors, ...warnings]));
  check('all four notes kept', notes.length === 4, `got ${notes.length}`);
  check('first two are slurred together', notes[0].slur === notes[1].slur && notes[0].slur != null);
  check('third note is not slurred', notes[2].slur === undefined);

  const single = parseNotation('(D4 q), E4 q').notes;
  check('a one-note slur works', single[0].slur != null && single[1].slur === undefined);

  const across = parseNotation('(D4 q, E4 q | F#4 q, G4 q)').notes;
  check('slurs cross bar lines', across.length === 4 && across[0].slur === across[3].slur);

  const unclosed = parseNotation('(D4 q, E4 q');
  check('unclosed slur warns', unclosed.warnings.some((w) => /never closed/.test(w.message)),
    JSON.stringify(unclosed.warnings));
  check('unclosed slur keeps its notes', unclosed.notes.length === 2);

  const nested = parseNotation('(D4 q, (E4 q, F#4 q)');
  check('nested slur warns', nested.warnings.some((w) => /inside another/.test(w.message)),
    JSON.stringify(nested.warnings));

  const withRests = parseNotation('(D4 q, rest q, E4 q)').notes;
  check('a rest does not join the slur', withRests[1].slur === undefined);

  const spaced = parseNotation('( D4 q , E4 q )').notes;
  check('spaces around brackets are fine', spaced.length === 2 && spaced[0].slur === spaced[1].slur,
    JSON.stringify(spaced));
}

console.log('\nbowing follows the slurs');
{
  const plain = withBowing(parseNotation('D4 q, E4 q, F#4 q, G4 q').notes);
  check('separate notes alternate', plain.map((n) => n.bow).join() === 'down,up,down,up',
    plain.map((n) => n.bow).join());
  check('each is its own stroke', plain.map((n) => n.strokeIndex).join() === '0,1,2,3');

  const slurred = withBowing(parseNotation('(D4 q, E4 q), (F#4 q, G4 q)').notes);
  check('a slur is one stroke', slurred[0].strokeIndex === slurred[1].strokeIndex);
  check('slurred notes share a bow', slurred[0].bow === slurred[1].bow, slurred[0].bow);
  check('next slur reverses', slurred[2].bow !== slurred[0].bow, slurred[2].bow);
  check('only the first of a slur starts a stroke',
    slurred[0].strokeStart === true && slurred[1].strokeStart === false);
  check('two strokes total', new Set(slurred.map((n) => n.strokeIndex)).size === 2);

  const mixed = withBowing(parseNotation('(D4 q, E4 q), F#4 q').notes);
  check('mixed slur and single', mixed.map((n) => n.bow).join() === 'down,down,up',
    mixed.map((n) => n.bow).join());

  const rested = withBowing(parseNotation('D4 q, rest q, E4 q').notes);
  check('rests get no bow', rested[1].bow === null);
  check('bow retakes down after a rest', rested[2].bow === 'down', String(rested[2].bow));

  const strokes = bowStrokes(resolveNotes(parseNotation('(D4 q, E4 q), F#4 h').notes));
  check('strokes group correctly', strokes.length === 2, `got ${strokes.length}`);
  check('first stroke has two notes', strokes[0].notes.length === 2);
  check('second stroke has one', strokes[1].notes.length === 1);
  check('symbols present', resolveNotes(parseNotation('D4 q').notes)[0].bowSymbol === '⊓');
}

console.log('\nslurs round trip');
{
  const source = '(D4 q, E4 q), F#4 q, (G4 q, A4 q, B4 q), rest q';
  const first = parseNotation(source).notes;
  const text = formatNotation(first);
  const second = parseNotation(text).notes;

  check('note count survives', first.length === second.length, `${first.length} vs ${second.length}, "${text}"`);
  check('slur shape survives',
    JSON.stringify(first.map((n) => n.slur ?? null)) === JSON.stringify(second.map((n) => n.slur ?? null)),
    text);
  check('bowing survives',
    withBowing(first).map((n) => n.bow).join() === withBowing(second).map((n) => n.bow).join(), text);
}

console.log('\nresolving to fingering');
{
  const notes = resolveNotes(parseNotation('D4 q, F#4 q, rest q, B5 q, C6 q').notes);
  check('open D resolves', notes[0].fingering.string === 'D' && notes[0].fingering.finger === 0);
  check('F#4 is high 2 on D', notes[1].fingering.label === '2' && notes[1].fingering.tone === 'high');
  check('rests skip fingering', notes[2].rest === true && notes[2].fingering === undefined);
  check('B5 is in range', notes[3].outOfRange === false);
  check('C6 flagged out of range', notes[4].outOfRange === true);
  check('indices attached', notes.map((n) => n.index).join() === '0,1,2,3,4');
}

console.log('\ntimings');
{
  const timed = withTimings(parseNotation('D4 q, E4 h, F#4 q').notes, 120);
  check('starts at zero', timed[0].startTime === 0);
  check('quarter at 120bpm is 0.5s', Math.abs(timed[0].duration - 0.5) < 1e-9, String(timed[0].duration));
  check('second note follows', Math.abs(timed[1].startTime - 0.5) < 1e-9, String(timed[1].startTime));
  check('half note is 1s', Math.abs(timed[1].duration - 1) < 1e-9, String(timed[1].duration));
  check('beats accumulate', timed[2].startBeat === 3, String(timed[2].startBeat));
}

console.log('\ntransposing');
{
  const low = parseNotation('D3 q, F#3 q, A3 q').notes;
  check('D3 is below the violin', suggestOctaveShift(low) === 12, String(suggestOctaveShift(low)));

  const shifted = resolveNotes(transpose(low, 12));
  check('shifted up it fits', shifted.every((n) => !n.outOfRange));
  check('names update', shifted[0].note === 'D4', shifted[0].note);

  const fine = parseNotation('D4 q, A4 q').notes;
  check('already-playable needs no shift', suggestOctaveShift(fine) === 0);

  const withRest = transpose(parseNotation('D3 q, rest q').notes, 12);
  check('rests unaffected by transposing', isRest(withRest[1]) && withRest[1].beats === 1);
}

console.log('\nbuilt-in songs');
{
  for (const song of SONGS) {
    if (song.needsNotes) {
      check(`${song.title} is marked as needing notes`, song.notes.length === 0);
      check(`${song.title} still has a guide`, song.guide.length >= 3, `${song.guide.length} sections`);
      continue;
    }

    check(`${song.title} has notes`, song.notes.length > 0);

    const resolved = resolveNotes(song.notes);
    const bad = resolved.filter((n) => n.outOfRange);
    check(`${song.title} is entirely first position`, bad.length === 0,
      bad.map((n) => n.note).join());

    const beatsPerBar = song.timeSignature[0] * (4 / song.timeSignature[1]);
    const total = totalBeats(song);
    check(`${song.title} fills whole bars`, Math.abs(total % beatsPerBar) < 0.001,
      `${total} beats, ${beatsPerBar} per bar`);

    check(`${song.title} declares the strings it uses`,
      new Set(resolved.map((n) => n.fingering.string)).size <= song.strings.length);

    check(`${song.title} round-trips through the editor`,
      parseNotation(formatNotation(song.notes)).notes.length === song.notes.length);
  }
}

console.log('\nOde to Joy specifics');
{
  const song = SONGS.find((s) => s.id === 'ode-to-joy');
  const resolved = resolveNotes(song.notes);
  check('opens on F#4', resolved[0].note === 'F#4', resolved[0].note);
  check('ends on D4', resolved.at(-1).note === 'D4', resolved.at(-1).note);
  check('ends on a half note', resolved.at(-1).beats === 2, String(resolved.at(-1).beats));
  check('uses four sections', new Set(song.notes.map((n) => n.section)).size === 4);
  check('never leaves the D major scale',
    resolved.every((n) => [62, 64, 66, 67, 69, 57, 59, 71, 73, 74].includes(n.midi)),
    resolved.filter((n) => ![62, 64, 66, 67, 69, 57, 59, 71, 73, 74].includes(n.midi))
      .map((n) => n.note).join());
  check('lowest note is A3', Math.min(...resolved.map((n) => n.midi)) === midiFromName('A3'));
}

console.log('\nCanon in D specifics');
{
  const song = SONGS.find((s) => s.id === 'canon-in-d');
  const resolved = resolveNotes(song.notes);
  check('reaches the E string', resolved.some((n) => n.fingering.string === 'E'));
  check('uses the G string', resolved.some((n) => n.fingering.string === 'G'));
  check('top note is F#5', Math.max(...resolved.map((n) => n.midi)) === midiFromName('F#5'));
  check('two sections', new Set(song.notes.map((n) => n.section)).size === 2);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
