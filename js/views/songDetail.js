import { allSongs, totalBeats, estimatedSeconds } from '../data/songs.js';
import { getUserSongs, getSongProgress } from '../store.js';
import { resolveNotes, formatNotation } from '../notation.js';
import { renderStaff } from '../ui/staff.js';
import { renderFingerboard, fingeringBadge } from '../ui/fingerboard.js';
import { playNoteNow } from '../audio/synth.js';
import { h, $, $$, esc, difficultyDots, pluralise } from '../ui/dom.js';

export function render(container, { id }) {
  const song = allSongs(getUserSongs()).find((s) => s.id === id);

  if (!song) {
    container.appendChild(h(`
      <header><span class="eyebrow">Songs</span><h1>No such song</h1></header>
      <p><a class="btn" href="#/songs">Back to songs</a></p>
    `));
    return () => {};
  }

  const needs = song.notes.length === 0;
  const resolved = needs ? [] : resolveNotes(song.notes);
  const progress = getSongProgress(song.id);
  const seconds = Math.round(estimatedSeconds(song));

  container.appendChild(h(`
    <header>
      <a class="small muted" href="#/songs" style="text-decoration:none">← Songs</a>
      <span class="eyebrow" style="margin-top:.75rem">${esc(song.composer)}</span>
      <h1>${esc(song.title)}</h1>
      <div class="row small muted" style="gap:.5rem;margin-bottom:1rem">
        <span class="chip">${esc(song.key)}</span>
        <span class="chip">${song.tempo} bpm</span>
        <span class="chip">${song.timeSignature.join('/')}</span>
        ${needs ? '<span class="chip warn">needs notes</span>'
                : `<span class="chip">${pluralise(song.notes.length, 'note')}</span>`}
        ${difficultyDots(song.difficulty)}
      </div>
      <p>${esc(song.about)}</p>
    </header>
  `));

  // --- actions
  container.appendChild(h(`
    <div class="card" style="border-color:${needs ? 'var(--rosin)' : 'var(--varnish)'}">
      ${needs ? `
        <h3>Add the notes to unlock this</h3>
        <p class="muted small">The guide below works right now. Practice mode, play-along
          and scoring need the melody.</p>
        <div class="row" style="margin-top:1rem">
          <a class="btn primary" href="#/songs/${esc(song.id)}/edit?tab=record">Play it in</a>
          <a class="btn" href="#/songs/${esc(song.id)}/edit?tab=midi">Import MIDI</a>
          <a class="btn ghost" href="#/songs/${esc(song.id)}/edit?tab=type">Type it</a>
        </div>
      ` : `
        <div class="spread">
          <div>
            <h3>Practise</h3>
            <p class="muted small" style="margin:0">
              ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} at ${song.tempo} bpm
              ${progress.runs ? ` · best ${Math.round(progress.bestAccuracy)}% over ${pluralise(progress.runs, 'run')}` : ''}
            </p>
          </div>
          <div class="row">
            <a class="btn primary" href="#/songs/${esc(song.id)}/practice?mode=learn">Learn mode</a>
            <a class="btn" href="#/songs/${esc(song.id)}/practice?mode=play">Play along</a>
            <a class="btn ghost small" href="#/songs/${esc(song.id)}/edit">Edit</a>
          </div>
        </div>
      `}
    </div>
  `));

  // --- guide
  container.appendChild(h(`
    <section style="margin-top:2.5rem">
      <h2>How to learn it</h2>
      <div class="stack" style="margin-top:1.25rem">
        ${song.guide.map((section) => `
          <article class="card">
            <h3>${esc(section.heading)}</h3>
            <p style="margin:0">${esc(section.body)}</p>
          </article>`).join('')}
      </div>
    </section>
  `));

  if (needs) return () => {};

  // --- notation
  const notation = h(`
    <section style="margin-top:2.5rem">
      <h2>The notes</h2>
      <p class="muted">Bow marks above the staff: <span class="mono">⊓</span> is a down-bow,
         <span class="mono">∨</span> is an up-bow. Notes under a curve share one bow stroke.</p>
      <div class="card" style="margin-top:1.25rem;overflow-x:auto" data-staff></div>
    </section>
  `);
  container.appendChild(notation);
  renderStaff($(notation, '[data-staff]'), resolved);

  // --- table + fingerboard preview
  const detail = h(`
    <section style="margin-top:2rem">
      <div class="grid two" style="align-items:start">
        <div class="card">
          <h3>Note by note</h3>
          <p class="muted small">Click a row to hear it and see the finger.</p>
          <div class="table-wrap" style="margin-top:1rem;max-height:420px;overflow-y:auto">
            <table class="notes">
              <thead>
                <tr><th>#</th><th>Note</th><th>String</th><th>Finger</th><th>Beats</th><th>Bow</th></tr>
              </thead>
              <tbody data-rows></tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h3>Fingering</h3>
          <div data-board style="max-width:200px;margin:1rem auto 0"></div>
          <p class="small muted" style="text-align:center;margin:1rem 0 0" data-caption>
            Click a note to see it here.</p>
        </div>
      </div>
    </section>
  `);
  container.appendChild(detail);

  const board = renderFingerboard($(detail, '[data-board]'));
  const caption = $(detail, '[data-caption]');
  const rows = $(detail, '[data-rows]');

  let lastSection = null;
  resolved.forEach((note, index) => {
    const isNewSection = note.section !== lastSection;
    lastSection = note.section;

    if (isNewSection && note.section) {
      rows.appendChild(h(`
        <tr data-section-start><td colspan="6" class="small"
          style="color:var(--varnish);font-family:var(--mono);letter-spacing:.08em;
                 text-transform:uppercase;font-size:.68rem;padding-top:.9rem">
          ${esc(note.section)}</td></tr>
      `));
    }

    const row = h(`
      <tr style="cursor:pointer">
        <td class="muted mono small">${index + 1}</td>
        <td class="n">${note.rest ? '<span class="muted">rest</span>' : esc(note.name)}</td>
        <td>${note.rest ? '—' : esc(note.fingering.string)}</td>
        <td>${note.rest ? '—' : (note.fingering.finger === 0 ? 'open' : esc(note.fingering.label))}</td>
        <td class="mono small">${note.beats}</td>
        <td class="mono">${note.bowSymbol ?? ''}${note.slurred ? '<span class="muted small"> slur</span>' : ''}</td>
      </tr>
    `);

    row.addEventListener('click', () => {
      $$(rows, 'tr').forEach((r) => r.classList.remove('is-current'));
      row.classList.add('is-current');
      if (note.rest) {
        board.clear();
        caption.textContent = 'Rest — lift or stop the bow.';
        return;
      }
      playNoteNow(note.midi, Math.max(0.4, note.beats * (60 / song.tempo)));
      board.setNotes([{ midi: note.midi }]);
      caption.innerHTML = `<b class="mono" style="color:var(--parchment)">${esc(note.name)}</b>
        — ${esc(fingeringBadge(note.midi))}, ${note.bow === 'down' ? 'down-bow ⊓' : 'up-bow ∨'}`;
    });

    rows.appendChild(row);
  });

  // --- shorthand
  container.appendChild(h(`
    <section style="margin-top:2rem">
      <details class="card">
        <summary style="cursor:pointer;font-weight:500">See it as text</summary>
        <p class="muted small" style="margin-top:.75rem">This is the same format the editor
          uses. Copy it, change it, paste it back.</p>
        <pre class="mono small" style="margin:0;white-space:pre-wrap;color:var(--parchment-mid);
             background:var(--ebony);padding:1rem;border-radius:6px;overflow-x:auto"
        >${esc(formatNotation(song.notes, { timeSignature: song.timeSignature }))}</pre>
      </details>
    </section>
  `));

  return () => {};
}
