// The mic-verified drills, shared by curriculum exercises and the trainer.
//
// All four kinds reduce to the same loop: show a target note, listen, and count
// it done once it has been held in tune for long enough. Only the way targets
// are chosen and how long they must be held differs, so they share one engine.

import { listen } from '../audio/mic.js';
import { playDing, playNoteNow, startDrone } from '../audio/synth.js';
import { midiFromName, noteName, scale as buildScale, STRINGS } from '../theory.js';
import { renderFingerboard, fingeringBadge } from './fingerboard.js';
import { h, $, esc, micGate, formatCents, pluralise } from './dom.js';

const RANGE = 50;
const FRAMES_PER_SECOND = 60;

/**
 * @param {HTMLElement} container
 * @param {object} config an exercise from curriculum.js, or a trainer game
 * @param {(result) => void} onComplete
 * @returns {() => void} cleanup
 */
export function runDrill(container, config, onComplete) {
  const targets = buildTargets(config);
  const tolerance = config.tolerance ?? 25;
  const holdSeconds = config.holdSeconds ?? 0.35;
  const framesRequired = Math.max(4, Math.round(holdSeconds * FRAMES_PER_SECOND));

  const ui = h(`
    <div class="stack">
      <div data-gate></div>
      <div class="bignote">
        <div class="bignote-main">
          <div class="bignote-name" data-name>—</div>
          <div class="bignote-sub" data-sub></div>
          <div class="tuner-string-wrap" style="margin-top:1.25rem">
            <div class="tuner-track">
              <div class="tuner-zone" data-zone></div>
              <div class="tuner-centre"></div>
              <div class="tuner-finger is-idle" data-finger></div>
            </div>
          </div>
          <div class="steady" style="margin-top:1rem"><i data-hold style="left:0;width:0"></i></div>
          <p class="tuner-cents" data-cents style="text-align:left;margin-top:.6rem">Play it</p>
        </div>
        <div class="bignote-aside" data-board></div>
      </div>

      <div class="card">
        <div class="spread">
          <span class="small muted" data-progress></span>
          <div class="row">
            <button class="btn small ghost" type="button" data-hear>Hear it</button>
            <button class="btn small ghost" type="button" data-skip>Skip</button>
            <button class="btn small ghost" type="button" data-drone>Drone</button>
            <button class="btn small ghost" type="button" data-quit>Stop</button>
          </div>
        </div>
        <div class="meter" style="margin-top:.75rem"><i data-bar style="width:0%"></i></div>
      </div>

      <div class="card" data-done hidden></div>
    </div>
  `);
  container.replaceChildren(ui);

  const nameEl = $(ui, '[data-name]');
  const subEl = $(ui, '[data-sub]');
  const centsEl = $(ui, '[data-cents]');
  const fingerEl = $(ui, '[data-finger]');
  const zoneEl = $(ui, '[data-zone]');
  const holdEl = $(ui, '[data-hold]');
  const progressEl = $(ui, '[data-progress]');
  const barEl = $(ui, '[data-bar]');
  const doneEl = $(ui, '[data-done]');
  const board = renderFingerboard($(ui, '[data-board]'));

  const half = (tolerance / RANGE) * 50;
  zoneEl.style.left = `${50 - half}%`;
  zoneEl.style.width = `${half * 2}%`;

  let index = 0;
  let frames = 0;
  let stopListening = null;
  let drone = null;
  let finished = false;
  const record = [];

  function target() {
    return targets[index];
  }

  function show() {
    const midi = target();
    if (midi == null) return finish();

    frames = 0;
    holdEl.style.width = '0%';
    progressEl.textContent = `${index + 1} of ${targets.length}`;
    barEl.style.width = `${(index / targets.length) * 100}%`;

    nameEl.textContent = noteName(midi);
    nameEl.className = 'bignote-name';
    subEl.innerHTML = `${esc(fingeringBadge(midi))}
      ${holdSeconds >= 1 ? `<br><span class="muted small">hold it for ${holdSeconds} seconds</span>` : ''}`;
    centsEl.textContent = 'Play it';
    board.setNotes([{ midi }]);
  }

  function next(result) {
    record.push(result);
    index++;
    if (index >= targets.length) finish();
    else show();
  }

  function finish() {
    if (finished) return;
    finished = true;
    stopListening?.();
    drone?.stop();
    drone = null;

    const hit = record.filter((r) => r.passed);
    const withCents = record.filter((r) => r.cents != null);
    const avgCents = withCents.length
      ? withCents.reduce((s, r) => s + r.cents, 0) / withCents.length
      : null;
    const accuracy = record.length ? (hit.length / record.length) * 100 : 0;
    const passed = accuracy >= 80;

    barEl.style.width = '100%';
    nameEl.textContent = passed ? 'Passed' : 'Done';
    nameEl.className = `bignote-name${passed ? ' is-good' : ''}`;
    subEl.textContent = '';
    centsEl.textContent = '';
    board.clear();

    doneEl.hidden = false;
    doneEl.replaceChildren(h(`
      <div>
        <h3>${passed ? 'Nice — that counts as passed' : 'Not quite yet'}</h3>
        <div class="scorebar" style="margin:1rem 0">
          <div class="${passed ? 'good' : 'bad'}"><b>${Math.round(accuracy)}%</b>first try</div>
          <div><b>${hit.length}/${record.length}</b>in tune</div>
          ${avgCents != null ? `<div><b>${Math.round(avgCents)}</b>avg cents off</div>` : ''}
        </div>
        <p class="small muted">${passed
          ? 'Tighten the tolerance and run it again, or move on.'
          : 'Aim for 80%. Slow down — accuracy first, speed later.'}</p>
        <div class="row" style="margin-top:1rem">
          <button class="btn primary" type="button" data-again>Again</button>
          <button class="btn ghost" type="button" data-close>Close</button>
        </div>
      </div>
    `));
    $(doneEl, '[data-again]').addEventListener('click', restart);
    $(doneEl, '[data-close]').addEventListener('click', () => onComplete?.({
      passed, accuracy, avgCents, closed: true,
    }));

    onComplete?.({ passed, accuracy, avgCents, closed: false });
  }

  function restart() {
    finished = false;
    index = 0;
    record.length = 0;
    doneEl.hidden = true;
    show();
    if (gate.ready && !stopListening) stopListening = listen(onReading);
  }

  function onReading(reading) {
    if (finished) return;
    const midi = target();
    if (midi == null) return;

    if (!reading) {
      fingerEl.className = 'tuner-finger is-idle';
      board.setLive(null);
      frames = 0;
      holdEl.style.width = '0%';
      return;
    }

    board.setLive({ midi: reading.midi, cents: reading.cents, tolerance });

    if (reading.midi !== midi) {
      const off = (reading.midi - midi) * 100 + reading.cents;
      const clamped = Math.max(-RANGE, Math.min(RANGE, off));
      fingerEl.style.left = `${50 + (clamped / RANGE) * 50}%`;
      fingerEl.className = 'tuner-finger';
      nameEl.className = 'bignote-name is-off';
      centsEl.innerHTML = `Hearing <b class="mono">${esc(reading.name)}</b>`;
      frames = 0;
      holdEl.style.width = '0%';
      return;
    }

    const clamped = Math.max(-RANGE, Math.min(RANGE, reading.cents));
    fingerEl.style.left = `${50 + (clamped / RANGE) * 50}%`;

    const inTune = Math.abs(reading.cents) <= tolerance;
    fingerEl.className = `tuner-finger${inTune ? ' is-intune' : ''}`;
    nameEl.className = `bignote-name${inTune ? ' is-good' : ' is-off'}`;
    centsEl.innerHTML = inTune
      ? `<b>Hold it</b>`
      : `<b>${formatCents(reading.cents)}</b> cents ${reading.cents < 0 ? 'flat' : 'sharp'}`;

    if (inTune) {
      frames++;
      holdEl.style.width = `${Math.min(100, (frames / framesRequired) * 100)}%`;
      if (frames >= framesRequired) {
        playDing({ good: true });
        next({ midi, passed: true, cents: Math.abs(reading.cents) });
      }
    } else {
      frames = Math.max(0, frames - 2); // decay rather than reset, so a wobble is survivable
      holdEl.style.width = `${(frames / framesRequired) * 100}%`;
    }
  }

  $(ui, '[data-hear]').addEventListener('click', () => {
    const midi = target();
    if (midi != null) playNoteNow(midi, 1);
  });
  $(ui, '[data-skip]').addEventListener('click', () => {
    const midi = target();
    if (midi != null) next({ midi, passed: false, cents: null });
  });
  $(ui, '[data-quit]').addEventListener('click', finish);
  $(ui, '[data-drone]').addEventListener('click', (e) => {
    if (drone) {
      drone.stop();
      drone = null;
      e.target.classList.remove('primary');
      return;
    }
    const root = config.tonic ? midiFromName(config.tonic) : (targets[0] ?? 62);
    drone = startDrone(root);
    e.target.classList.add('primary');
  });

  const gate = micGate($(ui, '[data-gate]'), { label: 'Turn on the microphone for this drill' });
  gate.onReady(() => {
    stopListening?.();
    stopListening = listen(onReading);
  });

  show();

  return () => {
    stopListening?.();
    drone?.stop();
    gate.destroy();
  };
}

function buildTargets(config) {
  switch (config.type) {
    case 'openStrings':
      return STRINGS.map((s) => s.midi);

    case 'longTone':
      return (config.notes ?? ['D4', 'A4']).map(midiFromName);

    case 'scale': {
      const tonic = midiFromName(config.tonic ?? 'D4');
      const up = buildScale(tonic, config.quality ?? 'major', config.octaves ?? 1);
      // Up and back down, without repeating the top note.
      return [...up, ...up.slice(0, -1).reverse()];
    }

    case 'noteSet': {
      const pool = (config.notes ?? []).map(midiFromName);
      const rounds = config.rounds ?? pool.length;
      const out = [];
      let previous = null;
      for (let i = 0; i < rounds; i++) {
        let pick;
        // Avoid asking for the same note twice running — it reads as a bug.
        do { pick = pool[Math.floor(Math.random() * pool.length)]; }
        while (pool.length > 1 && pick === previous);
        out.push(pick);
        previous = pick;
      }
      return out;
    }

    default:
      return (config.notes ?? ['A4']).map(midiFromName);
  }
}
