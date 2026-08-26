// Run: node test/pitch.test.mjs
import { detectPitch } from '../js/audio/pitch.js';
import { midiToFreq, midiFromName, nearestNote, cents, fingeringFor, scale } from '../js/theory.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const SAMPLE_RATE = 48000;
const LENGTH = 2048;

/** A sawtooth is a decent stand-in for a bowed string: all harmonics present. */
function sawtooth(freq, sampleRate = SAMPLE_RATE, length = LENGTH, amp = 0.3) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const phase = ((i * freq) / sampleRate) % 1;
    buf[i] = amp * (2 * phase - 1);
  }
  return buf;
}

function sine(freq, sampleRate = SAMPLE_RATE, length = LENGTH, amp = 0.3) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

/** Strong upper harmonics — the classic octave-error trap. */
function harmonicRich(freq, sampleRate = SAMPLE_RATE, length = LENGTH) {
  const buf = new Float32Array(length);
  const partials = [
    [1, 0.35], [2, 0.30], [3, 0.22], [4, 0.16], [5, 0.10], [6, 0.06],
  ];
  for (let i = 0; i < length; i++) {
    let sample = 0;
    for (const [mult, gain] of partials) {
      sample += gain * Math.sin((2 * Math.PI * freq * mult * i) / sampleRate);
    }
    buf[i] = sample * 0.5;
  }
  return buf;
}

function withNoise(buf, level) {
  const out = new Float32Array(buf.length);
  // Deterministic pseudo-noise so the test never flakes.
  let seed = 12345;
  for (let i = 0; i < buf.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out[i] = buf[i] + ((seed / 0x7fffffff) * 2 - 1) * level;
  }
  return out;
}

console.log('\ntheory');
{
  check('A4 is 440 Hz', Math.abs(midiToFreq(69) - 440) < 1e-9);
  check('name parses to midi', midiFromName('A4') === 69, `got ${midiFromName('A4')}`);
  check('sharps parse', midiFromName('F#5') === 78, `got ${midiFromName('F#5')}`);
  check('flats parse', midiFromName('Bb3') === 58, `got ${midiFromName('Bb3')}`);
  check('open strings', ['G3', 'D4', 'A4', 'E5'].map(midiFromName).join() === '55,62,69,76');

  const octave = cents(880, 440);
  check('an octave is 1200 cents', Math.abs(octave - 1200) < 1e-6, `got ${octave}`);

  const flat = nearestNote(440 * Math.pow(2, -10 / 1200));
  check('10 cents flat reads as A4', flat.name === 'A4', `got ${flat.name}`);
  check('...and reports -10 cents', Math.abs(flat.cents + 10) < 0.01, `got ${flat.cents}`);
}

console.log('\nfingering');
{
  const a4 = fingeringFor(midiFromName('A4'));
  check('A4 is the open A string', a4.string === 'A' && a4.finger === 0, JSON.stringify(a4));

  const g4 = fingeringFor(midiFromName('G4'));
  check('G4 is 3rd finger on D', g4.string === 'D' && g4.finger === 3, JSON.stringify(g4));

  const fs4 = fingeringFor(midiFromName('F#4'));
  check('F#4 is 2nd finger on D', fs4.string === 'D' && fs4.finger === 2, JSON.stringify(fs4));
  check('...and it is a high 2', fs4.tone === 'high', fs4.tone);

  const f4 = fingeringFor(midiFromName('F4'));
  check('F natural is a low 2', f4.string === 'D' && f4.label === 'low 2', JSON.stringify(f4));

  const b5 = fingeringFor(midiFromName('B5'));
  check('B5 is 4th finger on E — top of first position', b5.string === 'E' && b5.finger === 4);

  check('C6 is out of first position', fingeringFor(midiFromName('C6')) === null);
  check('F#3 is below the violin', fingeringFor(midiFromName('F#3')) === null);
}

console.log('\nscales stay in first position');
{
  const dMajor = scale(midiFromName('D4'), 'major', 1);
  check('D major is 8 notes', dMajor.length === 8, `got ${dMajor.length}`);
  check('D major all playable', dMajor.every((m) => fingeringFor(m) !== null));

  const bMinor = scale(midiFromName('B3'), 'minor', 2);
  check('B minor spans 2 octaves', bMinor.length === 15, `got ${bMinor.length}`);
  check('B minor all playable', bMinor.every((m) => fingeringFor(m) !== null),
    bMinor.filter((m) => !fingeringFor(m)).join());

  // The reason the curriculum uses B minor and not a 2-octave D major.
  const dMajorTwo = scale(midiFromName('D4'), 'major', 2);
  check('2-octave D major does NOT fit', dMajorTwo.some((m) => fingeringFor(m) === null));
}

console.log('\npitch detection');
{
  const notes = ['G3', 'B3', 'D4', 'F#4', 'A4', 'C#5', 'E5', 'A5', 'B5'];
  for (const name of notes) {
    const target = midiToFreq(midiFromName(name));
    const result = detectPitch(sawtooth(target), SAMPLE_RATE);
    if (!result) {
      check(`${name} sawtooth detected`, false, 'no reading');
      continue;
    }
    const error = Math.abs(cents(result.freq, target));
    check(`${name} sawtooth within 3 cents`, error < 3, `off by ${error.toFixed(2)} cents`);
  }

  for (const name of ['D4', 'A4', 'E5']) {
    const target = midiToFreq(midiFromName(name));
    const result = detectPitch(sine(target), SAMPLE_RATE);
    check(`${name} sine within 3 cents`, result && Math.abs(cents(result.freq, target)) < 3,
      result ? `off by ${cents(result.freq, target).toFixed(2)}` : 'no reading');
  }

  for (const name of ['G3', 'D4', 'A4']) {
    const target = midiToFreq(midiFromName(name));
    const result = detectPitch(harmonicRich(target), SAMPLE_RATE);
    check(`${name} harmonic-rich has no octave error`,
      result && Math.abs(cents(result.freq, target)) < 10,
      result ? `read ${result.freq.toFixed(1)} Hz, wanted ${target.toFixed(1)}` : 'no reading');
  }
}

console.log('\nout-of-tune readings');
{
  for (const offset of [-40, -15, 7, 25]) {
    const target = midiToFreq(midiFromName('A4'));
    const played = target * Math.pow(2, offset / 1200);
    const result = detectPitch(sawtooth(played), SAMPLE_RATE);
    if (!result) {
      check(`${offset} cents off detected`, false, 'no reading');
      continue;
    }
    const reading = nearestNote(result.freq);
    check(`${offset} cents off still reads as A4`, reading.name === 'A4', `got ${reading.name}`);
    check(`...and measures ~${offset} cents`, Math.abs(reading.cents - offset) < 3,
      `got ${reading.cents.toFixed(2)}`);
  }
}

console.log('\nrejects what it should');
{
  check('silence returns null', detectPitch(new Float32Array(LENGTH), SAMPLE_RATE) === null);

  const quiet = sawtooth(440, SAMPLE_RATE, LENGTH, 0.001);
  check('very quiet signal returns null', detectPitch(quiet, SAMPLE_RATE) === null);

  const noise = withNoise(new Float32Array(LENGTH), 0.3);
  check('pure noise returns null', detectPitch(noise, SAMPLE_RATE) === null);

  const noisyNote = withNoise(sawtooth(440), 0.03);
  const result = detectPitch(noisyNote, SAMPLE_RATE);
  check('a note under room noise still reads', result && Math.abs(cents(result.freq, 440)) < 10,
    result ? `off by ${cents(result.freq, 440).toFixed(2)}` : 'no reading');
}

console.log('\nsample rates');
{
  for (const rate of [44100, 48000]) {
    const result = detectPitch(sawtooth(440, rate, 2048), rate);
    check(`${rate} Hz works`, result && Math.abs(cents(result.freq, 440)) < 3,
      result ? `off by ${cents(result.freq, 440).toFixed(2)}` : 'no reading');
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
