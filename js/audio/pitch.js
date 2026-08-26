// Monophonic pitch detection via the McLeod Pitch Method (NSDF autocorrelation).
//
// Chosen over plain autocorrelation because the normalised square difference
// function is far less prone to octave errors, which matter here: a violin's
// upper harmonics are strong enough that naive autocorrelation regularly
// reports the octave above and would tell a beginner they're a whole octave
// wrong when they aren't.
//
// Pure math, no Web Audio types — see test/pitch.test.mjs.

const DEFAULTS = {
  minFreq: 150,   // below G3 (196 Hz) with margin for a badly flat open G
  maxFreq: 1400,  // above B5 (988 Hz), the top of first position, with margin
  rmsThreshold: 0.008,
  clarityThreshold: 0.8,
  peakRatio: 0.9, // McLeod's k: accept the first peak within 90% of the best
};

/**
 * @param {Float32Array} buf time-domain samples, roughly -1..1
 * @param {number} sampleRate
 * @returns {{freq:number, clarity:number, rms:number}|null} null when the
 *   signal is too quiet or too noisy to trust — callers should show "listening"
 *   rather than a wrong note.
 */
export function detectPitch(buf, sampleRate, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const n = buf.length;

  let sumSquares = 0;
  for (let i = 0; i < n; i++) sumSquares += buf[i] * buf[i];
  const rms = Math.sqrt(sumSquares / n);
  if (rms < opt.rmsThreshold) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / opt.maxFreq));
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / opt.minFreq));
  if (maxLag <= minLag) return null;

  // Normalised square difference function over the lag range of interest.
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let energy = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) {
      const a = buf[i];
      const b = buf[i + lag];
      correlation += a * b;
      energy += a * a + b * b;
    }
    nsdf[lag] = energy > 0 ? (2 * correlation) / energy : 0;
  }

  const peak = pickPeak(nsdf, minLag, maxLag, opt.peakRatio);
  if (!peak || peak.value < opt.clarityThreshold) return null;

  const freq = sampleRate / peak.lag;
  if (freq < opt.minFreq || freq > opt.maxFreq) return null;

  return { freq, clarity: peak.value, rms };
}

/**
 * McLeod peak picking: collect the maximum of each region between a rising
 * and falling zero crossing, then take the *first* one that comes within
 * `ratio` of the tallest. Taking the tallest outright is what causes octave
 * jumps; taking the earliest strong peak keeps the fundamental.
 */
function pickPeak(nsdf, minLag, maxLag, ratio) {
  const maxima = [];
  let lag = minLag;

  // Skip the initial descent so we start hunting from the first zero crossing.
  while (lag < maxLag && nsdf[lag] > 0) lag++;

  while (lag < maxLag) {
    while (lag < maxLag && nsdf[lag] <= 0) lag++;
    if (lag >= maxLag) break;

    let bestLag = lag;
    let bestValue = nsdf[lag];
    while (lag < maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > bestValue) {
        bestValue = nsdf[lag];
        bestLag = lag;
      }
      lag++;
    }
    maxima.push(bestLag);
  }

  if (maxima.length === 0) return null;

  let highest = 0;
  for (const m of maxima) highest = Math.max(highest, nsdf[m]);
  if (highest <= 0) return null;

  const threshold = highest * ratio;
  const chosen = maxima.find((m) => nsdf[m] >= threshold) ?? maxima[0];
  return refine(nsdf, chosen);
}

/** Parabolic interpolation through the peak and its neighbours. */
function refine(nsdf, lag) {
  const y0 = nsdf[lag - 1];
  const y1 = nsdf[lag];
  const y2 = nsdf[lag + 1];
  const denom = 2 * (2 * y1 - y0 - y2);
  if (!Number.isFinite(denom) || denom === 0) return { lag, value: y1 };
  const shift = (y2 - y0) / denom;
  // A shift beyond half a sample means the parabola didn't fit; keep the bin.
  if (Math.abs(shift) > 1) return { lag, value: y1 };
  return { lag: lag + shift, value: y1 };
}

/**
 * Running median + hold. The raw detector is accurate but jittery frame to
 * frame, and a needle that twitches is unreadable while you're also trying to
 * hold a bow. `size` frames of median smoothing costs ~50ms of latency at
 * 60fps, which is imperceptible for tuning.
 */
export class PitchSmoother {
  constructor(size = 5) {
    this.size = size;
    this.frames = [];
  }

  /** @param {number|null} freq */
  push(freq) {
    if (freq == null) {
      this.frames = [];
      return null;
    }
    this.frames.push(freq);
    if (this.frames.length > this.size) this.frames.shift();
    // Wait for a couple of agreeing frames before committing to a reading.
    if (this.frames.length < Math.min(3, this.size)) return null;
    const sorted = [...this.frames].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  reset() {
    this.frames = [];
  }
}
