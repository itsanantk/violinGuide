// The first-position chart.
//
// One board, with everything about a note beside it: what you are playing right
// now on top, and whatever you last clicked underneath. Both live on the same
// diagram — a clicked note is drawn on the marks layer, your live pitch on the
// live layer — so you can set a target and watch how close you actually land.

import { STRINGS, FIRST_POSITION_SPAN, noteName, fingeringFor, allFingeringsFor, midiFromName }
  from '../theory.js';
import { playNoteNow } from '../audio/synth.js';
import { listen } from '../audio/mic.js';
import { getSettings } from '../store.js';
import { renderFingerboard, fingeringBadge } from '../ui/fingerboard.js';
import { h, $, $$, esc, micGate, formatCents } from '../ui/dom.js';

export function render(container) {
  container.appendChild(h(`
    <header>
      <span class="eyebrow">Fingerboard</span>
      <h1>Every note in first position</h1>
      <p>Play something and it lights up on the board. Click a spot to hear it. The gaps
         get smaller as you go up the string — that is real, not a drawing mistake, and it
         is why your fingers have to bunch closer together for the higher notes.</p>
    </header>
  `));

  const gateHost = h('<div style="margin-bottom:1rem"></div>');
  container.appendChild(gateHost);

  const layout = h(`
    <div class="grid two" style="align-items:start">
      <div class="card">
        <div data-board></div>
        <p class="small muted" style="text-align:center;margin:1rem 0 0">
          Dashed lines are where the tapes go. The amber dot is what you are playing.</p>
      </div>

      <div class="stack">
        <div class="card" style="border-color:var(--varnish)">
          <span class="eyebrow">Playing now</span>
          <div class="bignote-name" data-live-name style="font-size:3rem;line-height:1">—</div>
          <div class="bignote-sub" data-live-sub>Play a note.</div>
          <p class="tuner-cents" data-live-cents
             style="text-align:left;margin:.6rem 0 0;font-size:.95rem"></p>
        </div>

        <div class="card" data-detail></div>
      </div>
    </div>
  `);
  container.appendChild(layout);

  const detail = $(layout, '[data-detail]');
  const liveName = $(layout, '[data-live-name]');
  const liveSub = $(layout, '[data-live-sub]');
  const liveCents = $(layout, '[data-live-cents]');

  const board = renderFingerboard($(layout, '[data-board]'), {
    showAllNotes: true,
    interactive: true,
    onSelect: (fingering) => select(fingering.midi),
  });

  // --- the note you clicked -----------------------------------------------

  function select(midi) {
    playNoteNow(midi, 0.8);
    board.setNotes([{ midi }]);

    const options = allFingeringsFor(midi);
    const primary = fingeringFor(midi);

    detail.replaceChildren(h(`
      <div>
        <span class="eyebrow">Selected</span>
        <div class="spread" style="align-items:baseline;margin-bottom:.75rem">
          <h3 style="font-size:2rem;margin:0">${esc(noteName(midi))}</h3>
          <span class="mono small" style="color:var(--varnish)">${esc(fingeringBadge(midi))}</span>
        </div>
        <table class="notes">
          <thead><tr><th>String</th><th>Finger</th><th>Feel</th></tr></thead>
          <tbody>
            ${options.map((o) => `
              <tr${o.stringIndex === primary.stringIndex ? ' class="is-current"' : ''}>
                <td class="n">${o.string}</td>
                <td>${o.finger === 0 ? 'open' : o.label}</td>
                <td class="muted small">${describeTone(o)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${options.length > 1
          ? '<p class="small muted" style="margin:.75rem 0 0">More than one place works. '
            + 'The highlighted row is the usual choice — it keeps your hand lower and lets '
            + 'the open string ring.</p>'
          : ''}
      </div>
    `));
  }

  // --- what you are playing ------------------------------------------------

  let stopListening = null;

  function paintLive(reading) {
    if (!reading) {
      liveName.textContent = '—';
      liveName.className = 'bignote-name';
      liveSub.textContent = 'Play a note.';
      liveCents.textContent = '';
      board.setLive(null);
      return;
    }

    const tolerance = getSettings().tolerance;
    const inTune = Math.abs(reading.cents) <= tolerance;
    const fingering = fingeringFor(reading.midi);

    liveName.textContent = reading.name;
    liveName.className = `bignote-name${inTune ? ' is-good' : ' is-off'}`;
    liveSub.innerHTML = fingering
      ? esc(fingeringBadge(reading.midi))
      : '<span class="muted">outside first position</span>';

    // How far off the nearest note you are — the number a needle tuner hides.
    liveCents.innerHTML = inTune
      ? `<b>In tune</b> · ${formatCents(reading.cents)} cents`
      : `<b>${formatCents(reading.cents)}</b> cents `
        + `${reading.cents < 0 ? 'flat of' : 'sharp of'} ${esc(reading.name)}`;

    board.setLive({ midi: reading.midi, cents: reading.cents, tolerance });
  }

  const gate = micGate(gateHost, { label: 'Turn on the microphone to see what you play' });
  gate.onReady(() => {
    stopListening?.();
    stopListening = listen(paintLive, { a4: getSettings().a4 });
  });
  paintLive(null);

  // --- the whole chart ------------------------------------------------------

  const chart = h(`
    <div class="card" style="margin-top:1rem">
      <div class="spread" style="align-items:baseline;margin-bottom:1rem">
        <h3 style="margin:0">The whole chart</h3>
        <span class="small muted">Each row is one string, open note up to 4th finger.</span>
      </div>
      <div class="table-wrap">
        <table class="notes">
          <thead>
            <tr><th>String</th>${
              Array.from({ length: FIRST_POSITION_SPAN + 1 }, (_, i) =>
                `<th>${i === 0 ? 'open' : `+${i}`}</th>`).join('')
            }</tr>
          </thead>
          <tbody>
            ${[...STRINGS].reverse().map((string) => `
              <tr>
                <td class="n" style="color:var(--varnish)">${string.name}</td>
                ${Array.from({ length: FIRST_POSITION_SPAN + 1 }, (_, i) => {
                  const midi = string.midi + i;
                  const f = fingeringFor(midi);
                  const canonical = f && f.stringIndex === string.index;
                  return `<td>
                    <button class="btn small ghost" data-midi="${midi}"
                      style="${canonical ? '' : 'opacity:.45'}"
                      title="${canonical ? 'Usual place for this note' : 'Playable here, but normally played on another string'}">
                      ${esc(noteName(midi))}
                    </button>
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="small muted" style="margin:.9rem 0 0">Faded notes are reachable there but
        usually played on a higher string instead.</p>
    </div>
  `);
  container.appendChild(chart);

  $$(chart, 'button[data-midi]').forEach((btn) => {
    btn.addEventListener('click', () => select(Number(btn.dataset.midi)));
  });

  select(midiFromName('F#4'));

  return () => {
    stopListening?.();
    gate.destroy();
  };
}

function describeTone(f) {
  if (f.finger === 0) return 'open string, nothing stopped';
  if (f.tone === 'low') return 'back toward the nut, touching the finger below';
  if (f.tone === 'high') return 'right up against the next finger';
  return 'normal spacing';
}
