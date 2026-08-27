// Scales: pick one, then grind it.
//
// Every scale that fits in first position is offered, and only those — a
// picker that lets you choose something unplayable and then fails is worse
// than one that never offers it. Turn Loop on and it restarts itself as soon
// as you finish, counting reps, so you can keep going without touching
// anything between runs.

import {
  scale as buildScale, fingeringFor, noteName, midiFromName,
  LOWEST_MIDI, HIGHEST_MIDI,
} from '../theory.js';
import {
  getScaleStats, getAllScaleStats, recordScaleRep, logPractice,
  getSettings, setSetting,
} from '../store.js';
import { runDrill } from '../ui/drill.js';
import { h, $, $$, esc, pluralise } from '../ui/dom.js';
import { toast } from '../app.js';

const QUALITIES = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
];

const DIRECTIONS = [
  { id: 'updown', label: 'Up & down' },
  { id: 'up', label: 'Up only' },
  { id: 'down', label: 'Down only' },
];

/** Scales a violin can actually play without leaving first position. */
function isPlayable(tonicMidi, quality, octaves) {
  return buildScale(tonicMidi, quality, octaves).every((m) => fingeringFor(m) !== null);
}

function tonicsFor(quality, octaves) {
  const out = [];
  for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi++) {
    if (isPlayable(midi, quality, octaves)) out.push(midi);
  }
  return out;
}

export function render(container) {
  const settings = getSettings();

  let quality = settings.scaleQuality ?? 'major';
  let octaves = settings.scaleOctaves ?? 1;
  let direction = settings.scaleDirection ?? 'updown';
  let tonic = midiFromName(settings.scaleTonic ?? 'D4') ?? midiFromName('D4');
  let tolerance = settings.tolerance;
  let looping = false;
  let repsThisSession = 0;
  let drillCleanup = null;
  let restartTimer = null;

  container.appendChild(h(`
    <header>
      <span class="eyebrow">Scales</span>
      <h1>Pick one and grind it</h1>
      <p>Every scale here fits in first position. Turn on Loop and it starts again the
         moment you finish, so you can keep running it without stopping to click.</p>
    </header>
  `));

  const picker = h(`
    <div class="card">
      <div class="grid two" style="gap:1.25rem">
        <div class="field">
          <label>Quality</label>
          <div class="row" data-quality></div>
        </div>
        <div class="field">
          <label>Octaves</label>
          <div class="row" data-octaves></div>
        </div>
      </div>

      <div class="field" style="margin-top:1.25rem">
        <label>Starting note <span class="muted small" data-tonic-hint></span></label>
        <div class="row" data-tonics style="gap:.4rem"></div>
      </div>

      <div class="grid two" style="gap:1.25rem;margin-top:1.25rem">
        <div class="field">
          <label>Direction</label>
          <div class="row" data-direction></div>
        </div>
        <div class="field">
          <label for="tol3">In tune within
            <b class="mono" data-tol-value>${tolerance}</b> cents</label>
          <input id="tol3" type="range" min="5" max="50" step="1" value="${tolerance}">
        </div>
      </div>
    </div>
  `);
  container.appendChild(picker);

  const summary = h(`
    <div class="card" style="margin-top:1rem;border-color:var(--varnish)">
      <div class="spread">
        <div style="min-width:0">
          <h2 style="margin:0 0 .2rem" data-name></h2>
          <p class="muted small" style="margin:0" data-range></p>
          <p class="small mono" style="margin:.4rem 0 0;color:var(--parchment-dim)" data-stats></p>
        </div>
        <div class="task-actions">
          <label class="row small" style="cursor:pointer;margin-right:.25rem">
            <input type="checkbox" data-loop style="width:auto"> Loop
          </label>
          <button class="btn primary" type="button" data-start>Start</button>
        </div>
      </div>
    </div>
  `);
  container.appendChild(summary);

  const drillHost = h('<div style="margin-top:1rem"></div>');
  container.appendChild(drillHost);

  const nameEl = $(summary, '[data-name]');
  const rangeEl = $(summary, '[data-range]');
  const statsEl = $(summary, '[data-stats]');
  const loopBox = $(summary, '[data-loop]');
  const startBtn = $(summary, '[data-start]');

  function scaleId() {
    return `${noteName(tonic)}-${quality}-${octaves}oct`;
  }

  function scaleName() {
    return `${noteName(tonic).replace(/\d/, '')} ${quality}`;
  }

  function stopDrill() {
    clearTimeout(restartTimer);
    restartTimer = null;
    drillCleanup?.();
    drillCleanup = null;
  }

  // --- pickers, all rebuilt together so an impossible combination cannot be
  // left selected (two-octave scales only start low enough on a few notes).
  function paintPickers() {
    const qualityEl = $(picker, '[data-quality]');
    qualityEl.replaceChildren(...QUALITIES.map((q) => {
      const btn = h(`<button class="btn small${q.id === quality ? ' primary' : ' ghost'}"
        type="button">${esc(q.label)}</button>`);
      btn.addEventListener('click', () => { quality = q.id; reconcile(); });
      return btn;
    }));

    const octEl = $(picker, '[data-octaves]');
    octEl.replaceChildren(...[1, 2].map((n) => {
      const available = tonicsFor(quality, n).length > 0;
      const btn = h(`<button class="btn small${n === octaves ? ' primary' : ' ghost'}"
        type="button" ${available ? '' : 'disabled'}>${n}</button>`);
      btn.addEventListener('click', () => { octaves = n; reconcile(); });
      return btn;
    }));

    const dirEl = $(picker, '[data-direction]');
    dirEl.replaceChildren(...DIRECTIONS.map((d) => {
      const btn = h(`<button class="btn small${d.id === direction ? ' primary' : ' ghost'}"
        type="button">${esc(d.label)}</button>`);
      btn.addEventListener('click', () => { direction = d.id; reconcile(); });
      return btn;
    }));

    const options = tonicsFor(quality, octaves);
    $(picker, '[data-tonic-hint]').textContent =
      `— ${pluralise(options.length, 'option')} in first position`;

    const tonicEl = $(picker, '[data-tonics]');
    tonicEl.replaceChildren(...options.map((midi) => {
      const name = noteName(midi);
      const btn = h(`<button class="btn small${midi === tonic ? ' primary' : ' ghost'}"
        type="button" style="min-width:52px">${esc(name)}</button>`);
      btn.addEventListener('click', () => { tonic = midi; reconcile(); });
      return btn;
    }));
  }

  function paintSummary() {
    const notes = buildScale(tonic, quality, octaves);
    const count = direction === 'updown' ? notes.length * 2 - 1 : notes.length;
    const stats = getScaleStats(scaleId());

    nameEl.textContent = `${scaleName()}, ${pluralise(octaves, 'octave')}`;
    rangeEl.textContent =
      `${noteName(notes[0])} to ${noteName(notes.at(-1))} · ${pluralise(count, 'note')} · `
      + DIRECTIONS.find((d) => d.id === direction).label.toLowerCase();
    statsEl.textContent = stats.reps
      ? `${pluralise(stats.reps, 'rep')} all time · best ${Math.round(stats.best)}%`
        + (repsThisSession ? ` · ${repsThisSession} today` : '')
      : 'Not played yet';
  }

  /** Keep the selection valid, save it, and redraw. */
  function reconcile() {
    const options = tonicsFor(quality, octaves);
    if (!options.length) {
      octaves = 1;
      return reconcile();
    }
    if (!options.includes(tonic)) {
      // Nearest playable starting note, so switching to two octaves does not
      // silently dump you somewhere unrelated.
      tonic = options.reduce((best, m) =>
        Math.abs(m - tonic) < Math.abs(best - tonic) ? m : best, options[0]);
    }

    setSetting('scaleQuality', quality);
    setSetting('scaleOctaves', octaves);
    setSetting('scaleDirection', direction);
    setSetting('scaleTonic', noteName(tonic));

    paintPickers();
    paintSummary();

    // Changing the scale invalidates whatever is running.
    if (drillCleanup) {
      stopDrill();
      drillHost.replaceChildren();
      startBtn.textContent = 'Start';
    }
  }

  function start() {
    stopDrill();
    drillHost.replaceChildren();
    startBtn.textContent = 'Restart';

    const config = {
      id: `scale:${scaleId()}:${direction}`,
      type: 'scale',
      tonic: noteName(tonic),
      quality,
      octaves,
      direction,
      tolerance,
    };

    drillCleanup = runDrill(drillHost, config, (result) => {
      if (result.closed) {
        stopDrill();
        drillHost.replaceChildren();
        startBtn.textContent = 'Start';
        return;
      }

      repsThisSession++;
      recordScaleRep(scaleId(), result.accuracy);
      logPractice(2);
      paintSummary();
      paintHistory();

      if (looping) {
        toast(`Rep ${repsThisSession} — ${Math.round(result.accuracy)}%. Going again.`);
        // A beat to breathe, and to let the last note stop ringing.
        restartTimer = setTimeout(start, 1400);
      }
    });

    drillHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  loopBox.addEventListener('change', () => {
    looping = loopBox.checked;
    if (!looping) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  });

  startBtn.addEventListener('click', start);

  const tolInput = $(picker, '#tol3');
  tolInput.addEventListener('input', () => {
    tolerance = Number(tolInput.value);
    $(picker, '[data-tol-value]').textContent = tolerance;
    setSetting('tolerance', tolerance);
  });

  // --- what you have been grinding
  const history = h(`
    <section style="margin-top:2.5rem">
      <h2>Your scales</h2>
      <div data-history style="margin-top:1.25rem"></div>
    </section>
  `);
  container.appendChild(history);

  function paintHistory() {
    const all = Object.entries(getAllScaleStats())
      .filter(([, stat]) => stat.reps > 0)
      .sort((a, b) => b[1].reps - a[1].reps);

    const host = $(history, '[data-history]');
    if (!all.length) {
      host.replaceChildren(h(
        '<p class="muted small" style="margin:0">Nothing yet. Reps are counted per scale and '
        + 'kept for good, so this fills in as you grind.</p>'));
      return;
    }

    host.replaceChildren(h(`
      <div class="table-wrap">
        <table class="notes">
          <thead><tr><th>Scale</th><th>Reps</th><th>Best</th><th>Last</th><th></th></tr></thead>
          <tbody>
            ${all.map(([id, stat]) => {
              const [tonicName, qual, oct] = id.split('-');
              return `<tr>
                <td class="n">${esc(tonicName.replace(/\d/, ''))} ${esc(qual)}
                  <span class="muted small">${esc(oct)}</span></td>
                <td class="mono">${stat.reps}</td>
                <td class="mono">${Math.round(stat.best)}%</td>
                <td class="muted small">${esc(stat.lastAt ?? '')}</td>
                <td><button class="btn small ghost" type="button"
                    data-pick="${esc(id)}">Practise</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `));

    $$(host, 'button[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [tonicName, qual, oct] = btn.dataset.pick.split('-');
        tonic = midiFromName(tonicName);
        quality = qual;
        octaves = Number(oct.replace('oct', ''));
        reconcile();
        summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  container.appendChild(h(`
    <div class="card" style="margin-top:2.5rem">
      <h3>How to actually practise a scale</h3>
      <p class="small muted">Slow enough that every note is right, every time. Turn the drone
        on inside the drill and listen for each note settling against it — that contrast is far
        easier to hear than a note on its own, and it is the fastest way to build intonation.</p>
      <p class="small muted" style="margin:0">Once a scale is clean at 25 cents, tighten the
        tolerance to 15 and run it again. That is a much better use of ten minutes than moving
        on to a new key.</p>
    </div>
  `));

  reconcile();
  paintHistory();

  return () => { stopDrill(); };
}
