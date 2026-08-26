// Song playback and the clock that play-along scores against.
//
// Web Audio events are scheduled ahead of time against the audio clock, not
// fired from requestAnimationFrame: rAF drifts and stalls in background tabs,
// and a metronome that stutters is worse than none. A short lookahead window
// is refilled on a timer, which is the standard shape for this.

import { audioContext, ensureAudio } from './mic.js';
import { playNote, playClick } from './synth.js';
import { withTimings, isRest } from '../notation.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12; // seconds

export class SongPlayer {
  /**
   * @param {Array} notes resolved notes
   * @param {object} options
   */
  constructor(notes, {
    tempo = 90,
    tempoScale = 1,
    metronome = true,
    countIn = true,
    beatsPerBar = 4,
    playNotes = true,
    onBeat = null,
    onNoteStart = null,
    onEnd = null,
  } = {}) {
    this.baseTempo = tempo;
    this.tempoScale = tempoScale;
    this.metronome = metronome;
    this.countIn = countIn;
    this.beatsPerBar = beatsPerBar;
    this.playNotes = playNotes;
    this.onBeat = onBeat;
    this.onNoteStart = onNoteStart;
    this.onEnd = onEnd;

    this.setNotes(notes);

    this.timer = null;
    this.startTime = 0;
    this.running = false;
  }

  get tempo() {
    return this.baseTempo * this.tempoScale;
  }

  get secondsPerBeat() {
    return 60 / this.tempo;
  }

  setNotes(notes) {
    this.notes = withTimings(notes, this.tempo);
    this.totalBeats = this.notes.reduce((sum, n) => sum + n.beats, 0);
  }

  setTempoScale(scale) {
    const wasRunning = this.running;
    const beat = this.currentBeat();
    this.tempoScale = scale;
    this.setNotes(this.notes);
    if (wasRunning) {
      this.stop();
      this.start({ fromBeat: beat });
    }
  }

  /** Beats elapsed since the music started; negative during the count-in. */
  currentBeat() {
    if (!this.running) return this.pausedBeat ?? 0;
    return (audioContext().currentTime - this.startTime) / this.secondsPerBeat;
  }

  /** Time in seconds a given beat falls at, on the audio clock. */
  timeOfBeat(beat) {
    return this.startTime + beat * this.secondsPerBeat;
  }

  async start({ fromBeat = 0 } = {}) {
    await ensureAudio();
    if (this.running) this.stop();

    const ctx = audioContext();
    const countInBeats = this.countIn ? this.beatsPerBar : 0;

    this.running = true;
    this.pausedBeat = null;
    this.nextNoteIndex = this.notes.findIndex((n) => n.startBeat >= fromBeat - 1e-6);
    if (this.nextNoteIndex < 0) this.nextNoteIndex = this.notes.length;
    this.nextClickBeat = Math.ceil(fromBeat - countInBeats);
    // startTime is when beat 0 of the music happens, so the count-in sits at
    // negative beats and every other time calculation stays uniform.
    this.startTime = ctx.currentTime + 0.06 + countInBeats * this.secondsPerBeat - fromBeat * this.secondsPerBeat;

    this.timer = setInterval(() => this.#tick(), LOOKAHEAD_MS);
    this.#tick();
  }

  #tick() {
    if (!this.running) return;
    const ctx = audioContext();
    const horizon = ctx.currentTime + SCHEDULE_AHEAD;

    // Metronome, including through the count-in.
    if (this.metronome) {
      while (this.timeOfBeat(this.nextClickBeat) < horizon) {
        const at = this.timeOfBeat(this.nextClickBeat);
        if (at >= ctx.currentTime) {
          const positionInBar = ((this.nextClickBeat % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;
          playClick(at, { accent: positionInBar === 0 });
        }
        this.nextClickBeat++;
        if (this.nextClickBeat > this.totalBeats + 1) break;
      }
    }

    while (this.nextNoteIndex < this.notes.length) {
      const note = this.notes[this.nextNoteIndex];
      const at = this.timeOfBeat(note.startBeat);
      if (at >= horizon) break;

      if (!isRest(note) && this.playNotes && note.midi != null) {
        // Slurred notes run into each other; separate bows get a small gap so
        // repeated pitches are audible as two notes rather than one long one.
        const gap = note.slurred ? 0 : 0.03;
        playNote(note.midi, at, Math.max(0.08, note.duration - gap));
      }
      this.onNoteStart?.(note, at);
      this.nextNoteIndex++;
    }

    const beat = this.currentBeat();
    this.onBeat?.(beat);

    if (beat > this.totalBeats + 0.5) {
      this.stop();
      this.onEnd?.();
    }
  }

  pause() {
    this.pausedBeat = this.currentBeat();
    this.stop();
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * Scores a run: each note gets a time window, and whatever the mic reports
 * during that window decides hit / out of tune / missed.
 *
 * Kept separate from the player so learn mode (which waits for you) and
 * play-along (which does not) can share the same judgement of "in tune".
 */
export class RunScorer {
  constructor(notes, { tolerance = 25 } = {}) {
    this.tolerance = tolerance;
    this.reset(notes);
  }

  reset(notes = this.notes) {
    this.notes = notes;
    this.results = notes.map((note) => ({
      index: note.index,
      midi: note.midi,
      rest: Boolean(note.rest),
      status: note.rest ? 'rest' : 'pending',
      bestCents: null,
      samples: 0,
    }));
  }

  /** Feed a mic reading against the note whose window is currently open. */
  observe(noteIndex, reading) {
    const result = this.results[noteIndex];
    if (!result || result.rest) return;
    if (!reading) return;

    if (reading.midi === result.midi) {
      const cents = Math.abs(reading.cents);
      if (result.bestCents == null || cents < result.bestCents) result.bestCents = cents;
      result.samples++;
      result.status = cents <= this.tolerance ? 'hit' : 'close';
    } else if (result.status === 'pending') {
      result.status = 'wrong';
      result.heard = reading.name;
    }
  }

  /** Call when a note's window closes. */
  close(noteIndex) {
    const result = this.results[noteIndex];
    if (!result || result.rest) return;
    if (result.status === 'pending') result.status = 'missed';
  }

  summary() {
    const played = this.results.filter((r) => !r.rest);
    const hits = played.filter((r) => r.status === 'hit');
    const withCents = played.filter((r) => r.bestCents != null);
    const avgCents = withCents.length
      ? withCents.reduce((sum, r) => sum + r.bestCents, 0) / withCents.length
      : null;

    return {
      total: played.length,
      hits: hits.length,
      close: played.filter((r) => r.status === 'close').length,
      wrong: played.filter((r) => r.status === 'wrong').length,
      missed: played.filter((r) => r.status === 'missed').length,
      accuracy: played.length ? (hits.length / played.length) * 100 : 0,
      avgCents,
      trouble: [...played]
        .filter((r) => r.status !== 'hit')
        .slice(0, 8),
    };
  }
}
