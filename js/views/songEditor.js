// Getting notes into a song: play them, import them, or type them.

import { allSongs, SONGS } from '../data/songs.js';
import { getUserSongs, saveUserSong, deleteUserSong, getSettings } from '../store.js';
import {
  parseNotation, formatNotation, resolveNotes, transpose, suggestOctaveShift, isRest,
} from '../notation.js';
import { noteName, midiFromName } from '../theory.js';
import { Transcriber } from '../audio/transcribe.js';
import { parseMidi, trackToNotes, describeTrack } from '../data/midi.js';
import { playNoteNow } from '../audio/synth.js';
import { renderStaff } from '../ui/staff.js';
import { h, $, $$, esc, micGate, debounce, pluralise } from '../ui/dom.js';
import { toast } from '../app.js';

export function render(container, { id, tab = 'type' }) {
  const isNew = id === 'new';
  const existing = isNew ? null : allSongs(getUserSongs()).find((s) => s.id === id);

  if (!isNew && !existing) {
    container.appendChild(h(`
      <header><span class="eyebrow">Editor</span><h1>No such song</h1></header>
      <p><a class="btn" href="#/songs">Back to songs</a></p>
    `));
    return () => {};
  }

  const song = existing ?? {
    id: `custom-${Date.now()}`,
    title: '',
    composer: '',
    key: 'D major',
    tempo: 90,
    timeSignature: [4, 4],
    difficulty: 2,
    builtIn: false,
    strings: ['G', 'D', 'A', 'E'],
    about: 'Your own transcription.',
    guide: [],
    notes: [],
  };

  const isBuiltInShell = SONGS.some((s) => s.id === song.id);

  container.appendChild(h(`
    <header>
      <a class="small muted" href="#/songs${isNew ? '' : `/${esc(song.id)}`}"
         style="text-decoration:none">← ${isNew ? 'Songs' : esc(song.title)}</a>
      <span class="eyebrow" style="margin-top:.75rem">Editor</span>
      <h1>${isNew ? 'New song' : `Notes for ${esc(song.title)}`}</h1>
      <p>Three ways in. Play it and let the site write it down, import a MIDI file you
         have, or type it. Whichever you use, you can fix any note afterwards.</p>
    </header>
  `));

  // --- song details (new songs only need the full set)
  const details = h(`
    <div class="card">
      <h3>${isBuiltInShell ? 'Settings' : 'Details'}</h3>
      <div class="grid ${isBuiltInShell ? 'two' : 'three'}" style="margin-top:1rem">
        ${isBuiltInShell ? '' : `
          <div class="field">
            <label for="title">Title</label>
            <input id="title" type="text" value="${esc(song.title)}" placeholder="What is it called?">
          </div>
          <div class="field">
            <label for="composer">Composer or artist</label>
            <input id="composer" type="text" value="${esc(song.composer)}" placeholder="Who wrote it?">
          </div>`}
        <div class="field">
          <label for="tempo">Tempo (bpm)</label>
          <input id="tempo" type="number" min="30" max="220" value="${song.tempo}">
        </div>
        <div class="field">
          <label for="timesig">Beats per bar</label>
          <input id="timesig" type="number" min="2" max="12" value="${song.timeSignature[0]}">
        </div>
      </div>
    </div>
  `);
  container.appendChild(details);

  // --- tabs
  const tabs = h(`
    <nav class="row" style="margin:1.5rem 0 1rem" aria-label="How to add notes">
      <button class="btn small" type="button" data-tab="record">Play it in</button>
      <button class="btn small" type="button" data-tab="midi">Import MIDI</button>
      <button class="btn small" type="button" data-tab="type">Type it</button>
    </nav>
  `);
  container.appendChild(tabs);

  const panel = h('<div></div>');
  container.appendChild(panel);

  // --- shared text state
  const textarea = h(`<textarea spellcheck="false" aria-label="Notes"></textarea>`);
  textarea.value = song.notes.length
    ? formatNotation(song.notes, { timeSignature: song.timeSignature })
    : '';

  const preview = h(`
    <div class="card" style="margin-top:1.5rem">
      <div class="spread">
        <h3 style="margin:0">Preview</h3>
        <span class="small muted" data-count></span>
      </div>
      <div style="overflow-x:auto;margin-top:1rem" data-staff></div>
      <div class="editor-problems" data-problems></div>
      <div class="row" style="margin-top:1.25rem">
        <button class="btn primary" type="button" data-save>Save</button>
        <button class="btn ghost" type="button" data-hear>Hear it</button>
        ${isBuiltInShell && song.notes.length
          ? '<button class="btn ghost danger" type="button" data-reset>Remove my notes</button>'
          : ''}
        ${!isBuiltInShell && !isNew
          ? '<button class="btn ghost danger" type="button" data-delete>Delete song</button>'
          : ''}
      </div>
    </div>
  `);
  container.appendChild(preview);

  const problemsEl = $(preview, '[data-problems]');
  const countEl = $(preview, '[data-count]');
  const staffHost = $(preview, '[data-staff]');
  let parsed = { notes: [], errors: [], warnings: [] };
  let cleanupTab = null;

  function timeSignature() {
    return [Number($(details, '#timesig').value) || 4, 4];
  }

  function tempo() {
    return Number($(details, '#tempo').value) || 90;
  }

  function refresh() {
    parsed = parseNotation(textarea.value, { timeSignature: timeSignature() });
    const resolved = resolveNotes(parsed.notes);
    const outOfRange = resolved.filter((n) => n.outOfRange);

    const restCount = parsed.notes.filter(isRest).length;
    countEl.textContent = parsed.notes.length
      ? pluralise(parsed.notes.length - restCount, 'note')
        + (restCount ? `, ${pluralise(restCount, 'rest')}` : '')
      : 'Nothing yet';

    staffHost.replaceChildren();
    if (resolved.length) {
      renderStaff(staffHost, resolved.filter((n) => !n.outOfRange));
    }

    problemsEl.replaceChildren();
    for (const error of parsed.errors.slice(0, 8)) {
      problemsEl.appendChild(h(
        `<div class="problem error">Line ${error.line}: ${esc(error.message)}</div>`));
    }
    for (const warning of parsed.warnings.slice(0, 6)) {
      problemsEl.appendChild(h(
        `<div class="problem warn">Line ${warning.line}: ${esc(warning.message)}</div>`));
    }

    if (outOfRange.length) {
      const shift = suggestOctaveShift(parsed.notes);
      const names = [...new Set(outOfRange.map((n) => n.name))].slice(0, 6).join(', ');
      const box = h(`
        <div class="problem warn">
          ${pluralise(outOfRange.length, 'note')} outside first position (${esc(names)}).
          ${shift ? `<button class="btn small ghost" type="button" data-shift
                       style="margin-left:.5rem">Shift ${shift > 0 ? 'up' : 'down'}
                       ${Math.abs(shift) / 12} octave</button>` : ''}
        </div>
      `);
      problemsEl.appendChild(box);
      $(box, '[data-shift]')?.addEventListener('click', () => {
        textarea.value = formatNotation(transpose(parsed.notes, shift),
          { timeSignature: timeSignature() });
        refresh();
        toast('Shifted into first position.');
      });
    }
  }

  const refreshSoon = debounce(refresh, 200);
  textarea.addEventListener('input', refreshSoon);
  $(details, '#timesig').addEventListener('input', refreshSoon);

  // --- save
  $(preview, '[data-save]').addEventListener('click', () => {
    if (!parsed.notes.length) return toast('There are no notes to save yet.');

    const title = isBuiltInShell ? song.title : ($(details, '#title')?.value.trim() || '');
    if (!isBuiltInShell && !title) return toast('Give the song a title first.');

    saveUserSong({
      ...song,
      title: title || song.title,
      composer: isBuiltInShell ? song.composer : ($(details, '#composer')?.value.trim() || 'You'),
      tempo: tempo(),
      timeSignature: timeSignature(),
      needsNotes: false,
      notes: parsed.notes.map(({ avgCents, ...n }) => n),
    });
    toast('Saved.');
    location.hash = `#/songs/${song.id}`;
  });

  $(preview, '[data-hear]').addEventListener('click', async () => {
    const resolved = resolveNotes(parsed.notes).filter((n) => !n.rest && !n.outOfRange);
    const beatMs = 60000 / tempo();
    for (let i = 0; i < Math.min(resolved.length, 24); i++) {
      const note = resolved[i];
      setTimeout(() => playNoteNow(note.midi, (note.beats * beatMs) / 1000), i * 420);
    }
  });

  $(preview, '[data-reset]')?.addEventListener('click', () => {
    deleteUserSong(song.id);
    toast('Your notes were removed. The built-in guide is untouched.');
    location.hash = `#/songs/${song.id}`;
  });

  $(preview, '[data-delete]')?.addEventListener('click', () => {
    deleteUserSong(song.id);
    toast('Song deleted.');
    location.hash = '#/songs';
  });

  // --- tab switching
  function openTab(name) {
    cleanupTab?.();
    cleanupTab = null;
    panel.replaceChildren();
    $$(tabs, 'button').forEach((b) => {
      b.classList.toggle('primary', b.dataset.tab === name);
    });

    if (name === 'record') cleanupTab = recordPanel(panel, { textarea, tempo, timeSignature, refresh });
    else if (name === 'midi') cleanupTab = midiPanel(panel, { textarea, details, refresh });
    else cleanupTab = typePanel(panel, { textarea });
  }

  $$(tabs, 'button').forEach((btn) => {
    btn.addEventListener('click', () => openTab(btn.dataset.tab));
  });

  openTab(['record', 'midi', 'type'].includes(tab) ? tab : 'type');
  refresh();

  return () => { cleanupTab?.(); };
}

// -------------------------------------------------------------------------

function typePanel(panel, { textarea }) {
  const box = h(`
    <div class="grid two" style="align-items:start">
      <div class="card">
        <h3>Type the notes</h3>
        <p class="muted small">Separate with commas or new lines. It updates as you type.</p>
        <div data-host style="margin-top:1rem"></div>
      </div>
      <div class="card">
        <h3>The format</h3>
        <div class="legend">
          <b>D4</b> — note name and octave<br>
          <b>F#4</b> <b>Bb3</b> — sharps and flats<br>
          <b>D4 q</b> — quarter note (the default)<br>
          <b>w h q e s</b> — whole, half, quarter, eighth, sixteenth<br>
          <b>q.</b> — dotted, so 1.5 beats<br>
          <b>D4 1.5</b> — or just say how many beats<br>
          <b>rest q</b> — a rest (<b>r q</b> works too)<br>
          <b>(D4 q, E4 q)</b> — slur: one bow for both<br>
          <b>|</b> — bar line, checked against the beats per bar<br>
          <b># Chorus</b> — start a named section<br>
          <b>// text</b> — a note to yourself
        </div>
        <p class="small muted" style="margin:1rem 0 0">Open strings are G3, D4, A4 and E5.
          Middle C is C4.</p>
      </div>
    </div>
  `);
  panel.appendChild(box);
  $(box, '[data-host]').appendChild(textarea);
  textarea.placeholder = '# Verse\nD4 q, E4 q, F#4 q, G4 q |\n(A4 h, F#4 h) |\nrest q, D4 q., E4 e |';
  return () => {};
}

// -------------------------------------------------------------------------

function recordPanel(panel, { textarea, tempo, timeSignature, refresh }) {
  const settings = getSettings();

  const box = h(`
    <div class="stack">
      <div class="card">
        <h3>Play it and I will write it down</h3>
        <p class="muted small">Play the melody one phrase at a time, slowly and clearly, with
          a small gap between notes. Stop when you want, check what came out, then carry on —
          new notes are added to the end.</p>
        <div data-gate></div>
        <div class="row" style="margin-top:1rem">
          <button class="btn primary" type="button" data-rec>
            <span class="rec-dot"></span> Start recording
          </button>
          <button class="btn ghost" type="button" data-undo disabled>Undo last note</button>
          <button class="btn ghost" type="button" data-clear disabled>Clear</button>
          <button class="btn" type="button" data-append disabled>Add to the song</button>
        </div>
        <p class="small muted" style="margin:1rem 0 0" data-status>Not recording.</p>
        <div class="captured" data-captured></div>
      </div>
      <div class="card">
        <h3>Getting a clean result</h3>
        <p class="small muted" style="margin:0">Leave a small gap between notes — that gap is
          how the site knows where one ends. Repeated notes especially: bow them separately
          or they merge into one long note. Play at a steady speed close to the tempo above,
          since durations are measured against it. Anything that comes out wrong is quicker to
          fix in the text than to re-record.</p>
      </div>
    </div>
  `);
  panel.appendChild(box);

  const statusEl = $(box, '[data-status]');
  const capturedEl = $(box, '[data-captured]');
  const recBtn = $(box, '[data-rec]');
  const undoBtn = $(box, '[data-undo]');
  const clearBtn = $(box, '[data-clear]');
  const appendBtn = $(box, '[data-append]');

  const transcriber = new Transcriber({
    tempo: tempo(),
    a4: settings.a4,
    onChange: paint,
  });

  function paint({ notes, live }) {
    capturedEl.replaceChildren();
    notes.slice(-60).forEach((note) => {
      capturedEl.appendChild(h(
        `<span class="${isRest(note) ? 'rest' : ''}">${
          isRest(note) ? 'rest' : esc(note.note)} ${note.beats}</span>`));
    });
    if (live) {
      capturedEl.appendChild(h(
        `<span class="fresh">${esc(live.name)} …</span>`));
    }
    const real = notes.filter((n) => !isRest(n)).length;
    undoBtn.disabled = clearBtn.disabled = appendBtn.disabled = notes.length === 0;
    if (transcriber.running) {
      statusEl.textContent = live
        ? `Hearing ${live.name}. ${pluralise(real, 'note')} so far.`
        : `Listening. ${pluralise(real, 'note')} so far.`;
    }
    capturedEl.scrollTop = capturedEl.scrollHeight;
  }

  function toggle() {
    if (transcriber.running) {
      transcriber.stop();
      recBtn.classList.remove('is-recording');
      recBtn.innerHTML = '<span class="rec-dot"></span> Start recording';
      box.classList.remove('is-recording');
      statusEl.textContent =
        `Stopped. ${pluralise(transcriber.notes.filter((n) => !isRest(n)).length, 'note')} captured.`;
      return;
    }
    transcriber.tempo = tempo();
    transcriber.start();
    recBtn.classList.add('is-recording');
    recBtn.innerHTML = '<span class="rec-dot"></span> Stop';
    box.classList.add('is-recording');
    statusEl.textContent = 'Listening — play a note.';
  }

  recBtn.addEventListener('click', toggle);
  undoBtn.addEventListener('click', () => transcriber.undo());
  clearBtn.addEventListener('click', () => transcriber.clear());

  appendBtn.addEventListener('click', () => {
    if (transcriber.running) toggle();
    const clean = transcriber.notes.map(({ avgCents, ...n }) => n);
    const text = formatNotation(clean, { timeSignature: timeSignature() });
    textarea.value = textarea.value.trim()
      ? `${textarea.value.trim()}\n${text}`
      : text;
    refresh();
    transcriber.clear();
    toast(`Added ${pluralise(clean.filter((n) => !isRest(n)).length, 'note')}.`);
  });

  const gate = micGate($(box, '[data-gate]'), { label: 'Turn on the microphone to record' });
  gate.onReady(() => { recBtn.disabled = false; });
  recBtn.disabled = !gate.ready;

  return () => {
    transcriber.stop();
    gate.destroy();
  };
}

// -------------------------------------------------------------------------

function midiPanel(panel, { textarea, details, refresh }) {
  const box = h(`
    <div class="stack">
      <div class="card">
        <h3>Import a MIDI file</h3>
        <p class="muted small">Pick a <span class="mono">.mid</span> file from your computer.
          Nothing is uploaded — it is read in the browser.</p>
        <div class="field" style="margin-top:1rem">
          <input type="file" accept=".mid,.midi,audio/midi" data-file>
        </div>
        <div data-result style="margin-top:1rem"></div>
      </div>
      <div class="card">
        <h3>What gets imported</h3>
        <p class="small muted" style="margin:0">A violin plays one note at a time, so chords
          are reduced to the top line — usually the melody. Pick the track that looks like the
          tune: the track list shows how many notes each one has and its range. If the result
          sits too low or too high for first position, there is a one-click octave shift on
          the preview below.</p>
      </div>
    </div>
  `);
  panel.appendChild(box);

  const resultEl = $(box, '[data-result]');

  $(box, '[data-file]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let midi;
    try {
      midi = parseMidi(await file.arrayBuffer());
    } catch (err) {
      resultEl.replaceChildren(h(
        `<div class="problem error">${esc(err.message)}</div>`));
      return;
    }

    const described = midi.tracks.map((t) => describeTrack(t, midi.ticksPerBeat)).filter(Boolean);
    if (!described.length) {
      resultEl.replaceChildren(h('<div class="problem error">No playable notes in that file.</div>'));
      return;
    }

    const tempoField = $(details, '#tempo');
    if (tempoField && midi.tempo) tempoField.value = midi.tempo;

    resultEl.replaceChildren(h(`
      <div>
        <p class="small muted">Found ${pluralise(described.length, 'track')} at
          ${midi.tempo} bpm. Pick the melody:</p>
        <div class="table-wrap">
          <table class="notes">
            <thead><tr><th>Track</th><th>Notes</th><th>Range</th><th></th></tr></thead>
            <tbody>
              ${described.map((t) => `
                <tr>
                  <td>${esc(t.name)}</td>
                  <td class="mono">${t.noteCount}</td>
                  <td class="mono small">${esc(noteName(t.lowest))}–${esc(noteName(t.highest))}</td>
                  <td><button class="btn small" type="button" data-track="${t.index}">Use this</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `));

    $$(resultEl, 'button[data-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const track = midi.tracks.find((t) => t.index === Number(btn.dataset.track));
        const notes = trackToNotes(track, midi.ticksPerBeat);
        if (!notes.length) return toast('That track had nothing usable.');

        const shift = suggestOctaveShift(notes);
        const finalNotes = shift ? transpose(notes, shift) : notes;
        const named = finalNotes.map((n) => (
          isRest(n) ? n : { ...n, note: noteName(n.midi) }
        ));

        textarea.value = formatNotation(named, { timeSignature: [4, 4] });
        refresh();
        toast(shift
          ? `Imported and shifted ${Math.abs(shift) / 12} octave to fit first position.`
          : `Imported ${pluralise(named.filter((n) => !isRest(n)).length, 'note')}.`);
      });
    });
  });

  return () => {};
}
