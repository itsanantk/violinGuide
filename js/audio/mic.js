// Microphone access, the shared AudioContext, and the listening loop.
//
// One AudioContext for the whole app: browsers cap how many you can create,
// and the tuner, synth and play-along scorer all need to share a clock.

import { detectPitch, PitchSmoother } from './pitch.js';
import { nearestNote } from '../theory.js';

let ctx = null;
let stream = null;
let source = null;
let analyser = null;
let activeMode = null;

export const MicState = {
  IDLE: 'idle',
  READY: 'ready',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

let state = MicState.IDLE;
const watchers = new Set();

export function micState() {
  return state;
}

export function onMicStateChange(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

function setState(next, detail) {
  state = next;
  for (const fn of watchers) fn(next, detail);
}

export function audioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio is not available in this browser.');
    ctx = new Ctor();
  }
  return ctx;
}

/**
 * Chrome will not start audio without a user gesture, and a suspended context
 * fails silently — no sound, no error. Every entry point calls this from a
 * click so that never happens.
 */
export async function ensureAudio() {
  const context = audioContext();
  if (context.state === 'suspended') {
    // resume() on a suspended context stays pending until a user gesture
    // actually happens — awaiting it unconditionally hangs the caller forever
    // when this is reached any other way. Start it, give it a moment, move on.
    await Promise.race([
      context.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
  }
  return context;
}

/**
 * `mode` picks the capture constraints:
 *   'clean'     — tuner, note trainer, song learn mode. Nothing is playing, so
 *                 every browser DSP stage is off; they are tuned for speech and
 *                 chew up a sustained bowed note.
 *   'playalong' — the site is playing while you play. Echo cancellation is a
 *                 best-effort fallback for people without headphones; it is not
 *                 reliable against a page's own output, which is why play-along
 *                 recommends headphones instead of depending on this.
 */
export async function startMic({ mode = 'clean' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    setState(MicState.UNAVAILABLE);
    throw new Error('This browser cannot reach the microphone.');
  }

  await ensureAudio();

  if (stream && activeMode === mode) return analyser;
  if (stream) stopMic();

  const wantsEchoCancellation = mode === 'playalong';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: wantsEchoCancellation,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
  } catch (err) {
    const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
    setState(denied ? MicState.DENIED : MicState.ERROR, err);
    throw err;
  }

  const context = audioContext();
  source = context.createMediaStreamSource(stream);
  analyser = context.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  // Deliberately not connected to the destination — routing the mic to the
  // speakers would feed back through the violin's own body.

  activeMode = mode;
  setState(MicState.READY);
  return analyser;
}

export function stopMic() {
  if (source) source.disconnect();
  if (stream) for (const track of stream.getTracks()) track.stop();
  stream = null;
  source = null;
  analyser = null;
  activeMode = null;
  if (state === MicState.READY) setState(MicState.IDLE);
}

export function isListening() {
  return analyser !== null;
}

/**
 * Runs `onReading` once per animation frame with the current pitch, or null
 * when nothing convincing is being played.
 *
 * @returns {() => void} call to stop.
 */
export function listen(onReading, { smoothing = 5, a4 = 440, detector = {} } = {}) {
  if (!analyser) throw new Error('Call startMic() before listen().');

  const buffer = new Float32Array(analyser.fftSize);
  const smoother = new PitchSmoother(smoothing);
  const sampleRate = audioContext().sampleRate;
  let frame = 0;
  let running = true;

  function tick() {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    if (!analyser) return;

    analyser.getFloatTimeDomainData(buffer);
    const raw = detectPitch(buffer, sampleRate, detector);
    const freq = smoother.push(raw ? raw.freq : null);

    if (freq == null) {
      onReading(null);
      return;
    }
    const note = nearestNote(freq, a4);
    onReading({
      freq,
      clarity: raw.clarity,
      rms: raw.rms,
      midi: note.midi,
      name: note.name,
      cents: note.cents,
      targetFreq: note.targetFreq,
    });
  }

  frame = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(frame);
    smoother.reset();
  };
}
