// The shorthand note format, used everywhere: built-in songs, the editor,
// recordings, and MIDI import all round-trip through this.
//
//   D4 q            a quarter note on D4
//   F#4 h           a half note
//   rest q          a quarter rest  (also: r q)
//   A4 1.5          an explicit duration in beats
//   |               bar line — checked against the time signature, then dropped
//   # Chorus        starts a new section
//   // note to self a comment
//
// Separate notes with commas or newlines, whichever reads better.

import { midiFromName, noteName, fingeringFor } from './theory.js';

export const DURATIONS = {
  w: 4,
  'h.': 3,
  h: 2,
  'q.': 1.5,
  q: 1,
  'e.': 0.75,
  e: 0.5,
  's.': 0.375,
  s: 0.25,
};

/** Longest name first so "h." matches before "h". */
const DURATION_NAMES = Object.keys(DURATIONS).sort((a, b) => b.length - a.length);

/** Closest shorthand for a duration in beats, for formatting back out. */
export function durationName(beats) {
  let best = null;
  let bestGap = Infinity;
  for (const name of DURATION_NAMES) {
    const gap = Math.abs(DURATIONS[name] - beats);
    if (gap < bestGap) {
      bestGap = gap;
      best = name;
    }
  }
  // Anything not close to a standard value keeps its number rather than lying.
  return bestGap < 0.001 ? best : String(Number(beats.toFixed(3)));
}

const REST_WORDS = new Set(['rest', 'r', '-']);

export function isRest(note) {
  return note.rest === true;
}

/**
 * Parse shorthand into notes.
 * Never throws — returns `{ notes, errors, warnings }` so the editor can show
 * what is wrong while keeping the notes it did understand.
 */
export function parseNotation(text, { timeSignature = [4, 4] } = {}) {
  const notes = [];
  const errors = [];
  const warnings = [];

  let section = null;
  let bar = 1;
  let beatsInBar = 0;
  let slurGroup = null;
  let nextSlurId = 0;
  const beatsPerBar = timeSignature[0] * (4 / timeSignature[1]);

  const lines = String(text || '').split('\n');

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line) return;

    if (line.startsWith('#')) {
      section = line.slice(1).trim() || null;
      return;
    }

    for (const token of tokenize(line)) {
      const piece = token.trim();
      if (!piece) continue;

      if (piece === '|') {
        if (beatsInBar > 0 && Math.abs(beatsInBar - beatsPerBar) > 0.001) {
          warnings.push({
            line: lineIndex + 1,
            message: `Bar ${bar} has ${round(beatsInBar)} beats, expected ${beatsPerBar}.`,
          });
        }
        if (beatsInBar > 0) bar++;
        beatsInBar = 0;
        continue;
      }

      // Slur brackets ride on the note tokens: "(D4 q" ... "F#4 q)".
      let body = piece;
      let opensSlur = false;
      let closesSlur = false;
      while (body.startsWith('(')) {
        opensSlur = true;
        body = body.slice(1).trim();
      }
      while (body.endsWith(')')) {
        closesSlur = true;
        body = body.slice(0, -1).trim();
      }
      if (opensSlur) {
        if (slurGroup !== null) {
          warnings.push({
            line: lineIndex + 1,
            message: 'A slur opened inside another slur; the earlier one was closed for you.',
          });
        }
        slurGroup = nextSlurId++;
      }

      // A bracket on its own line still opens or closes the slur.
      if (!body) {
        if (closesSlur) slurGroup = null;
        continue;
      }

      const parsed = parseToken(body, lineIndex + 1);
      if (parsed.error) {
        errors.push(parsed.error);
        if (closesSlur) slurGroup = null;
        continue;
      }

      const note = { ...parsed.note, section };
      // A rest breaks a bow stroke rather than joining it.
      if (slurGroup !== null && !note.rest) note.slur = slurGroup;
      notes.push(note);
      beatsInBar += note.beats;

      if (closesSlur) slurGroup = null;
    }
  });

  if (slurGroup !== null) {
    warnings.push({ line: lines.length, message: 'A slur was opened but never closed.' });
  }

  if (beatsInBar > 0 && Math.abs(beatsInBar - beatsPerBar) > 0.001 && notes.length) {
    warnings.push({
      line: lines.length,
      message: `The last bar has ${round(beatsInBar)} beats, expected ${beatsPerBar}.`,
    });
  }

  return { notes, errors, warnings };
}

function round(n) {
  return Number(n.toFixed(2));
}

/**
 * Split a line into note tokens. Bar lines and slur brackets are punctuation,
 * not separators, so they get spaced out into their own tokens first —
 * otherwise "G4 q | A4 h" reads as one token and quietly loses the A4.
 */
function tokenize(line) {
  return line
    .replace(/\|/g, ' , | , ')
    .replace(/\(/g, ' , ( ')
    .replace(/\)/g, ' ) , ')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .flatMap((t) => {
      // "( D4 q" is still one token after the substitutions above; the bracket
      // needs to stay glued to the note that follows it.
      const m = /^\(\s*(.+)$/.exec(t);
      return m ? [`(${m[1]}`] : [t];
    });
}

function parseToken(piece, line) {
  const parts = piece.split(/\s+/);
  const head = parts[0];
  const tail = parts[1] ?? 'q';

  const beats = DURATIONS[tail] ?? Number(tail);
  if (!Number.isFinite(beats) || beats <= 0) {
    return {
      error: {
        line,
        token: piece,
        message: `"${tail}" is not a duration. Use w, h, q, e, s (add . to dot it) or a number of beats.`,
      },
    };
  }

  if (REST_WORDS.has(head.toLowerCase())) {
    return { note: { rest: true, beats } };
  }

  const midi = midiFromName(head);
  if (midi == null) {
    return {
      error: {
        line,
        token: piece,
        message: `"${head}" is not a note. Write them like D4, F#4 or Bb3.`,
      },
    };
  }

  return { note: { note: noteName(midi), midi, beats } };
}

/**
 * Work out bow strokes and directions.
 *
 * On violin a slur is a bowing instruction, not just a phrasing hint: every
 * note under one slur is played in a single bow stroke. So strokes fall out of
 * the slurs — each slur group is one stroke, each unslurred note is one stroke
 * — and directions simply alternate down, up, down, up from the start.
 *
 * A rest lets you retake the bow, so the alternation restarts on a down-bow
 * after one. That matches how the stroke actually gets written in a part.
 */
export function withBowing(notes, { startDown = true } = {}) {
  let down = startDown;
  let currentSlur = null;
  let strokeIndex = -1;
  let freshStroke = false;
  let retake = false;

  return notes.map((note) => {
    if (isRest(note)) {
      currentSlur = null;
      retake = true;
      return { ...note, bow: null, strokeIndex: null, strokeStart: false };
    }

    const slur = note.slur ?? null;
    const continuesStroke = slur !== null && slur === currentSlur;

    if (continuesStroke) {
      freshStroke = false;
    } else {
      if (retake) {
        down = startDown;
        retake = false;
      } else if (strokeIndex >= 0) {
        down = !down;
      }
      strokeIndex++;
      currentSlur = slur;
      freshStroke = true;
    }

    return {
      ...note,
      bow: down ? 'down' : 'up',
      bowSymbol: down ? '⊓' : '∨',
      strokeIndex,
      strokeStart: freshStroke,
      slurred: slur !== null,
    };
  });
}

/** Notes back to shorthand, with sections, bar lines and slurs restored. */
export function formatNotation(notes, { timeSignature = [4, 4], barsPerLine = 2 } = {}) {
  const beatsPerBar = timeSignature[0] * (4 / timeSignature[1]);
  const out = [];
  const list = [...notes];
  let section;
  let bar = [];
  let beats = 0;
  let barsOnLine = [];

  const closeBar = () => {
    if (bar.length) {
      barsOnLine.push(bar.join(', '));
      bar = [];
    }
    beats = 0;
  };
  const flushLine = () => {
    if (barsOnLine.length) {
      out.push(barsOnLine.join(' | '));
      barsOnLine = [];
    }
  };

  list.forEach((note, i) => {
    if (note.section !== section) {
      closeBar();
      flushLine();
      section = note.section;
      if (section) {
        if (out.length) out.push('');
        out.push(`# ${section}`);
      }
    }

    const slur = note.slur ?? null;
    const previousSlur = i > 0 ? list[i - 1].slur ?? null : null;
    const nextSlur = i < list.length - 1 ? list[i + 1].slur ?? null : null;

    let token = `${isRest(note) ? 'rest' : note.note} ${durationName(note.beats)}`;
    if (slur !== null && slur !== previousSlur) token = `(${token}`;
    if (slur !== null && slur !== nextSlur) token = `${token})`;

    bar.push(token);
    beats += note.beats;

    if (beats >= beatsPerBar - 0.001) {
      closeBar();
      if (barsOnLine.length >= barsPerLine) flushLine();
    }
  });

  closeBar();
  flushLine();
  return out.join('\n');
}

/**
 * Resolve notes for playing: attaches midi and fingering, and flags anything
 * that cannot be played in first position rather than drawing a wrong finger.
 */
export function resolveNotes(notes) {
  return withBowing(notes).map((note, index) => {
    if (isRest(note)) return { ...note, index, rest: true };
    const midi = note.midi ?? midiFromName(note.note);
    const fingering = midi == null ? null : fingeringFor(midi);
    return {
      ...note,
      index,
      midi,
      name: midi == null ? note.note : noteName(midi),
      fingering,
      outOfRange: fingering === null,
    };
  });
}

/** Group resolved notes into bow strokes, for drawing slur arcs. */
export function bowStrokes(resolved) {
  const strokes = [];
  for (const note of resolved) {
    if (note.strokeIndex == null) continue;
    const last = strokes.at(-1);
    if (last && last.index === note.strokeIndex) last.notes.push(note);
    else strokes.push({ index: note.strokeIndex, bow: note.bow, notes: [note] });
  }
  return strokes;
}

/** Start beat of each note, for scheduling and the scrolling lane. */
export function withTimings(notes, tempo) {
  const secondsPerBeat = 60 / tempo;
  let beat = 0;
  return notes.map((note) => {
    const start = beat;
    beat += note.beats;
    return {
      ...note,
      startBeat: start,
      endBeat: beat,
      startTime: start * secondsPerBeat,
      duration: note.beats * secondsPerBeat,
    };
  });
}

/** Shift every note by whole octaves — for melodies sitting below the violin. */
export function transpose(notes, semitones) {
  return notes.map((note) => {
    if (isRest(note)) return note;
    const midi = (note.midi ?? midiFromName(note.note)) + semitones;
    return { ...note, midi, note: noteName(midi) };
  });
}

/**
 * Suggest an octave shift that brings a melody into first position.
 * Returns 0 when it already fits or when no shift helps.
 */
export function suggestOctaveShift(notes) {
  const playable = (shift) =>
    notes.filter((n) => !isRest(n)).every((n) => {
      const midi = (n.midi ?? midiFromName(n.note)) + shift;
      return fingeringFor(midi) !== null;
    });

  if (playable(0)) return 0;
  for (const shift of [12, -12, 24, -24]) {
    if (playable(shift)) return shift;
  }
  return 0;
}
