// The first-position chart: click any spot to hear it and see where it lives.

import { STRINGS, FIRST_POSITION_SPAN, noteName, fingeringFor, allFingeringsFor, midiFromName }
  from '../theory.js';
import { playNoteNow } from '../audio/synth.js';
import { renderFingerboard, fingeringBadge } from '../ui/fingerboard.js';
import { h, $, $$, esc } from '../ui/dom.js';

export function render(container) {
  container.appendChild(h(`
    <header>
      <span class="eyebrow">Fingerboard</span>
      <h1>Every note in first position</h1>
      <p>Click a spot on the board to hear it. The gaps get smaller as you go up the
         string — that is real, not a drawing mistake, and it is why your fingers have
         to bunch closer together for the higher notes.</p>
    </header>
  `));

  const layout = h(`
    <div class="grid two" style="align-items:start">
      <div class="card">
        <div data-board></div>
        <p class="small muted" style="text-align:center;margin:1rem 0 0">
          Dashed lines are where tapes go: 1st, 2nd, 3rd and 4th finger.</p>
      </div>
      <div class="stack">
        <div class="card" data-detail>
          <h3>Pick a note</h3>
          <p class="muted small">Click the fingerboard, or a row in the table below.</p>
        </div>
        <div class="card">
          <h3>Find a note</h3>
          <div class="field">
            <label for="find">Type a note name</label>
            <input id="find" type="text" placeholder="F#4" autocomplete="off" spellcheck="false">
          </div>
          <p class="small muted" data-find-result style="margin:.6rem 0 0"></p>
        </div>
      </div>
    </div>
  `);
  container.appendChild(layout);

  const detail = $(layout, '[data-detail]');

  const board = renderFingerboard($(layout, '[data-board]'), {
    showAllNotes: true,
    interactive: true,
    onSelect: (fingering) => select(fingering.midi),
  });

  function select(midi) {
    playNoteNow(midi, 0.8);
    board.setNotes([{ midi }]);

    const options = allFingeringsFor(midi);
    const primary = fingeringFor(midi);

    detail.replaceChildren(h(`
      <div>
        <span class="eyebrow">Selected</span>
        <h3 style="font-size:2.2rem;margin-bottom:.2rem">${esc(noteName(midi))}</h3>
        <p class="mono small" style="color:var(--varnish)">${esc(fingeringBadge(midi))}</p>
        <table class="notes" style="margin-top:1rem">
          <thead><tr><th>String</th><th>Finger</th><th>Feel</th></tr></thead>
          <tbody>
            ${options.map((o) => `
              <tr${o.stringIndex === primary.stringIndex ? ' class="is-current"' : ''}>
                <td class="n">${o.string}</td>
                <td>${o.finger === 0 ? 'open' : o.label}</td>
                <td class="muted">${describeTone(o)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${options.length > 1
          ? '<p class="small muted" style="margin-top:.75rem">More than one place works. '
            + 'The highlighted row is the usual choice — it keeps your hand lower and lets '
            + 'the open string ring.</p>'
          : ''}
      </div>
    `));
  }

  // Note finder
  const find = $(layout, '#find');
  const findResult = $(layout, '[data-find-result]');
  find.addEventListener('input', () => {
    const midi = midiFromName(find.value);
    if (midi == null) {
      findResult.textContent = find.value.trim() ? 'Not a note name. Try D4, F#4 or Bb3.' : '';
      return;
    }
    const fingering = fingeringFor(midi);
    if (!fingering) {
      findResult.textContent = `${noteName(midi)} is outside first position.`;
      return;
    }
    findResult.textContent = `${noteName(midi)} — ${fingeringBadge(midi)}`;
    select(midi);
  });

  // Full chart
  const chart = h(`
    <div class="card" style="margin-top:1rem">
      <h3>The whole chart</h3>
      <p class="muted small">Each row is one string, from the open note up to 4th finger.</p>
      <div class="table-wrap" style="margin-top:1rem">
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
      <p class="small muted" style="margin-top:.9rem">Faded notes are reachable there but
        usually played on a higher string instead.</p>
    </div>
  `);
  container.appendChild(chart);

  $$(chart, 'button[data-midi]').forEach((btn) => {
    btn.addEventListener('click', () => select(Number(btn.dataset.midi)));
  });

  select(midiFromName('F#4'));
  return () => {};
}

function describeTone(f) {
  if (f.finger === 0) return 'open string, nothing stopped';
  if (f.tone === 'low') return 'back toward the nut, touching the finger below';
  if (f.tone === 'high') return 'right up against the next finger';
  return 'normal spacing';
}
