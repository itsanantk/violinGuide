// Today: streak, and the guided session.
//
// The session is a sequence you work down, not a menu of links. Each step runs
// inline — the drills mount right there rather than sending you to another page
// and losing your place. Nothing is gated: any step can be started at any time
// and any step can be ticked off by hand, because "I already did my scales"
// should never be an argument with the app.

import { LEVELS, allLessons } from '../data/curriculum.js';
import { allSongs } from '../data/songs.js';
import {
  isLessonDone, getExercise, recordExercise, getSongProgress, getUserSongs,
  getStreak, getPracticeLog, practisedToday, today, logPractice,
  getSessionDone, setSessionStep, resetSession,
  exportAll, importAll, resetAll,
} from '../store.js';
import { runDrill } from '../ui/drill.js';
import { h, $, esc, pluralise } from '../ui/dom.js';
import { toast } from '../app.js';

export function render(container) {
  const streak = getStreak();
  const log = getPracticeLog();
  const lessons = allLessons();
  const doneLessons = lessons.filter((l) => isLessonDone(l.id)).length;

  const currentLevel = LEVELS.find((level) =>
    level.lessons.some((l) => !isLessonDone(l.id))
    || level.exercises.some((e) => !getExercise(e.id)?.passed)) ?? LEVELS.at(-1);

  const songs = allSongs(getUserSongs());
  const playable = songs.filter((s) => s.notes.length > 0);

  container.appendChild(h(`
    <header>
      <span class="eyebrow">${greeting()}</span>
      <h1>${practisedToday() ? 'Practised today' : 'Ready when you are'}</h1>
      <p>${practisedToday()
        ? 'Nice. Anything else today is a bonus.'
        : 'Ten focused minutes beats an hour of drifting. Work down the session below.'}</p>
    </header>
  `));

  container.appendChild(h(`
    <div class="grid three">
      <div class="card">
        <span class="eyebrow">Streak</span>
        <div style="font-family:var(--display);font-size:3rem;line-height:1;font-weight:700;
                    color:${streak > 0 ? 'var(--rosin)' : 'var(--string)'}">${streak}</div>
        <p class="small muted" style="margin:.35rem 0 0">
          ${streak === 0 ? 'Play today to start one.'
            : `consecutive ${streak === 1 ? 'day' : 'days'}`}</p>
      </div>
      <div class="card">
        <span class="eyebrow">Curriculum</span>
        <div style="font-family:var(--display);font-size:3rem;line-height:1;font-weight:700">
          ${Math.round((doneLessons / lessons.length) * 100)}<span style="font-size:1.2rem">%</span>
        </div>
        <p class="small muted" style="margin:.35rem 0 0">
          ${doneLessons} of ${lessons.length} lessons ticked</p>
      </div>
      <div class="card">
        <span class="eyebrow">Songs</span>
        <div style="font-family:var(--display);font-size:3rem;line-height:1;font-weight:700">
          ${playable.filter((s) => getSongProgress(s.id).bestAccuracy >= 80).length}<span
            style="font-size:1.2rem">/${songs.length}</span>
        </div>
        <p class="small muted" style="margin:.35rem 0 0">played at 80% or better</p>
      </div>
    </div>
  `));

  container.appendChild(h(`
    <div class="card" style="margin-top:1rem">
      <span class="eyebrow">Last two weeks</span>
      <div class="row" style="gap:.35rem;margin-top:.75rem">
        ${lastDays(14).map((day) => {
          const minutes = log[day.key] || 0;
          const strength = minutes === 0 ? 0 : Math.min(1, minutes / 25);
          return `<div title="${day.key}${minutes ? ` — ${pluralise(minutes, 'minute')}` : ' — nothing'}"
            style="flex:1;height:38px;border-radius:4px;
                   background:${minutes
                     ? `rgba(200,113,55,${0.25 + strength * 0.75})`
                     : 'var(--ebony-raise)'};
                   border:1px solid ${day.isToday ? 'var(--rosin)' : 'transparent'}"></div>`;
        }).join('')}
      </div>
      <div class="spread small muted" style="margin-top:.5rem">
        <span>14 days ago</span><span>today</span>
      </div>
    </div>
  `));

  // ---- the guided session ------------------------------------------------

  const steps = buildSession(currentLevel, playable);
  const done = new Set(getSessionDone());

  // A song played today ticks itself off — you did the work, the app noticed.
  for (const step of steps) {
    if (step.songId && getSongProgress(step.songId).lastPlayed === today()) done.add(step.id);
  }

  const section = h(`
    <section style="margin-top:2.5rem">
      <div class="spread" style="align-items:baseline">
        <h2 style="margin:0">Today's session</h2>
        <span class="small muted mono" data-count></span>
      </div>
      <p class="muted" style="margin:.5rem 0 1.5rem">Built from where you are:
        <b>Level ${currentLevel.number} — ${esc(currentLevel.title)}</b>.
        Work down it, or jump straight to whichever step you want.</p>
      <div class="session" data-session></div>
      <div data-complete></div>
    </section>
  `);
  container.appendChild(section);

  const sessionEl = $(section, '[data-session]');
  const completeEl = $(section, '[data-complete]');
  const countEl = $(section, '[data-count]');

  let activeIndex = -1;
  let drillCleanup = null;

  function stopDrill() {
    drillCleanup?.();
    drillCleanup = null;
  }

  function setDone(step, isDone) {
    if (isDone) done.add(step.id);
    else done.delete(step.id);
    setSessionStep(step.id, isDone);
  }

  function complete(step) {
    setDone(step, true);
    if (step.minutes) logPractice(step.minutes);
    // Move to the next thing that still needs doing, if there is one.
    activeIndex = steps.findIndex((s) => !done.has(s.id));
    paint();
  }

  // paint() owns mounting entirely. It tears the list down and rebuilds it, so
  // anything running inside a step has to be stopped first — otherwise the
  // drill's DOM is discarded while its microphone loop keeps going, and the
  // active step comes back empty after any repaint.
  function paint() {
    stopDrill();
    sessionEl.replaceChildren();
    countEl.textContent = `${done.size} of ${steps.length} done`;

    steps.forEach((step, index) => {
      const isDone = done.has(step.id);
      const isActive = index === activeIndex && !isDone;

      const row = h(`
        <div class="step${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}">
          <button class="step-num" type="button"
                  aria-label="${isDone ? 'Mark not done' : 'Start'}: ${esc(step.title)}">
            ${isDone ? '✓' : index + 1}
          </button>
          <div class="step-card">
            <div class="step-head">
              <div style="min-width:0">
                <div class="step-title">${esc(step.title)}
                  <span class="chip" style="margin-left:.4rem">${step.minutes} min</span></div>
                <div class="step-detail">${esc(step.detail)}</div>
              </div>
              <div class="step-actions"></div>
            </div>
            <div class="step-panel" data-panel hidden></div>
          </div>
        </div>
      `);

      const actions = $(row, '.step-actions');
      const panel = $(row, '[data-panel]');

      if (isDone) {
        const undo = h('<button class="btn small ghost" type="button">Undo</button>');
        undo.addEventListener('click', () => {
          setDone(step, false);
          paint();
        });
        actions.appendChild(undo);
      } else {
        if (step.kind === 'link') {
          actions.appendChild(h(
            `<a class="btn small${isActive ? ' primary' : ''}" href="${esc(step.href)}">Open</a>`));
        } else if (!isActive) {
          const start = h('<button class="btn small" type="button">Start</button>');
          start.addEventListener('click', () => activate(index));
          actions.appendChild(start);
        }

        const tick = h('<button class="btn small ghost" type="button">Mark done</button>');
        tick.addEventListener('click', () => complete(step));
        actions.appendChild(tick);
      }

      $(row, '.step-num').addEventListener('click', () => {
        if (isDone) {
          setDone(step, false);
          paint();
        } else {
          activate(index);
        }
      });

      if (isActive) panel.hidden = false;
      sessionEl.appendChild(row);
    });

    // Now that the rows exist, fill in whatever the active step needs.
    const active = activeIndex >= 0 ? steps[activeIndex] : null;
    if (active && !done.has(active.id)) {
      if (active.kind === 'drill') {
        mountDrill(activeIndex);
      } else if (active.kind === 'manual') {
        sessionEl.children[activeIndex]?.querySelector('[data-panel]')?.replaceChildren(h(`
          <p class="small muted" style="margin:0">Play something you already know and enjoy —
            it does not matter what. Then tick this off.</p>
        `));
      }
    }

    completeEl.replaceChildren();
    if (done.size === steps.length) {
      const card = h(`
        <div class="session-done" style="margin-top:1rem">
          <h3>Session done</h3>
          <p class="muted small">That is the whole twenty minutes. Come back tomorrow —
            on a physical skill, frequency beats duration.</p>
          <button class="btn ghost small" type="button">Start it over</button>
        </div>
      `);
      $(card, 'button').addEventListener('click', () => {
        done.clear();
        resetSession();
        activeIndex = -1;
        paint();
      });
      completeEl.appendChild(card);
    }
  }

  function activate(index) {
    activeIndex = index;
    paint();
    sessionEl.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function mountDrill(index) {
    const step = steps[index];
    const panel = sessionEl.children[index]?.querySelector('[data-panel]');
    if (!panel) return;
    panel.hidden = false;

    drillCleanup = runDrill(panel, step.config, (result) => {
      if (result.closed) {
        stopDrill();
        activeIndex = -1;
        paint();
        return;
      }
      if (step.exerciseId) {
        recordExercise(step.exerciseId, { passed: result.passed, avgCents: result.avgCents });
      }
      if (result.passed) {
        toast(`${step.title} — done.`);
        complete(step);
      } else {
        // Leave the step open so another go does not cost them their place.
        toast('Under 80%. Run it again, or mark it done and move on.');
      }
    });
  }

  paint();

  // ---- pick up where you left off ----------------------------------------

  const recent = songs
    .map((s) => ({ song: s, progress: getSongProgress(s.id) }))
    .filter((x) => x.progress.lastPlayed)
    .sort((a, b) => (a.progress.lastPlayed < b.progress.lastPlayed ? 1 : -1))
    .slice(0, 3);

  if (recent.length) {
    container.appendChild(h(`
      <section style="margin-top:2.5rem">
        <h2>Pick up where you left off</h2>
        <div class="grid two" style="margin-top:1.25rem">
          ${recent.map(({ song, progress }) => `
            <a class="songcard" href="#/songs/${esc(song.id)}">
              <h3>${esc(song.title)}</h3>
              <p class="composer">${esc(song.composer)}</p>
              <div class="spread small muted" style="margin-bottom:.35rem">
                <span>Best</span><b class="mono">${Math.round(progress.bestAccuracy)}%</b>
              </div>
              <div class="meter${progress.bestAccuracy >= 80 ? ' good' : ''}">
                <i style="width:${Math.min(100, progress.bestAccuracy)}%"></i>
              </div>
              <p class="small muted" style="margin:.6rem 0 0">
                last played ${esc(relativeDay(progress.lastPlayed))}</p>
            </a>`).join('')}
        </div>
      </section>
    `));
  }

  // ---- data ---------------------------------------------------------------

  const data = h(`
    <section style="margin-top:3rem">
      <details class="card">
        <summary style="cursor:pointer;font-weight:500">Your data</summary>
        <p class="small muted" style="margin-top:.75rem">Everything lives in this browser —
          progress, scores, streak, and any songs you added. Clearing site data wipes it,
          so export a copy if you care about the streak.</p>
        <div class="row" style="margin-top:1rem">
          <button class="btn small" type="button" data-export>Export</button>
          <button class="btn small ghost" type="button" data-import>Import</button>
          <button class="btn small ghost danger" type="button" data-reset>Reset everything</button>
        </div>
        <textarea data-json hidden style="margin-top:1rem;min-height:140px"></textarea>
      </details>
    </section>
  `);
  container.appendChild(data);

  const json = $(data, '[data-json]');
  $(data, '[data-export]').addEventListener('click', () => {
    json.hidden = false;
    json.value = exportAll();
    json.select();
    toast('Copy this somewhere safe.');
  });
  $(data, '[data-import]').addEventListener('click', () => {
    if (json.hidden) {
      json.hidden = false;
      json.value = '';
      json.placeholder = 'Paste an export here, then click Import again.';
      return;
    }
    try {
      importAll(json.value);
      toast('Imported. Reloading.');
      setTimeout(() => location.reload(), 600);
    } catch {
      toast('That was not a valid export.');
    }
  });
  $(data, '[data-reset]').addEventListener('click', (e) => {
    const btn = e.target;
    if (btn.dataset.confirm) {
      resetAll();
      toast('Everything reset.');
      setTimeout(() => location.reload(), 500);
      return;
    }
    btn.dataset.confirm = '1';
    btn.textContent = 'Really reset? Click again';
  });

  return () => { stopDrill(); };
}

/**
 * Today's session, built from the current level.
 *
 * The order is the argument: tune before you play anything, bow control before
 * the left hand gets involved, the level's own drill before repertoire, and
 * finish on something that already works.
 */
function buildSession(level, playable) {
  const steps = [
    {
      id: 'tune',
      title: 'Tune up',
      detail: 'One string at a time, G through E. It tells you how sharp or flat you are, '
        + 'and moves on once each string is in.',
      minutes: 2,
      kind: 'drill',
      config: { type: 'openStrings', tolerance: 15, holdSeconds: 1.2 },
    },
    {
      id: 'longtones',
      title: 'Long tones',
      detail: 'Hold each open string dead steady for four seconds. Bow control before '
        + 'anything the left hand does.',
      minutes: 4,
      kind: 'drill',
      config: { type: 'longTone', notes: ['G3', 'D4', 'A4', 'E5'], tolerance: 20, holdSeconds: 4 },
    },
  ];

  // The level's own drill — unless it is the tuning one, which is already step 1.
  const exercise = level.exercises.find((e) => !getExercise(e.id)?.passed) ?? level.exercises[0];
  if (exercise && exercise.type !== 'openStrings') {
    steps.push({
      id: `ex-${exercise.id}`,
      exerciseId: exercise.id,
      title: exercise.title,
      detail: `Level ${level.number} drill — ${exercise.detail}`,
      minutes: 5,
      kind: 'drill',
      config: exercise,
    });
  } else {
    steps.push({
      id: 'scale-d',
      exerciseId: 'game-dmajor',
      title: 'D major scale',
      detail: 'Up and down, every note checked. Turn the drone on and play against it.',
      minutes: 5,
      kind: 'drill',
      config: { type: 'scale', tonic: 'D4', quality: 'major', octaves: 1, tolerance: 25 },
    });
  }

  const song = playable.find((s) => getSongProgress(s.id).bestAccuracy < 80) ?? playable[0];
  if (song) {
    steps.push({
      id: `song-${song.id}`,
      songId: song.id,
      title: song.title,
      detail: 'Learn mode for anything shaky, then play along at a tempo you can hold.',
      minutes: 8,
      kind: 'link',
      href: `#/songs/${song.id}/practice?mode=learn`,
    });
  }

  steps.push({
    id: 'finish',
    title: 'Finish on something you can play',
    detail: 'End well. It makes tomorrow easier, and that is most of what a streak is.',
    minutes: 1,
    kind: 'manual',
  });

  return steps;
}

function lastDays(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    out.push({ key: local.toISOString().slice(0, 10), isToday: i === 0 });
  }
  return out;
}

function relativeDay(key) {
  if (key === today()) return 'today';
  const then = new Date(`${key}T00:00:00`);
  const days = Math.round((Date.now() - then.getTime()) / 86400000);
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return key;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}
