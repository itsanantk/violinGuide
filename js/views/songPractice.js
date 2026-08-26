// Practising a song, in two modes.
//
// Learn mode waits for you: it holds on a note until the microphone hears it in
// tune, so you cannot rush past something wrong. Play-along does not wait — the
// song plays and you are scored against it in real time.
//
// Both share one definition of "in tune" (RunScorer) so a note that passes in
// learn mode is the same note that scores a hit in play-along.

import { allSongs } from '../data/songs.js';
import { getUserSongs, getSettings, setSetting, recordSongRun, logPractice } from '../store.js';
import { resolveNotes, withTimings, isRest } from '../notation.js';
import { listen } from '../audio/mic.js';
import { playNote, playDing, playNoteNow } from '../audio/synth.js';
import { SongPlayer, RunScorer } from '../audio/scheduler.js';
import { renderFingerboard, fingeringBadge } from '../ui/fingerboard.js';
import { renderStaff } from '../ui/staff.js';
import { createNoteLane } from '../ui/noteLane.js';
import { h, $, $$, esc, micGate, formatCents, pluralise } from '../ui/dom.js';
import { toast } from '../app.js';

export function render(container, { id, mode = 'learn' }) {
  const song = allSongs(getUserSongs()).find((s) => s.id === id);

  if (!song || song.notes.length === 0) {
    container.appendChild(h(`
      <header><span class="eyebrow">Practice</span><h1>Nothing to practise yet</h1></header>
      <p class="muted">${song ? 'This song still needs its notes.' : 'No such song.'}</p>
      <p><a class="btn" href="#/songs${song ? `/${esc(song.id)}` : ''}">Back</a></p>
    `));
    return () => {};
  }

  return mode === 'play'
    ? playAlong(container, song)
    : learnMode(container, song);
}

// =========================================================================
// Learn mode
// =========================================================================

function learnMode(container, song) {
  const settings = getSettings();
  const resolved = resolveNotes(song.notes);
  const sections = [...new Set(resolved.map((n) => n.section).filter(Boolean))];

  container.appendChild(h(`
    <header>
      <a class="small muted" href="#/songs/${esc(song.id)}" style="text-decoration:none">← ${esc(song.title)}</a>
      <span class="eyebrow" style="margin-top:.75rem">Learn mode</span>
      <h1>One note at a time</h1>
      <p>It waits for each note. Play it in tune and it moves on by itself — so you
         never practise past a mistake.</p>
    </header>
  `));

  const gateHost = h('<div></div>');
  container.appendChild(gateHost);

  const ui = h(`
    <div class="stack">
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
          <p class="tuner-cents" data-cents style="text-align:left;margin-top:.75rem">Waiting…</p>
        </div>
        <div class="bignote-aside" data-board></div>
      </div>

      <div class="card">
        <div class="spread" style="margin-bottom:.75rem">
          <span class="small muted" data-progress>Note 1 of ${resolved.length}</span>
          <div class="row">
            <button class="btn small ghost" type="button" data-hear>Hear it</button>
            <button class="btn small ghost" type="button" data-skip>Skip</button>
            <button class="btn small ghost" type="button" data-back>Back</button>
            <button class="btn small ghost" type="button" data-restart>Restart</button>
          </div>
        </div>
        <div class="meter"><i data-bar style="width:0%"></i></div>
      </div>

      <div class="card" style="overflow-x:auto" data-staff></div>

      <div class="card">
        <div class="grid two">
          <div class="field">
            <label for="loop">Practise section</label>
            <select id="loop">
              <option value="">Whole song</option>
              ${sections.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="tol2">In tune within
              <b class="mono" data-tol-value>${settings.tolerance}</b> cents</label>
            <input id="tol2" type="range" min="5" max="50" step="1" value="${settings.tolerance}">
          </div>
        </div>
        <label class="row small" style="margin-top:1rem;cursor:pointer">
          <input type="checkbox" data-autoplay style="width:auto" checked>
          Play each note for me before I try it
        </label>
      </div>

      <div class="card" data-summary hidden></div>
    </div>
  `);
  container.appendChild(ui);

  const nameEl = $(ui, '[data-name]');
  const subEl = $(ui, '[data-sub]');
  const centsEl = $(ui, '[data-cents]');
  const fingerEl = $(ui, '[data-finger]');
  const zoneEl = $(ui, '[data-zone]');
  const progressEl = $(ui, '[data-progress]');
  const barEl = $(ui, '[data-bar]');
  const summaryEl = $(ui, '[data-summary]');
  const board = renderFingerboard($(ui, '[data-board]'));
  const staff = renderStaff($(ui, '[data-staff]'), resolved);

  let tolerance = settings.tolerance;
  let queue = resolved;
  let index = 0;
  let holdFrames = 0;
  let stopListening = null;
  let advanceTimer = null;
  const scorer = new RunScorer(resolved, { tolerance });
  let started = Date.now();

  const RANGE = 50;
  const HOLD_REQUIRED = 6; // ~100ms at 60fps: long enough to reject a slide-through

  function paintZone() {
    const half = (tolerance / RANGE) * 50;
    zoneEl.style.left = `${50 - half}%`;
    zoneEl.style.width = `${half * 2}%`;
  }
  paintZone();

  function currentNote() {
    return queue[index];
  }

  function show() {
    const note = currentNote();
    if (!note) return finish();

    progressEl.textContent = `Note ${index + 1} of ${queue.length}`;
    barEl.style.width = `${(index / queue.length) * 100}%`;
    staff.setCurrent(note.index, note.index - 1);
    holdFrames = 0;

    if (note.rest) {
      nameEl.textContent = 'rest';
      nameEl.className = 'bignote-name muted';
      subEl.textContent = `${pluralise(note.beats, 'beat')} — stop the bow`;
      centsEl.textContent = '';
      board.clear();
      advanceTimer = setTimeout(next, 700);
      return;
    }

    nameEl.textContent = note.name;
    nameEl.className = 'bignote-name';
    subEl.innerHTML = `${esc(fingeringBadge(note.midi))}
      <span class="bignote-bow">${note.bowSymbol ?? ''}</span>
      ${note.slurred ? '<span class="muted small">slurred — keep the bow going</span>' : ''}
      ${note.section ? `<br><span class="muted">${esc(note.section)}</span>` : ''}`;
    centsEl.textContent = 'Play it';
    board.setNotes([{ midi: note.midi }]);

    if ($(ui, '[data-autoplay]').checked) {
      playNoteNow(note.midi, 0.5);
    }
  }

  function next() {
    clearTimeout(advanceTimer);
    index++;
    if (index >= queue.length) finish();
    else show();
  }

  function finish() {
    stopListening?.();
    const summary = scorer.summary();
    const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));

    barEl.style.width = '100%';
    nameEl.textContent = 'Done';
    nameEl.className = 'bignote-name is-good';
    subEl.textContent = `${queue.length} notes`;
    centsEl.textContent = '';

    recordSongRun(song.id, { accuracy: summary.accuracy, avgCents: summary.avgCents, mode: 'learn' });
    logPractice(minutes);

    summaryEl.hidden = false;
    summaryEl.replaceChildren(h(`
      <div>
        <h3>How that went</h3>
        <div class="scorebar" style="margin:1rem 0">
          <div class="good"><b>${Math.round(summary.accuracy)}%</b>in tune first try</div>
          <div><b>${summary.hits}</b>clean</div>
          <div class="bad"><b>${summary.close + summary.wrong + summary.missed}</b>needed work</div>
          ${summary.avgCents != null
            ? `<div><b>${Math.round(summary.avgCents)}</b>avg cents off</div>` : ''}
        </div>
        ${summary.trouble.length ? `
          <p class="small muted">Notes that gave you trouble:
            ${summary.trouble.map((t) => `<b class="mono">${esc(noteLabel(resolved, t.index))}</b>`).join(', ')}.
            Worth looping the section they are in.</p>` :
          '<p class="small muted">Nothing flagged. Try it at tempo in play-along.</p>'}
        <div class="row" style="margin-top:1rem">
          <button class="btn primary" type="button" data-again>Go again</button>
          <a class="btn" href="#/songs/${esc(song.id)}/practice?mode=play">Play along</a>
          <a class="btn ghost" href="#/songs/${esc(song.id)}">Back to the song</a>
        </div>
      </div>
    `));
    $(summaryEl, '[data-again]').addEventListener('click', restart);
    summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function onReading(reading) {
    const note = currentNote();
    if (!note || note.rest) return;

    if (!reading) {
      fingerEl.className = 'tuner-finger is-idle';
      board.setLive(null);
      holdFrames = 0;
      return;
    }

    board.setLive({ midi: reading.midi, cents: reading.cents, tolerance });
    scorer.observe(note.index, reading);

    if (reading.midi !== note.midi) {
      const off = (reading.midi - note.midi) * 100 + reading.cents;
      const clamped = Math.max(-RANGE, Math.min(RANGE, off));
      fingerEl.style.left = `${50 + (clamped / RANGE) * 50}%`;
      fingerEl.className = 'tuner-finger';
      nameEl.className = 'bignote-name is-off';
      centsEl.innerHTML = `Hearing <b class="mono">${esc(reading.name)}</b> —
        you want <b class="mono">${esc(note.name)}</b>`;
      holdFrames = 0;
      return;
    }

    const clamped = Math.max(-RANGE, Math.min(RANGE, reading.cents));
    fingerEl.style.left = `${50 + (clamped / RANGE) * 50}%`;

    const inTune = Math.abs(reading.cents) <= tolerance;
    fingerEl.className = `tuner-finger${inTune ? ' is-intune' : ''}`;
    nameEl.className = `bignote-name${inTune ? ' is-good' : ' is-off'}`;
    centsEl.innerHTML = inTune
      ? '<b>In tune — hold it</b>'
      : `<b>${formatCents(reading.cents)}</b> cents ${reading.cents < 0 ? 'flat' : 'sharp'}`;

    if (inTune) {
      holdFrames++;
      if (holdFrames >= HOLD_REQUIRED) {
        scorer.close(note.index);
        playDing({ good: true });
        next();
      }
    } else {
      holdFrames = 0;
    }
  }

  function restart() {
    clearTimeout(advanceTimer);
    index = 0;
    started = Date.now();
    scorer.reset(resolved);
    summaryEl.hidden = true;
    show();
    if (gate.ready && !stopListening) stopListening = listen(onReading, { a4: settings.a4 });
  }

  // --- controls
  $(ui, '[data-hear]').addEventListener('click', () => {
    const note = currentNote();
    if (note && !note.rest) playNoteNow(note.midi, 0.8);
  });
  $(ui, '[data-skip]').addEventListener('click', () => {
    const note = currentNote();
    if (note) scorer.close(note.index);
    next();
  });
  $(ui, '[data-back]').addEventListener('click', () => {
    clearTimeout(advanceTimer);
    index = Math.max(0, index - 1);
    show();
  });
  $(ui, '[data-restart]').addEventListener('click', restart);

  $(ui, '#loop').addEventListener('change', (e) => {
    const section = e.target.value;
    queue = section ? resolved.filter((n) => n.section === section) : resolved;
    index = 0;
    scorer.reset(resolved);
    summaryEl.hidden = true;
    show();
  });

  const tolInput = $(ui, '#tol2');
  tolInput.addEventListener('input', () => {
    tolerance = Number(tolInput.value);
    $(ui, '[data-tol-value]').textContent = tolerance;
    scorer.tolerance = tolerance;
    setSetting('tolerance', tolerance);
    paintZone();
  });

  const gate = micGate(gateHost, { label: 'Turn on the microphone to practise' });
  gate.onReady(() => {
    stopListening?.();
    stopListening = listen(onReading, { a4: settings.a4 });
  });

  show();

  return () => {
    stopListening?.();
    clearTimeout(advanceTimer);
    gate.destroy();
  };
}

function noteLabel(resolved, index) {
  return resolved[index]?.name ?? '?';
}

// =========================================================================
// Play-along
// =========================================================================

function playAlong(container, song) {
  const settings = getSettings();
  const resolved = resolveNotes(song.notes);
  const timed = withTimings(resolved, song.tempo);

  container.appendChild(h(`
    <header>
      <a class="small muted" href="#/songs/${esc(song.id)}" style="text-decoration:none">← ${esc(song.title)}</a>
      <span class="eyebrow" style="margin-top:.75rem">Play along</span>
      <h1>Play it with me</h1>
      <p>The site plays the song, you play over the top, and every note is marked as
         you go. Notes scroll toward the line; your pitch is the moving dot.</p>
    </header>
  `));

  container.appendChild(h(`
    <div class="card" style="border-color:var(--rosin);margin-bottom:1rem">
      <p class="small" style="margin:0"><b>Headphones make this work properly.</b>
        Through speakers the microphone hears the backing track as well as your violin,
        and scoring gets unreliable. If you have no headphones, turn off
        <em>Play the song</em> below and keep the metronome — you still get scored.</p>
    </div>
  `));

  const gateHost = h('<div></div>');
  container.appendChild(gateHost);

  const ui = h(`
    <div class="stack">
      <div class="lane">
        <canvas></canvas>
        <div class="lane-playhead"></div>
        <div class="lane-countin" data-countin hidden></div>
      </div>

      <div class="transport">
        <button class="btn primary" type="button" data-play>Start</button>
        <button class="btn" type="button" data-stop disabled>Stop</button>
        <div class="grow">
          <label class="small" for="tempo">Tempo
            <b class="mono" data-tempo-value>${song.tempo}</b> bpm
            (<span data-tempo-pct>100</span>%)</label>
          <input id="tempo" type="range" min="40" max="100" step="5" value="100">
        </div>
        <label class="row small" style="cursor:pointer">
          <input type="checkbox" data-metro style="width:auto" ${settings.metronome ? 'checked' : ''}>
          Metronome
        </label>
        <label class="row small" style="cursor:pointer">
          <input type="checkbox" data-playnotes style="width:auto" checked>
          Play the song
        </label>
      </div>

      <div class="card">
        <div class="scorebar">
          <div class="good"><b data-hits>0</b>in tune</div>
          <div><b data-closes>0</b>close</div>
          <div class="bad"><b data-misses>0</b>missed</div>
          <div><b data-pct>—</b>accuracy</div>
        </div>
      </div>

      <div class="card" data-summary hidden></div>
    </div>
  `);
  container.appendChild(ui);

  const canvas = $(ui, 'canvas');
  const lane = createNoteLane(canvas, timed, { beatsPerBar: song.timeSignature[0] });
  const countinEl = $(ui, '[data-countin]');
  const summaryEl = $(ui, '[data-summary]');

  const scorer = new RunScorer(resolved, { tolerance: settings.tolerance });
  let statuses = {};
  let live = null;
  let stopListening = null;
  let frame = null;
  let openNoteIndex = -1;
  let started = 0;

  const player = new SongPlayer(timed, {
    tempo: song.tempo,
    tempoScale: 1,
    metronome: settings.metronome,
    countIn: true,
    beatsPerBar: song.timeSignature[0],
    playNotes: true,
    onEnd: finish,
  });

  function paintScore() {
    const s = scorer.summary();
    $(ui, '[data-hits]').textContent = s.hits;
    $(ui, '[data-closes]').textContent = s.close;
    $(ui, '[data-misses]').textContent = s.wrong + s.missed;
    const seen = s.hits + s.close + s.wrong + s.missed;
    $(ui, '[data-pct]').textContent = seen ? `${Math.round((s.hits / seen) * 100)}%` : '—';
  }

  function loop() {
    frame = requestAnimationFrame(loop);
    const beat = player.running ? player.currentBeat() : 0;

    if (beat < 0) {
      const remaining = Math.ceil(-beat);
      countinEl.hidden = false;
      countinEl.textContent = String(remaining);
    } else {
      countinEl.hidden = true;
    }

    // Which note's window is open right now?
    const activeIndex = timed.findIndex((n) => beat >= n.startBeat && beat < n.endBeat);
    if (activeIndex !== openNoteIndex) {
      if (openNoteIndex >= 0) {
        scorer.close(timed[openNoteIndex].index);
        statuses = Object.fromEntries(scorer.results.map((r) => [r.index, r.status]));
        paintScore();
      }
      openNoteIndex = activeIndex;
    }
    if (activeIndex >= 0 && live) {
      scorer.observe(timed[activeIndex].index, live);
      statuses[timed[activeIndex].index] = scorer.results[timed[activeIndex].index]?.status;
    }

    lane.draw(beat, { statuses, live, tolerance: settings.tolerance });
  }

  async function start() {
    scorer.reset(resolved);
    statuses = {};
    openNoteIndex = -1;
    started = Date.now();
    summaryEl.hidden = true;
    paintScore();
    await player.start();
    $(ui, '[data-play]').disabled = true;
    $(ui, '[data-stop]').disabled = false;
  }

  function stop() {
    player.stop();
    countinEl.hidden = true;
    $(ui, '[data-play]').disabled = false;
    $(ui, '[data-stop]').disabled = true;
  }

  function finish() {
    stop();
    const s = scorer.summary();
    const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
    recordSongRun(song.id, { accuracy: s.accuracy, avgCents: s.avgCents, mode: 'play' });
    logPractice(minutes);

    summaryEl.hidden = false;
    summaryEl.replaceChildren(h(`
      <div>
        <h3>Run finished</h3>
        <div class="scorebar" style="margin:1rem 0">
          <div class="good"><b>${Math.round(s.accuracy)}%</b>accuracy</div>
          <div><b>${s.hits}/${s.total}</b>in tune</div>
          ${s.avgCents != null ? `<div><b>${Math.round(s.avgCents)}</b>avg cents off</div>` : ''}
        </div>
        <p class="small muted">${verdict(s)}</p>
        <div class="row" style="margin-top:1rem">
          <button class="btn primary" type="button" data-again>Again</button>
          <a class="btn" href="#/songs/${esc(song.id)}/practice?mode=learn">Learn mode</a>
          <a class="btn ghost" href="#/songs/${esc(song.id)}">Back to the song</a>
        </div>
      </div>
    `));
    $(summaryEl, '[data-again]').addEventListener('click', start);
    summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $(ui, '[data-play]').addEventListener('click', start);
  $(ui, '[data-stop]').addEventListener('click', stop);

  const tempoInput = $(ui, '#tempo');
  tempoInput.addEventListener('input', () => {
    const pct = Number(tempoInput.value);
    player.tempoScale = pct / 100;
    player.setNotes(resolved);
    $(ui, '[data-tempo-value]').textContent = Math.round(song.tempo * pct / 100);
    $(ui, '[data-tempo-pct]').textContent = pct;
  });

  $(ui, '[data-metro]').addEventListener('change', (e) => {
    player.metronome = e.target.checked;
    setSetting('metronome', e.target.checked);
  });
  $(ui, '[data-playnotes]').addEventListener('change', (e) => {
    player.playNotes = e.target.checked;
  });

  const gate = micGate(gateHost, {
    mode: 'playalong',
    label: 'Turn on the microphone to be scored',
  });
  gate.onReady(() => {
    stopListening?.();
    stopListening = listen((reading) => { live = reading; }, { a4: settings.a4 });
  });

  paintScore();
  loop();

  return () => {
    player.stop();
    stopListening?.();
    cancelAnimationFrame(frame);
    lane.destroy();
    gate.destroy();
  };
}

function verdict(s) {
  if (s.accuracy >= 90) return 'That is solid. Push the tempo up 10% and run it again.';
  if (s.accuracy >= 70) return 'Getting there. Drop the tempo a notch and aim for clean rather than fast.';
  if (s.accuracy >= 40) return 'Worth going back to learn mode for the sections that fell apart.';
  return 'Slow it right down — try 50% and learn mode first. Speed is the last thing to add.';
}
