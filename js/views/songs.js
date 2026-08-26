import { allSongs, totalBeats, estimatedSeconds } from '../data/songs.js';
import { getUserSongs, getSongProgress } from '../store.js';
import { h, $, esc, difficultyDots, pluralise } from '../ui/dom.js';

export function render(container) {
  const songs = allSongs(getUserSongs());

  container.appendChild(h(`
    <header>
      <span class="eyebrow">Songs</span>
      <h1>Your pieces</h1>
      <p>Work down the list — they are ordered by how hard they are. Each one has a
         guide, a note-by-note practice mode that listens, and a play-along.</p>
    </header>
  `));

  const ready = songs.filter((s) => s.notes.length > 0);
  const pending = songs.filter((s) => s.notes.length === 0);

  if (ready.length) {
    container.appendChild(h(`
      <div class="grid two">${ready.map(card).join('')}</div>
    `));
  }

  if (pending.length) {
    container.appendChild(h(`
      <section style="margin-top:2.5rem">
        <h2>Waiting on notes</h2>
        <p class="muted" style="margin-bottom:1.25rem">These have a full practice guide
          already. Add the melody — play it in, import a MIDI file, or type it — and every
          other feature switches on for them.</p>
        <div class="grid two">${pending.map(card).join('')}</div>
      </section>
    `));
  }

  container.appendChild(h(`
    <div class="card" style="margin-top:2.5rem">
      <div class="spread">
        <div>
          <h3>Add your own</h3>
          <p class="muted small" style="margin:0">Any melody you can play, hum, or find a
            MIDI of. It gets the same fingering, listening and scoring as the rest.</p>
        </div>
        <a class="btn primary" href="#/songs/new/edit">New song</a>
      </div>
    </div>
  `));

  return () => {};
}

function card(song) {
  const progress = getSongProgress(song.id);
  const needs = song.notes.length === 0;
  const seconds = needs ? 0 : Math.round(estimatedSeconds(song));

  return `
    <a class="songcard" href="#/songs/${esc(song.id)}">
      <div class="spread" style="align-items:flex-start">
        <div style="min-width:0">
          <h3>${esc(song.title)}</h3>
          <p class="composer">${esc(song.composer)}${song.year ? ` · ${song.year}` : ''}</p>
        </div>
        ${difficultyDots(song.difficulty)}
      </div>

      <div class="row small muted" style="gap:.5rem">
        <span class="chip">${esc(song.key)}</span>
        <span class="chip">${song.tempo} bpm</span>
        ${needs
          ? '<span class="chip warn">needs notes</span>'
          : `<span class="chip">${pluralise(song.notes.length, 'note')}</span>`}
        ${song.editedByUser ? '<span class="chip good">yours</span>' : ''}
      </div>

      <p class="small muted" style="margin:.9rem 0 0">${esc(song.about)}</p>

      ${!needs && progress.runs
        ? `<div style="margin-top:1rem">
             <div class="spread small muted" style="margin-bottom:.35rem">
               <span>Best accuracy</span><b class="mono">${Math.round(progress.bestAccuracy)}%</b>
             </div>
             <div class="meter${progress.bestAccuracy >= 80 ? ' good' : ''}">
               <i style="width:${Math.min(100, progress.bestAccuracy)}%"></i>
             </div>
           </div>`
        : !needs
          ? `<p class="small muted" style="margin:.9rem 0 0;opacity:.7">
               ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · not played yet</p>`
          : ''}
    </a>`;
}
