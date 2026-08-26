// Today: streak, what to do next, and a suggested twenty minutes.

import { LEVELS, allLessons } from '../data/curriculum.js';
import { allSongs } from '../data/songs.js';
import {
  isLessonDone, getExercise, getSongProgress, getUserSongs,
  getStreak, getPracticeLog, practisedToday, today, exportAll, importAll, resetAll,
} from '../store.js';
import { h, $, $$, esc, pluralise } from '../ui/dom.js';
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
        : 'Ten focused minutes beats an hour of drifting. Start anywhere below.'}</p>
    </header>
  `));

  // --- streak + progress
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

  // --- the last fortnight
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

  // --- suggested session
  container.appendChild(h(`
    <section style="margin-top:2.5rem">
      <h2>A twenty minute session</h2>
      <p class="muted" style="margin-bottom:1.25rem">Built from where you are:
        <b>Level ${currentLevel.number} — ${esc(currentLevel.title)}</b>.</p>
      <div class="stack">
        ${routine(currentLevel, playable).map((step) => `
          <div class="card">
            <div class="spread">
              <div style="min-width:0">
                <h3 style="margin-bottom:.2rem">${esc(step.title)}
                  <span class="chip" style="margin-left:.4rem">${step.minutes} min</span></h3>
                <p class="muted small" style="margin:0">${esc(step.detail)}</p>
              </div>
              <a class="btn ${step.primary ? 'primary' : ''}" href="${esc(step.href)}">Go</a>
            </div>
          </div>`).join('')}
      </div>
    </section>
  `));

  // --- pick up where you left off
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

  // --- data
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

  return () => {};
}

function routine(level, playable) {
  const steps = [
    {
      title: 'Tune up',
      detail: 'All four strings. Do it every single session, before anything else.',
      minutes: 2,
      href: '#/tuner',
      primary: true,
    },
    {
      title: 'Long tones',
      detail: 'Open strings, four seconds each, dead steady. Bow control before anything else.',
      minutes: 4,
      href: '#/trainer',
    },
  ];

  if (level.exercises.length) {
    const exercise = level.exercises.find((e) => !getExercise(e.id)?.passed) ?? level.exercises[0];
    steps.push({
      title: exercise.title,
      detail: `Level ${level.number} drill — ${exercise.detail}`,
      minutes: 5,
      href: '#/learn',
    });
  } else {
    steps.push({
      title: 'D major scale',
      detail: 'Slowly, against the drone. Every note checked.',
      minutes: 5,
      href: '#/trainer',
    });
  }

  const song = playable.find((s) => getSongProgress(s.id).bestAccuracy < 80) ?? playable[0];
  if (song) {
    steps.push({
      title: song.title,
      detail: 'Learn mode for anything shaky, then play along at a tempo you can hold.',
      minutes: 8,
      href: `#/songs/${song.id}/practice?mode=learn`,
    });
  }

  steps.push({
    title: 'Finish on something you can play',
    detail: 'End well. It makes tomorrow easier — that is most of what a streak is.',
    minutes: 1,
    href: '#/songs',
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
