// Sound generation: a bowed-string-ish voice, a metronome, and a tuning drone.
//
// A sawtooth through a lowpass is the classic cheap string model — a bowed
// string really does produce a near-sawtooth displacement (Helmholtz motion),
// so this lands closer to a violin than the usual sine would, without needing
// a sample library the site would have to ship.

import { audioContext, ensureAudio } from './mic.js';
import { midiToFreq } from '../theory.js';

let master = null;

function masterGain() {
  if (!master) {
    const ctx = audioContext();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  return master;
}

export function setVolume(value) {
  masterGain().gain.value = Math.max(0, Math.min(1, value));
}

export function getVolume() {
  return masterGain().gain.value;
}

/**
 * One bowed note.
 * @param {number} midi
 * @param {number} startTime AudioContext time; 0 or past means "now"
 * @param {number} duration seconds
 * @returns {{stop: (t?: number) => void}}
 */
export function playNote(midi, startTime = 0, duration = 0.5, { gain = 0.22 } = {}) {
  const ctx = audioContext();
  const at = Math.max(startTime, ctx.currentTime);
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  // Vibrato, kept shallow. Real beginner playing has none, and a heavy wobble
  // would make the reference pitch ambiguous to play against.
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 5.2;
  lfoGain.gain.value = freq * 0.004;
  lfo.connect(lfoGain).connect(osc.frequency);

  // Tracking the fundamental keeps the timbre even across the range instead of
  // going dull down on the G string and shrill up on the E.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(freq * 6, 9000);
  filter.Q.value = 0.6;

  const env = ctx.createGain();
  const attack = 0.045; // a bow takes a moment to speak
  const release = Math.min(0.18, duration * 0.4);
  const sustainUntil = at + Math.max(duration - release, 0.02);

  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.setValueAtTime(gain, sustainUntil);
  env.gain.exponentialRampToValueAtTime(0.0001, sustainUntil + release);

  osc.connect(filter).connect(env).connect(masterGain());

  osc.start(at);
  lfo.start(at);
  const stopAt = sustainUntil + release + 0.02;
  osc.stop(stopAt);
  lfo.stop(stopAt);

  return {
    stop(when = ctx.currentTime) {
      try {
        env.gain.cancelScheduledValues(when);
        env.gain.setValueAtTime(env.gain.value, when);
        env.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
        osc.stop(when + 0.08);
        lfo.stop(when + 0.08);
      } catch {
        // Already stopped; nothing to do.
      }
    },
  };
}

export async function playNoteNow(midi, duration = 0.6) {
  await ensureAudio();
  return playNote(midi, 0, duration);
}

/** A sustained reference pitch for tuning by ear or checking intonation. */
export function startDrone(midi, { gain = 0.14 } = {}) {
  const ctx = audioContext();
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(freq * 5, 8000);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.3);

  osc.connect(filter).connect(env).connect(masterGain());
  osc.start();

  let stopped = false;
  return {
    midi,
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      env.gain.cancelScheduledValues(now);
      env.gain.setValueAtTime(env.gain.value, now);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.stop(now + 0.3);
    },
  };
}

/**
 * Metronome click. Short filtered noise burst rather than a sine blip so it
 * cuts through a bowed note instead of blending into it.
 */
export function playClick(startTime = 0, { accent = false } = {}) {
  const ctx = audioContext();
  const at = Math.max(startTime, ctx.currentTime);

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = accent ? 1600 : 1050;

  const env = ctx.createGain();
  env.gain.setValueAtTime(accent ? 0.3 : 0.18, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);

  osc.connect(env).connect(masterGain());
  osc.start(at);
  osc.stop(at + 0.06);
}

/** Short confirmation blip — used when a note is matched in tune. */
export function playDing({ good = true } = {}) {
  const ctx = audioContext();
  const at = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(good ? 880 : 320, at);
  if (good) osc.frequency.exponentialRampToValueAtTime(1320, at + 0.08);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.16, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);

  osc.connect(env).connect(masterGain());
  osc.start(at);
  osc.stop(at + 0.2);
}
