// Note/frequency math and first-position fingering for violin.
// Pure functions, no DOM, no audio — safe to unit test in Node.

export const A4_MIDI = 69;
export const DEFAULT_A4 = 440;

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiToFreq(midi, a4 = DEFAULT_A4) {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function freqToMidiFloat(freq, a4 = DEFAULT_A4) {
  return A4_MIDI + 12 * Math.log2(freq / a4);
}

/** Signed cents from `ref` to `freq`. Positive means sharp. */
export function cents(freq, ref) {
  return 1200 * Math.log2(freq / ref);
}

export function noteName(midi, { flats = false } = {}) {
  const names = flats ? FLAT : SHARP;
  return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

/** "A4" / "F#5" / "Bb3" -> midi number. Returns null if unparseable. */
export function midiFromName(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + accidental;
}

/** Nearest equal-tempered note to a frequency, with how far off it is. */
export function nearestNote(freq, a4 = DEFAULT_A4) {
  const exact = freqToMidiFloat(freq, a4);
  const midi = Math.round(exact);
  return {
    midi,
    name: noteName(midi),
    cents: (exact - midi) * 100,
    targetFreq: midiToFreq(midi, a4),
  };
}

// --- The violin itself ---------------------------------------------------

/** Open strings, lowest to highest. `index` 0 is G, 3 is E. */
export const STRINGS = [
  { name: 'G', midi: 55, index: 0 },
  { name: 'D', midi: 62, index: 1 },
  { name: 'A', midi: 69, index: 2 },
  { name: 'E', midi: 76, index: 3 },
];

export const STRING_BY_NAME = Object.fromEntries(STRINGS.map((s) => [s.name, s]));

/**
 * First position covers open string through 4th finger, a perfect fifth up.
 * Keyed by semitones above the open string. `tone` is where the finger sits
 * relative to its neighbour — what beginners feel as "low 2" vs "high 2".
 */
const FINGERING_BY_SEMITONE = {
  0: { finger: 0, label: 'open', tone: 'open' },
  1: { finger: 1, label: 'low 1', tone: 'low' },
  2: { finger: 1, label: '1', tone: 'normal' },
  3: { finger: 2, label: 'low 2', tone: 'low' },
  4: { finger: 2, label: '2', tone: 'high' },
  5: { finger: 3, label: '3', tone: 'normal' },
  6: { finger: 3, label: 'high 3', tone: 'high' },
  7: { finger: 4, label: '4', tone: 'normal' },
};

export const FIRST_POSITION_SPAN = 7; // semitones from open string to 4th finger
export const LOWEST_MIDI = STRINGS[0].midi; // G3
export const HIGHEST_MIDI = STRINGS[3].midi + FIRST_POSITION_SPAN; // B5

/**
 * Where to put a note in first position.
 *
 * Picks the smallest reachable semitone offset, which is what a player
 * actually does: an open A beats a 4th finger on the D string. Returns null
 * for anything outside first position so callers can flag it instead of
 * silently drawing a wrong finger.
 */
export function fingeringFor(midi) {
  let best = null;
  for (const string of STRINGS) {
    const semitones = midi - string.midi;
    if (semitones < 0 || semitones > FIRST_POSITION_SPAN) continue;
    if (!best || semitones < best.semitones) best = { string, semitones };
  }
  if (!best) return null;
  const shape = FINGERING_BY_SEMITONE[best.semitones];
  return {
    string: best.string.name,
    stringIndex: best.string.index,
    stringMidi: best.string.midi,
    semitones: best.semitones,
    finger: shape.finger,
    label: shape.label,
    tone: shape.tone,
    midi,
    name: noteName(midi),
  };
}

/** Every alternative first-position spot for a note, lowest string first. */
export function allFingeringsFor(midi) {
  return STRINGS.flatMap((string) => {
    const semitones = midi - string.midi;
    if (semitones < 0 || semitones > FIRST_POSITION_SPAN) return [];
    const shape = FINGERING_BY_SEMITONE[semitones];
    return [{
      string: string.name,
      stringIndex: string.index,
      semitones,
      finger: shape.finger,
      label: shape.label,
      tone: shape.tone,
      midi,
      name: noteName(midi),
    }];
  });
}

/**
 * Fraction of the vibrating string length where a finger stops that note.
 * Physical, not linear — this is why the finger spacing tightens as you go up,
 * and the fingerboard drawings need it to look right.
 */
export function stopPosition(semitones) {
  return 1 - Math.pow(2, -semitones / 12);
}

// --- Scales --------------------------------------------------------------

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];
const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12];

/** Ascending scale as midi numbers, `octaves` long. */
export function scale(tonicMidi, quality = 'major', octaves = 1) {
  const steps = quality === 'minor' ? NATURAL_MINOR_STEPS : MAJOR_STEPS;
  const out = [];
  for (let o = 0; o < octaves; o++) {
    const from = o === 0 ? 0 : 1; // don't repeat the octave note
    for (let i = from; i < steps.length; i++) out.push(tonicMidi + o * 12 + steps[i]);
  }
  return out;
}
