// Play a melody, get notes back.
//
// The hard part is not detecting pitch — pitch.js already does that well — it is
// deciding where one note ends and the next begins when the input is a
// continuous stream of readings. The rule here: a note starts when the detector
// agrees with itself for a few frames, and ends when the pitch moves by a
// semitone or the sound stops. Bow changes on a repeated note are caught by the
// gap in signal between them.
//
// Durations are quantised to the nearest sensible division, because nobody
// plays a "0.94 beat" note and a transcript full of them is unusable.

import { listen } from './mic.js';
import { noteName } from '../theory.js';

const QUANTISE = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

export class Transcriber {
  /**
   * @param {object} options
   * @param {number} options.tempo beats per minute to quantise against
   * @param {number} options.minNoteMs ignore blips shorter than this
   * @param {(event) => void} options.onChange fires as notes are captured
   */
  constructor({ tempo = 90, minNoteMs = 110, a4 = 440, onChange = null } = {}) {
    this.tempo = tempo;
    this.minNoteMs = minNoteMs;
    this.a4 = a4;
    this.onChange = onChange;
    this.notes = [];
    this.stopFn = null;

    this.currentMidi = null;
    this.currentStart = 0;
    this.stableFrames = 0;
    this.silentSince = null;
    this.centsSum = 0;
    this.centsCount = 0;
  }

  get running() {
    return this.stopFn !== null;
  }

  start() {
    if (this.stopFn) return;
    this.startedAt = performance.now();
    this.lastEnd = this.startedAt;
    this.stopFn = listen((reading) => this.#frame(reading), { a4: this.a4, smoothing: 3 });
  }

  stop() {
    this.stopFn?.();
    this.stopFn = null;
    this.#commit(performance.now());
    this.onChange?.({ notes: this.notes, live: null });
  }

  clear() {
    this.notes = [];
    this.currentMidi = null;
    this.onChange?.({ notes: this.notes, live: null });
  }

  undo() {
    this.notes.pop();
    this.onChange?.({ notes: this.notes, live: null });
  }

  #frame(reading) {
    const now = performance.now();

    if (!reading) {
      // Silence: close the note, and once the gap is long enough, record a rest.
      if (this.currentMidi != null) this.#commit(now);
      if (this.silentSince == null) this.silentSince = now;
      this.onChange?.({ notes: this.notes, live: null });
      return;
    }

    this.silentSince = null;

    if (reading.midi === this.currentMidi) {
      this.stableFrames++;
      this.centsSum += reading.cents;
      this.centsCount++;
      this.onChange?.({ notes: this.notes, live: { ...reading, held: now - this.currentStart } });
      return;
    }

    // Pitch changed — close the old note and open a new one.
    if (this.currentMidi != null) this.#commit(now);

    this.currentMidi = reading.midi;
    this.currentStart = now;
    this.stableFrames = 1;
    this.centsSum = reading.cents;
    this.centsCount = 1;
    this.onChange?.({ notes: this.notes, live: { ...reading, held: 0 } });
  }

  #commit(endTime) {
    if (this.currentMidi == null) return;
    const durationMs = endTime - this.currentStart;
    const midi = this.currentMidi;
    const avgCents = this.centsCount ? this.centsSum / this.centsCount : 0;

    this.currentMidi = null;
    this.centsSum = 0;
    this.centsCount = 0;

    if (durationMs < this.minNoteMs) return; // a slide or a squeak, not a note

    // A meaningful gap since the previous note becomes a rest.
    const gapMs = this.currentStart - this.lastEnd;
    const beatMs = 60000 / this.tempo;
    if (this.notes.length && gapMs > beatMs * 0.4) {
      const restBeats = quantise(gapMs / beatMs);
      if (restBeats >= 0.25) this.notes.push({ rest: true, beats: restBeats });
    }

    this.notes.push({
      note: noteName(midi),
      midi,
      beats: quantise(durationMs / beatMs),
      avgCents,
    });

    this.lastEnd = endTime;
    this.onChange?.({ notes: this.notes, live: null });
  }
}

function quantise(beats) {
  let best = QUANTISE[0];
  let bestGap = Infinity;
  for (const candidate of QUANTISE) {
    const gap = Math.abs(candidate - beats);
    if (gap < bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }
  return best;
}

export { quantise };
