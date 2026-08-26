import { LEVELS, allLessons } from '../data/curriculum.js';
import { isLessonDone, setLessonDone, getExercise, recordExercise, logPractice } from '../store.js';
import { runDrill } from '../ui/drill.js';
import { h, $, $$, esc, pluralise } from '../ui/dom.js';
import { toast } from '../app.js';

export function render(container) {
  let cleanupDrill = null;

  const doneCount = allLessons().filter((l) => isLessonDone(l.id)).length;
  const total = allLessons().length;

  container.appendChild(h(`
    <header>
      <span class="eyebrow">Learn</span>
      <h1>From nothing to playing</h1>
      <p>Seven levels, in order. Each one builds the specific thing the next needs.
         Tick lessons off as you go — the drills are checked by the microphone.</p>
      <div style="margin-top:1.5rem;max-width:420px">
        <div class="spread small muted" style="margin-bottom:.4rem">
          <span>Progress</span><b class="mono" data-count>${doneCount} of ${total}</b>
        </div>
        <div class="meter${doneCount === total ? ' good' : ''}">
          <i data-bar style="width:${(doneCount / total) * 100}%"></i>
        </div>
      </div>
    </header>
  `));

  const drillHost = h('<div style="margin-bottom:2rem"></div>');
  container.appendChild(drillHost);

  function updateProgress() {
    const done = allLessons().filter((l) => isLessonDone(l.id)).length;
    $(container, '[data-count]').textContent = `${done} of ${total}`;
    const bar = $(container, '[data-bar]');
    bar.style.width = `${(done / total) * 100}%`;
    bar.parentElement.classList.toggle('good', done === total);
  }

  // Current level = the first with anything unfinished.
  const currentLevelId = LEVELS.find((level) =>
    level.lessons.some((l) => !isLessonDone(l.id))
    || level.exercises.some((e) => !getExercise(e.id)?.passed))?.id ?? null;

  for (const level of LEVELS) {
    const levelDone = level.lessons.every((l) => isLessonDone(l.id))
      && level.exercises.every((e) => getExercise(e.id)?.passed);

    const section = h(`
      <section class="level${levelDone ? ' is-done' : ''}${level.id === currentLevelId ? ' is-current' : ''}">
        <div class="level-head">
          <span class="level-num">Level ${level.number}</span>
          ${levelDone ? '<span class="chip good">done</span>' : ''}
          ${level.id === currentLevelId ? '<span class="chip">you are here</span>' : ''}
        </div>
        <h2>${esc(level.title)}</h2>
        <p class="muted" style="margin-bottom:1.25rem">${esc(level.blurb)}</p>
        <div data-lessons></div>
        <div data-exercises style="margin-top:1.25rem"></div>
      </section>
    `);
    container.appendChild(section);

    const lessonHost = $(section, '[data-lessons]');
    for (const lesson of level.lessons) {
      const done = isLessonDone(lesson.id);
      const row = h(`
        <div class="lesson${done ? ' is-done' : ''}">
          <button class="lesson-check" type="button" aria-pressed="${done}"
                  aria-label="Mark ${esc(lesson.title)} as done">✓</button>
          <div class="lesson-body">
            <div class="lesson-title">${esc(lesson.title)}</div>
            <div class="lesson-detail">${esc(lesson.detail)}</div>
            <details style="margin-top:.5rem">
              <summary class="small" style="cursor:pointer;color:var(--varnish-soft)">More</summary>
              <p class="small muted" style="margin:.6rem 0 0">${esc(lesson.body)}</p>
              ${lesson.link ? `<p style="margin:.75rem 0 0">
                <a class="btn small" href="${esc(lesson.link)}">Open the song</a></p>` : ''}
            </details>
          </div>
        </div>
      `);

      const check = $(row, '.lesson-check');
      check.addEventListener('click', () => {
        const next = !isLessonDone(lesson.id);
        setLessonDone(lesson.id, next);
        check.setAttribute('aria-pressed', String(next));
        row.classList.toggle('is-done', next);
        updateProgress();
      });

      lessonHost.appendChild(row);
    }

    const exerciseHost = $(section, '[data-exercises]');
    for (const exercise of level.exercises) {
      const saved = getExercise(exercise.id);
      const card = h(`
        <div class="card" style="${saved?.passed ? 'border-color:#3d5236' : ''}">
          <div class="spread">
            <div style="min-width:0">
              <h3 style="margin-bottom:.2rem">
                ${esc(exercise.title)}
                ${saved?.passed ? '<span class="chip good">passed</span>' : ''}
              </h3>
              <p class="muted small" style="margin:0">${esc(exercise.detail)}</p>
              ${saved?.bestCents != null
                ? `<p class="small mono muted" style="margin:.4rem 0 0">
                     best average ${Math.round(saved.bestCents)} cents off</p>`
                : ''}
            </div>
            <button class="btn ${saved?.passed ? 'ghost' : 'primary'}" type="button">
              ${saved?.passed ? 'Again' : 'Start'}
            </button>
          </div>
        </div>
      `);

      $(card, 'button').addEventListener('click', () => {
        cleanupDrill?.();
        drillHost.replaceChildren();

        const panel = h(`
          <div class="card" style="border-color:var(--varnish)">
            <div class="spread" style="margin-bottom:1rem">
              <div>
                <span class="eyebrow">Level ${level.number} drill</span>
                <h2 style="margin:0">${esc(exercise.title)}</h2>
              </div>
            </div>
            <div data-drill></div>
          </div>
        `);
        drillHost.appendChild(panel);

        cleanupDrill = runDrill($(panel, '[data-drill]'), exercise, (result) => {
          if (result.closed) {
            cleanupDrill?.();
            cleanupDrill = null;
            drillHost.replaceChildren();
            return;
          }
          recordExercise(exercise.id, { passed: result.passed, avgCents: result.avgCents });
          logPractice(2);
          if (result.passed) toast('Drill passed.');
        });

        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      exerciseHost.appendChild(card);
    }
  }

  return () => { cleanupDrill?.(); };
}
