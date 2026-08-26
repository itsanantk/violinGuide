// Small DOM helpers shared by the views.

import { startMic, micState, onMicStateChange, MicState, ensureAudio } from '../audio/mic.js';

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function $(root, selector) {
  return root.querySelector(selector);
}

export function $$(root, selector) {
  return [...root.querySelectorAll(selector)];
}

/** Difficulty as filled dots out of five. */
export function difficultyDots(level) {
  return `<span class="difficulty" aria-label="Difficulty ${level} of 5">${
    Array.from({ length: 5 }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')
  }</span>`;
}

export function formatCents(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/**
 * Renders a "turn the mic on" panel into `container` and resolves when the mic
 * is ready. Views call this instead of assuming the mic is already running,
 * because Chrome will not grant it without a click.
 *
 * @returns {{ready: boolean, onReady: (fn) => void, destroy: () => void}}
 */
export function micGate(container, { mode = 'clean', label = 'Turn on the microphone' } = {}) {
  const panel = h(`
    <div class="card" style="text-align:center">
      <h3>${esc(label)}</h3>
      <p class="muted small">Your browser needs one click before it will let a page listen.
        Nothing is recorded or sent anywhere — the audio stays in this tab.</p>
      <button class="btn primary" type="button">Start listening</button>
      <p class="small muted" data-hint style="margin-top:.75rem"></p>
    </div>
  `);

  const button = $(panel, 'button');
  const hint = $(panel, '[data-hint]');
  const listeners = [];
  let ready = micState() === MicState.READY;

  async function start() {
    button.disabled = true;
    hint.textContent = '';
    try {
      await ensureAudio();
      await startMic({ mode });
      ready = true;
      panel.remove();
      listeners.forEach((fn) => fn());
    } catch (err) {
      button.disabled = false;
      hint.textContent = err?.name === 'NotAllowedError'
        ? 'Blocked. Click the padlock in the address bar, allow the microphone, then try again.'
        : (err?.message || 'Could not start the microphone.');
    }
  }

  button.addEventListener('click', start);

  if (!ready) container.appendChild(panel);

  const off = onMicStateChange((state) => {
    if (state === MicState.READY && !ready) {
      ready = true;
      panel.remove();
      listeners.forEach((fn) => fn());
    }
    if (state === MicState.IDLE && ready) {
      ready = false;
      container.appendChild(panel);
      button.disabled = false;
    }
  });

  return {
    get ready() { return ready; },
    onReady(fn) {
      listeners.push(fn);
      if (ready) fn();
    },
    destroy() { off(); panel.remove(); },
  };
}

/** Debounce for things like the editor's live parse. */
export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function pluralise(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
