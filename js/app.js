// Router and app shell.
//
// Views export `render(container, params)` and may return a cleanup function.
// Cleanup is not optional here: several views hold a live microphone loop, and
// leaving one running after navigation would keep the mic hot and stack up
// requestAnimationFrame callbacks.

import { ensureAudio, startMic, stopMic, micState, onMicStateChange, MicState } from './audio/mic.js';
import { getSettings, setSetting } from './store.js';
import * as home from './views/home.js';
import * as learn from './views/learn.js';
import * as songs from './views/songs.js';
import * as songDetail from './views/songDetail.js';
import * as songPractice from './views/songPractice.js';
import * as songEditor from './views/songEditor.js';
import * as tuner from './views/tuner.js';
import * as trainer from './views/trainer.js';
import * as fingering from './views/fingering.js';
import * as tips from './views/tips.js';

const ROUTES = [
  ['/', home],
  ['/learn', learn],
  ['/songs', songs],
  ['/songs/:id', songDetail],
  ['/songs/:id/practice', songPractice],
  ['/songs/:id/edit', songEditor],
  ['/tuner', tuner],
  ['/trainer', trainer],
  ['/fingering', fingering],
  ['/tips', tips],
];

const view = document.getElementById('view');
const rail = document.querySelector('.rail');
let cleanup = null;

function match(path) {
  for (const [pattern, module] of ROUTES) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let ok = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      else if (patternParts[i] !== pathParts[i]) { ok = false; break; }
    }
    if (ok) return { module, params };
  }
  return null;
}

function currentPath() {
  const raw = location.hash.replace(/^#/, '') || '/';
  return raw.split('?')[0] || '/';
}

function queryParams() {
  const raw = location.hash.replace(/^#/, '');
  const q = raw.split('?')[1];
  return q ? Object.fromEntries(new URLSearchParams(q)) : {};
}

async function route() {
  const path = currentPath();

  if (typeof cleanup === 'function') {
    try { cleanup(); } catch (err) { console.error('view cleanup failed', err); }
  }
  cleanup = null;

  const found = match(path);
  view.replaceChildren();

  // Highlight the nav entry for the section, not just exact matches, so a song
  // detail page still shows "Songs" as current.
  const section = '/' + (path.split('/').filter(Boolean)[0] || '');
  for (const link of rail.querySelectorAll('a')) {
    const isCurrent = link.dataset.route === section;
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  if (!found) {
    view.innerHTML = `
      <header><span class="eyebrow">Not found</span><h1>No such page</h1></header>
      <p class="muted">That link does not go anywhere.</p>
      <p><a class="btn" href="#/">Back to Today</a></p>`;
    return;
  }

  try {
    cleanup = await found.module.render(view, { ...found.params, ...queryParams() });
  } catch (err) {
    console.error('view failed to render', err);
    view.innerHTML = `
      <header><span class="eyebrow">Error</span><h1>That view failed to load</h1></header>
      <p class="muted">${escapeHtml(err?.message || String(err))}</p>
      <p class="small muted">Check the browser console for the full trace.</p>`;
  }

  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- toast ---------------------------------------------------------

const toastEl = document.getElementById('toast');
let toastTimer = null;

export function toast(message, ms = 2600) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---------- audio enable --------------------------------------------------

const enableBtn = document.getElementById('enable-audio');
const enableLabel = enableBtn.querySelector('.enable-label');

function paintEnable(state) {
  if (state === MicState.READY) {
    enableBtn.dataset.state = 'ready';
    enableLabel.textContent = 'Listening';
    enableBtn.title = 'Microphone is on. Click to turn it off.';
  } else if (state === MicState.DENIED) {
    enableBtn.dataset.state = 'denied';
    enableLabel.textContent = 'Mic blocked';
    enableBtn.title = 'Allow microphone access in your browser to use the tuner.';
  } else if (state === MicState.UNAVAILABLE) {
    enableBtn.dataset.state = 'denied';
    enableLabel.textContent = 'No mic';
  } else {
    delete enableBtn.dataset.state;
    enableLabel.textContent = 'Enable sound & mic';
    enableBtn.title = 'Turn on audio and the microphone.';
  }
}

enableBtn.addEventListener('click', async () => {
  if (micState() === MicState.READY) {
    stopMic();
    return;
  }
  try {
    await ensureAudio();
    await startMic({ mode: 'clean' });
    toast('Microphone on. Play a note.');
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      toast('Microphone blocked. Allow it in the address bar, then try again.', 5000);
    } else {
      toast(err?.message || 'Could not start the microphone.', 5000);
    }
  }
});

onMicStateChange(paintEnable);
paintEnable(micState());

// Warn early if the page is opened straight off disk, where getUserMedia and
// ES modules both fail in ways that look like the app is broken.
if (location.protocol === 'file:') {
  toast('Open this through a local server, not the file. See README.', 8000);
}

// ---------- settings ------------------------------------------------------

export { getSettings, setSetting };

// ---------- go ------------------------------------------------------------

window.addEventListener('hashchange', route);
route();
