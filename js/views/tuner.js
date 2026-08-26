// Tuner: live pitch, a reference drone, and the four open strings.
//
// The readout is a stopped finger sliding along a string rather than a needle
// on a dial — same mental model the player already has when placing a finger,
// and it makes "flat" read as "too close to the nut" instead of "left of centre".

import { listen, stopMic } from '../audio/mic.js';
import { startDrone, playNote } from '../audio/synth.js';
import { STRINGS, midiToFreq, noteName } from '../theory.js';
import { getSettings, setSetting } from '../store.js';
import { renderFingerboard } from '../ui/fingerboard.js';
import { h, $, $$, micGate, formatCents } from '../ui/dom.js';

const RANGE = 50; // cents shown either side of centre

export function render(container) {
  const settings = getSettings();

  container.appendChild(h(`
    <header>
      <span class="eyebrow">Tuner</span>
      <h1>Tune up</h1>
      <p>Bow one string at a time. The dot sits where your finger effectively is —
         left of the line is flat, right is sharp.</p>
    </header>
  `));

  const gateHost = h('<div></div>');
  container.appendChild(gateHost);

  const main = h(`
    <div class="stack">
      <div class="tuner">
        <div class="tuner-readout">
          <span class="tuner-note is-idle" data-note>—</span>
          <span class="tuner-oct" data-hz></span>
        </div>

        <div class="tuner-string-wrap">
          <div class="tuner-track">
            <div class="tuner-zone" data-zone></div>
            <div class="tuner-centre"></div>
            <div class="tuner-finger is-idle" data-finger></div>
          </div>
          <div class="tuner-scale">
            <span>−${RANGE}</span><span>−25</span><span>0</span><span>+25</span><span>+${RANGE}</span>
          </div>
        </div>

        <p class="tuner-cents" data-cents>Play a note</p>
        <p class="tuner-hz" data-target></p>
      </div>

      <div class="grid two">
        <div class="card">
          <h3>Open strings</h3>
          <p class="muted small">Click one to hear it, then match it. Click again to stop.</p>
          <div class="string-buttons" data-strings></div>
          <div class="row" style="margin-top:1rem;justify-content:center">
            <button class="btn small ghost" type="button" data-drone-stop hidden>Stop tone</button>
          </div>
        </div>

        <div class="card">
          <h3>Where you are</h3>
          <div data-board style="max-width:200px;margin:0 auto"></div>
        </div>
      </div>

      <div class="card">
        <h3>Settings</h3>
        <div class="grid two" style="margin-top:.75rem">
          <div class="field">
            <label for="a4">Reference pitch — A<span class="mono">4</span> =
              <b class="mono" data-a4-value>${settings.a4}</b> Hz</label>
            <input id="a4" type="range" min="415" max="446" step="1" value="${settings.a4}">
            <span class="small muted">Leave this at 440 unless you are playing with
              someone who tunes differently.</span>
          </div>
          <div class="field">
            <label for="tol">In tune means within
              <b class="mono" data-tol-value>${settings.tolerance}</b> cents</label>
            <input id="tol" type="range" min="5" max="50" step="1" value="${settings.tolerance}">
            <span class="small muted">25 is a fair beginner target. Tighten it as you improve.</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>How to tune</h3>
        <p class="small muted">Turn the big pegs only for large changes, and push the peg
          gently <em>in</em> as you turn or it will slip straight back. For small changes use
          the fine tuners on the tailpiece — most violins have one on the E string at least.
          Tune from the A string first, then D, G, E.</p>
        <p class="small muted">If a string is badly flat, bring it up slowly. Going sharp and
          coming back down leaves the string more likely to drift.</p>
      </div>
    </div>
  `);
  container.appendChild(main);

  // --- elements
  const noteEl = $(main, '[data-note]');
  const hzEl = $(main, '[data-hz]');
  const centsEl = $(main, '[data-cents]');
  const targetEl = $(main, '[data-target]');
  const fingerEl = $(main, '[data-finger]');
  const zoneEl = $(main, '[data-zone]');
  const stringsEl = $(main, '[data-strings]');
  const droneStopBtn = $(main, '[data-drone-stop]');

  const board = renderFingerboard($(main, '[data-board]'), { showTapes: true });

  let tolerance = settings.tolerance;
  let a4 = settings.a4;
  let drone = null;
  let stopListening = null;

  function paintZone() {
    const half = (tolerance / RANGE) * 50;
    zoneEl.style.left = `${50 - half}%`;
    zoneEl.style.width = `${half * 2}%`;
  }
  paintZone();

  // --- string buttons
  for (const string of STRINGS) {
    const btn = h(`
      <button class="string-btn" type="button" aria-pressed="false" data-midi="${string.midi}">
        <span>${string.name}<small>${midiToFreq(string.midi, a4).toFixed(1)}</small></span>
      </button>
    `);
    btn.addEventListener('click', () => toggleDrone(string.midi, btn));
    stringsEl.appendChild(btn);
  }

  function clearDrone() {
    drone?.stop();
    drone = null;
    droneStopBtn.hidden = true;
    $$(main, '.string-btn').forEach((b) => b.classList.remove('is-sounding'));
  }

  function toggleDrone(midi, btn) {
    const wasSounding = drone?.midi === midi;
    clearDrone();
    if (wasSounding) return;
    drone = startDrone(midi);
    btn.classList.add('is-sounding');
    droneStopBtn.hidden = false;
  }

  droneStopBtn.addEventListener('click', clearDrone);

  // --- settings
  const a4Input = $(main, '#a4');
  const a4Value = $(main, '[data-a4-value]');
  a4Input.addEventListener('input', () => {
    a4 = Number(a4Input.value);
    a4Value.textContent = a4;
    setSetting('a4', a4);
    restart();
    $$(main, '.string-btn').forEach((b) => {
      const small = b.querySelector('small');
      small.textContent = midiToFreq(Number(b.dataset.midi), a4).toFixed(1);
    });
  });

  const tolInput = $(main, '#tol');
  const tolValue = $(main, '[data-tol-value]');
  tolInput.addEventListener('input', () => {
    tolerance = Number(tolInput.value);
    tolValue.textContent = tolerance;
    setSetting('tolerance', tolerance);
    paintZone();
  });

  // --- live readout
  function idle() {
    noteEl.textContent = '—';
    noteEl.className = 'tuner-note is-idle';
    hzEl.textContent = '';
    centsEl.textContent = 'Play a note';
    targetEl.textContent = '';
    fingerEl.className = 'tuner-finger is-idle';
    fingerEl.style.left = '50%';
    board.setLive(null);
  }

  function paint(reading) {
    if (!reading) return idle();

    const inTune = Math.abs(reading.cents) <= tolerance;
    noteEl.textContent = reading.name.replace(/\d/, '');
    noteEl.className = `tuner-note${inTune ? ' is-intune' : ''}`;
    hzEl.textContent = reading.name.match(/\d/)?.[0] ?? '';

    const clamped = Math.max(-RANGE, Math.min(RANGE, reading.cents));
    fingerEl.style.left = `${50 + (clamped / RANGE) * 50}%`;
    fingerEl.className = `tuner-finger${inTune ? ' is-intune' : ''}`;

    centsEl.innerHTML = inTune
      ? '<b>In tune</b>'
      : `<b>${formatCents(reading.cents)}</b> cents ${reading.cents < 0 ? 'flat' : 'sharp'}`;
    targetEl.textContent =
      `${reading.freq.toFixed(1)} Hz  ·  target ${reading.targetFreq.toFixed(1)} Hz`;

    board.setLive({ midi: reading.midi, cents: reading.cents, tolerance });
  }

  function restart() {
    stopListening?.();
    stopListening = null;
    if (gate.ready) stopListening = listen(paint, { a4 });
  }

  const gate = micGate(gateHost, { label: 'Turn on the microphone to tune' });
  gate.onReady(restart);
  idle();

  return () => {
    stopListening?.();
    clearDrone();
    gate.destroy();
  };
}
