// Run: node test/midi.test.mjs
//
// Builds Standard MIDI Files in memory and reads them back, so the importer is
// tested against real bytes rather than a mock.

import { parseMidi, trackToNotes, describeTrack } from '../js/data/midi.js';
import { noteName } from '../js/theory.js';
import { withBowing, isRest } from '../js/notation.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) passed++;
  else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- a minimal SMF writer -------------------------------------------------

const TICKS = 480;
const varint = (n) => {
  const bytes = [n & 0x7f];
  let rest = n >> 7;
  while (rest > 0) { bytes.unshift((rest & 0x7f) | 0x80); rest >>= 7; }
  return bytes;
};
const chars = (s) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];

/** notes: [startTick, durationTicks, ...pitches] */
function buildTrack(name, notes, channel = 0) {
  const events = [0x00, 0xff, 0x03, name.length, ...chars(name)];
  const raw = [];
  for (const [start, duration, ...pitches] of notes) {
    for (const p of pitches) raw.push([start, 0x90 | channel, p, 90]);
    for (const p of pitches) raw.push([start + duration, 0x80 | channel, p, 0]);
  }
  raw.sort((a, b) => a[0] - b[0]);
  let clock = 0;
  for (const [at, status, pitch, velocity] of raw) {
    events.push(...varint(at - clock), status, pitch, velocity);
    clock = at;
  }
  events.push(0x00, 0xff, 0x2f, 0x00);
  return [...chars('MTrk'), ...u32(events.length), ...events];
}

function buildFile(tracks, { ticks = TICKS } = {}) {
  const bytes = [
    ...chars('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(ticks),
    ...tracks.flat(),
  ];
  return new Uint8Array(bytes).buffer;
}

function importNotes(noteList, options) {
  const midi = parseMidi(buildFile([buildTrack('Mel', noteList)]));
  return trackToNotes(midi.tracks[0], midi.ticksPerBeat, options);
}

const pitchedOnly = (notes) => notes.filter((n) => !isRest(n));
const names = (notes) => pitchedOnly(notes).map((n) => noteName(n.midi)).join(' ');
const strokeCount = (notes) =>
  new Set(withBowing(notes).filter((n) => !isRest(n)).map((n) => n.strokeIndex)).size;

console.log('\nfile parsing');
{
  const midi = parseMidi(buildFile([buildTrack('Mel', [[0, TICKS, 60]])]));
  check('reads the header', midi.ticksPerBeat === TICKS, String(midi.ticksPerBeat));
  check('defaults to 120 bpm', midi.tempo === 120, String(midi.tempo));
  check('finds the track', midi.tracks.length === 1, String(midi.tracks.length));
  check('reads the track name', midi.tracks[0].name === 'Mel', midi.tracks[0].name);

  let threw = null;
  try { parseMidi(new Uint8Array([1, 2, 3, 4]).buffer); } catch (e) { threw = e.message; }
  check('rejects non-MIDI with a readable message', /does not look like a MIDI file/.test(threw || ''), String(threw));
}

console.log('\nmultiple tracks stay separate');
{
  const midi = parseMidi(buildFile([
    buildTrack('Vocal', [[0, TICKS * 2, 74], [TICKS * 2, TICKS, 72]]),
    buildTrack('Bass', [[0, TICKS * 2, 38], [TICKS * 2, TICKS * 2, 40]], 1),
    buildTrack('Drums', Array.from({ length: 8 }, (_, i) => [i * TICKS / 2, TICKS / 4, 36]), 9),
  ]));
  check('all three tracks parsed', midi.tracks.length === 3, String(midi.tracks.length));

  const described = midi.tracks.map((t) => describeTrack(t, midi.ticksPerBeat));
  check('vocal range is reported', described[0].lowest === 72 && described[0].highest === 74,
    JSON.stringify(described[0]));
  check('bass reads as low', described[1].highest < 60, String(described[1].highest));
  check('drums show many notes in a narrow range',
    described[2].noteCount === 8 && described[2].lowest === described[2].highest,
    JSON.stringify(described[2]));

  const vocal = trackToNotes(midi.tracks[0], midi.ticksPerBeat);
  check('importing one track ignores the others', names(vocal) === 'D5 C5', names(vocal));
}

console.log('\nchords reduce to the top line');
{
  const notes = importNotes([
    [0, TICKS * 2, 50, 54, 57],
    [TICKS * 2, TICKS * 2, 52, 55, 59],
  ]);
  check('a chord becomes one note', pitchedOnly(notes).length === 2, String(pitchedOnly(notes).length));
  check('and it is the top note', names(notes) === 'A3 B3', names(notes));
}

console.log('\nlegato does NOT delete notes');
{
  // Regression: overlap was treated as a chord, so a descending legato line lost
  // every note that was lower than the one still sounding.
  const descending = importNotes([
    [0, TICKS * 1.25, 74], [TICKS, TICKS * 1.25, 72],
    [TICKS * 2, TICKS * 1.25, 71], [TICKS * 3, TICKS, 69],
  ]);
  check('descending legato keeps every note', pitchedOnly(descending).length === 4,
    `${pitchedOnly(descending).length}: ${names(descending)}`);
  check('descending pitches are right', names(descending) === 'D5 C5 B4 A4', names(descending));

  const ascending = importNotes([
    [0, TICKS * 1.25, 62], [TICKS, TICKS * 1.25, 64],
    [TICKS * 2, TICKS * 1.25, 66], [TICKS * 3, TICKS, 67],
  ]);
  check('ascending legato keeps every note', pitchedOnly(ascending).length === 4,
    `${pitchedOnly(ascending).length}: ${names(ascending)}`);
}

console.log('\nlegato becomes slurs');
{
  const legato = importNotes([
    [0, TICKS * 1.25, 74], [TICKS, TICKS * 1.25, 72],
    [TICKS * 2, TICKS * 1.25, 71], [TICKS * 3, TICKS, 69],
  ]);
  check('overlapping notes share a bow', strokeCount(legato) === 1, String(strokeCount(legato)));
  check('they all carry a slur', pitchedOnly(legato).every((n) => n.slur != null));

  const quantised = importNotes([
    [0, TICKS, 74], [TICKS, TICKS, 72], [TICKS * 2, TICKS, 71], [TICKS * 3, TICKS, 69],
  ]);
  check('butted-up notes get no slur', pitchedOnly(quantised).every((n) => n.slur == null));
  check('...so each is its own bow', strokeCount(quantised) === 4, String(strokeCount(quantised)));

  const withRest = importNotes([
    [0, TICKS * 1.25, 74], [TICKS, TICKS, 72],
    [TICKS * 3, TICKS * 1.25, 71], [TICKS * 4, TICKS, 69],
  ]);
  check('a rest is imported', withRest.some(isRest));
  check('a rest breaks the slur', strokeCount(withRest) === 2, String(strokeCount(withRest)));
}

console.log('\nlong legato runs are capped');
{
  const run = importNotes(Array.from({ length: 10 }, (_, i) => [i * TICKS / 2, TICKS * 0.75, 62 + i]));
  check('every note survives', pitchedOnly(run).length === 10, String(pitchedOnly(run).length));
  check('not slurred into one impossible bow', strokeCount(run) > 1, String(strokeCount(run)));
  const biggest = Math.max(...Object.values(
    pitchedOnly(run).reduce((acc, n) => {
      if (n.slur == null) return acc;
      acc[n.slur] = (acc[n.slur] || 0) + 1;
      return acc;
    }, {})));
  check('no bow carries more than 6 notes', biggest <= 6, String(biggest));
}

console.log('\nrests and timing');
{
  const gapped = importNotes([[0, TICKS, 74], [TICKS * 3, TICKS, 72]]);
  check('a gap becomes a rest', gapped.some(isRest));
  check('the rest is the right length', gapped.find(isRest).beats === 2,
    String(gapped.find(isRest).beats));
  check('durations convert to beats', pitchedOnly(gapped).every((n) => n.beats === 1));

  const half = importNotes([[0, TICKS * 2, 74]]);
  check('a two-beat note reads as 2', half[0].beats === 2, String(half[0].beats));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
