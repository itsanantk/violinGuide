// Daily drills. Short, repeatable, and scored — the thing to open when you have
// ten minutes and no plan.

import { runDrill } from '../ui/drill.js';
import { listen } from '../audio/mic.js';
import { playNoteNow } from '../audio/synth.js';
import { midiFromName, noteName, fingeringFor, STRINGS } from '../theory.js';
import { getSettings, logPractice, recordExercise, getExercise } from '../store.js';
import { renderFingerboard, fingeringBadge } from '../ui/fingerboard.js';
import { h, $, $$, esc, micGate, pluralise } from '../ui/dom.js';
import { toast } from '../app.js';

const GAMES = [
  {
    id: 'game-dstring',
    title: 'D string notes',
    blurb: 'The five notes of the D string, in random order.',
    config: { type: 'noteSet', notes: ['D4', 'E4', 'F#4', 'G4', 'A4'], rounds: 12, tolerance: 25 },
  },
  {
    id: 'game-astring',
    title: 'A string notes',
    blurb: 'Same pattern, one string up.',
    config: { type: 'noteSet', notes: ['A4', 'B4', 'C#5', 'D5', 'E5'], rounds: 12, tolerance: 25 },
  },
  {
    id: 'game-allstrings',
    title: 'Anything in first position',
    blurb: 'All four strings. Harder — you have to find the string as well as the note.',
    config: {
      type: 'noteSet',
      notes: ['G3', 'B3', 'D4', 'E4', 'F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5', 'A5'],
      rounds: 15, tolerance: 30,
    },
  },
  {
    id: 'game-longtone',
    title: 'Long tones',
    blurb: 'Hold each open string steady for four seconds. Bow control, not fingers.',
    config: {
      type: 'longTone', notes: ['G3', 'D4', 'A4', 'E5'], tolerance: 15, holdSeconds: 4,
    },
  },
  {
    id: 'game-dmajor',
    title: 'D major scale',
    blurb: 'Up and down, every note checked.',
    config: { type: 'scale', tonic: 'D4', quality: 'major', octaves: 1, tolerance: 25 },
  },
  {
    id: 'game-bminor',
    title: 'B minor, two octaves',
    blurb: 'All four strings, top of first position. The one that preps the hard songs.',
    config: { type: 'scale', tonic: 'B3', quality: 'minor', octaves: 2, tolerance: 30 },
  },
];

export function render(container) {
  let cleanup = null;

  container.appendChild(h(`
    <header>
      <span class="eyebrow">Trainer</span>
      <h1>Daily drills</h1>
      <p>Short and repeatable. If you only have ten minutes, do one of these — it is
         worth more than running a song top to bottom.</p>
    </header>
  `));

  const host = h('<div style="margin-bottom:2rem"></div>');
  container.appendChild(host);

  const grid = h(`<div class="grid two">${GAMES.map((game) => {
    const saved = getExercise(game.id);
    return `
      <div class="card">
        <div class="spread" style="align-items:flex-start">
          <div style="min-width:0">
            <h3 style="margin-bottom:.2rem">${esc(game.title)}</h3>
            <p class="muted small" style="margin:0">${esc(game.blurb)}</p>
          </div>
          ${saved?.passed ? '<span class="chip good">passed</span>' : ''}
        </div>
        ${saved?.bestCents != null
          ? `<p class="small mono muted" style="margin:.75rem 0 0">
               best average ${Math.round(saved.bestCents)} cents off</p>` : ''}
        <button class="btn ${saved?.passed ? '' : 'primary'}" type="button"
                data-game="${game.id}" style="margin-top:1rem">
          ${saved?.passed ? 'Again' : 'Start'}
        </button>
      </div>`;
  }).join('')}</div>`);
  container.appendChild(grid);

  $$(grid, 'button[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const game = GAMES.find((g) => g.id === btn.dataset.game);
      cleanup?.();
      host.replaceChildren();

      const panel = h(`
        <div class="card" style="border-color:var(--varnish)">
          <span class="eyebrow">Drill</span>
          <h2 style="margin:0 0 1rem">${esc(game.title)}</h2>
          <div data-drill></div>
        </div>
      `);
      host.appendChild(panel);

      cleanup = runDrill($(panel, '[data-drill]'), { ...game.config, id: game.id }, (result) => {
        if (result.closed) {
          cleanup?.();
          cleanup = null;
          host.replaceChildren();
          return;
        }
        recordExercise(game.id, { passed: result.passed, avgCents: result.avgCents });
        logPractice(3);
        if (result.passed) toast('Passed.');
      });

      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // --- ear training, which does not fit the drill engine: the note is hidden.
  const ear = h(`
    <section style="margin-top:2.5rem">
      <h2>Ear training</h2>
      <p class="muted" style="margin-bottom:1.25rem">The site plays a note. Find it on the
        violin without being told what it is. This is the one that builds real pitch.</p>
      <div class="card">
        <div data-gate></div>
        <div class="spread" style="margin-bottom:1rem">
          <div>
            <div class="mono small muted" data-ear-status>Press play to hear a note.</div>
            <div class="bignote-name" data-ear-name style="font-size:3rem">?</div>
          </div>
          <div class="row">
            <button class="btn primary" type="button" data-ear-play>Play a note</button>
            <button class="btn ghost" type="button" data-ear-repeat disabled>Again</button>
            <button class="btn ghost" type="button" data-ear-reveal disabled>Give up</button>
          </div>
        </div>
        <div class="spread small muted">
          <span data-ear-score>0 right, 0 tried</span>
          <span data-ear-streak></span>
        </div>
        <div data-ear-board style="max-width:170px;margin:1rem auto 0"></div>
      </div>
    </section>
  `);
  container.appendChild(ear);

  const POOL = ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'].map(midiFromName);
  const statusEl = $(ear, '[data-ear-status]');
  const nameEl = $(ear, '[data-ear-name]');
  const scoreEl = $(ear, '[data-ear-score]');
  const streakEl = $(ear, '[data-ear-streak]');
  const repeatBtn = $(ear, '[data-ear-repeat]');
  const revealBtn = $(ear, '[data-ear-reveal]');
  const earBoard = renderFingerboard($(ear, '[data-ear-board]'));

  let secret = null;
  let right = 0;
  let tried = 0;
  let streak = 0;
  let best = 0;
  let earStop = null;
  let solved = false;

  function paintScore() {
    scoreEl.textContent = `${right} right, ${tried} tried`;
    streakEl.textContent = streak > 0 ? `streak ${streak}${best > streak ? ` (best ${best})` : ''}` : '';
  }

  function playSecret() {
    if (secret == null) return;
    playNoteNow(secret, 1.2);
  }

  $(ear, '[data-ear-play]').addEventListener('click', () => {
    secret = POOL[Math.floor(Math.random() * POOL.length)];
    solved = false;
    nameEl.textContent = '?';
    nameEl.className = 'bignote-name';
    statusEl.textContent = 'Find it on the violin.';
    repeatBtn.disabled = false;
    revealBtn.disabled = false;
    earBoard.clear();
    playSecret();
  });

  repeatBtn.addEventListener('click', playSecret);

  revealBtn.addEventListener('click', () => {
    if (secret == null || solved) return;
    solved = true;
    tried++;
    streak = 0;
    nameEl.textContent = noteName(secret);
    nameEl.className = 'bignote-name is-off';
    statusEl.textContent = `It was ${noteName(secret)} — ${fingeringBadge(secret)}`;
    earBoard.setNotes([{ midi: secret }]);
    paintScore();
  });

  function onEarReading(reading) {
    if (!reading || secret == null || solved) return;
    earBoard.setLive({ midi: reading.midi, cents: reading.cents, tolerance: 30 });
    if (reading.midi === secret && Math.abs(reading.cents) <= 35) {
      solved = true;
      right++;
      tried++;
      streak++;
      best = Math.max(best, streak);
      nameEl.textContent = noteName(secret);
      nameEl.className = 'bignote-name is-good';
      statusEl.textContent = `Correct — ${fingeringBadge(secret)}`;
      earBoard.setNotes([{ midi: secret }]);
      logPractice(1);
      paintScore();
    }
  }

  const earGate = micGate($(ear, '[data-gate]'), { label: 'Turn on the microphone for ear training' });
  earGate.onReady(() => {
    earStop?.();
    earStop = listen(onEarReading, { a4: getSettings().a4 });
  });

  paintScore();

  return () => {
    cleanup?.();
    earStop?.();
    earGate.destroy();
  };
}
