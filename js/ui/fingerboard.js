// The fingerboard diagram — the recurring object across the whole site.
//
// Drawn the way you look down at your own instrument: nut at the top, strings
// running away from you, G on the left through E on the right. Finger spacing
// is physical (see stopPosition in theory.js), not evenly divided, because the
// tightening gap between 2nd and 3rd finger is exactly the thing beginners
// have to feel — an evenly spaced diagram would teach the wrong hand shape.

import { STRINGS, FIRST_POSITION_SPAN, stopPosition, noteName, fingeringFor } from '../theory.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const W = 200;
const H = 260;
const PAD_X = 30;
const NUT_Y = 26;
const BOARD_BOTTOM = H - 18;
const BOARD_H = BOARD_BOTTOM - NUT_Y;

// Tapes beginners actually put on: 1st, 2nd (high), 3rd fingers.
const TAPE_SEMITONES = [2, 4, 5, 7];

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(key, String(value));
  }
  if (text != null) node.textContent = text;
  return node;
}

function stringX(index) {
  const usable = W - PAD_X * 2;
  return PAD_X + (index / (STRINGS.length - 1)) * usable;
}

function semitoneY(semitones, span = FIRST_POSITION_SPAN) {
  if (semitones <= 0) return NUT_Y;
  // Normalised against the span so first position fills the drawn board.
  return NUT_Y + (stopPosition(semitones) / stopPosition(span)) * BOARD_H;
}

/**
 * @param {HTMLElement} container
 * @param {object} options
 * @param {boolean} options.interactive click a position to select it
 * @param {(fingering) => void} options.onSelect
 * @param {boolean} options.showTapes
 * @param {boolean} options.showAllNotes draw every reachable position faintly
 * @returns {{ setNotes, setLive, clear, element }}
 */
export function renderFingerboard(container, options = {}) {
  const {
    interactive = false,
    onSelect = null,
    showTapes = true,
    showAllNotes = false,
    span = FIRST_POSITION_SPAN,
  } = options;

  container.replaceChildren();

  const svg = el('svg', {
    class: 'fingerboard',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': 'Violin fingerboard, first position',
  });

  svg.appendChild(el('rect', {
    class: 'fb-board',
    x: PAD_X - 14, y: NUT_Y, width: W - (PAD_X - 14) * 2, height: BOARD_H,
    rx: 4,
  }));
  svg.appendChild(el('rect', {
    class: 'fb-edge',
    x: PAD_X - 14, y: NUT_Y, width: W - (PAD_X - 14) * 2, height: BOARD_H,
    rx: 4,
  }));

  if (showTapes) {
    for (const semis of TAPE_SEMITONES) {
      const y = semitoneY(semis, span);
      svg.appendChild(el('line', {
        class: 'fb-tape',
        x1: PAD_X - 14, y1: y, x2: W - PAD_X + 14, y2: y,
      }));
      const finger = { 2: '1', 4: '2', 5: '3', 7: '4' }[semis];
      svg.appendChild(el('text', {
        class: 'fb-tape-label', x: PAD_X - 20, y: y + 3,
      }, finger));
    }
  }

  // Nut
  svg.appendChild(el('rect', {
    class: 'fb-nut', x: PAD_X - 16, y: NUT_Y - 5, width: W - (PAD_X - 16) * 2, height: 5, rx: 1.5,
  }));

  const stringNodes = [];
  STRINGS.forEach((string) => {
    const x = stringX(string.index);
    // Thicker toward the G string, like the real thing.
    const weight = 2.4 - string.index * 0.45;
    const line = el('line', {
      class: 'fb-string',
      x1: x, y1: NUT_Y - 4, x2: x, y2: BOARD_BOTTOM,
      'stroke-width': weight,
    });
    svg.appendChild(line);
    stringNodes.push(line);
    svg.appendChild(el('text', {
      class: 'fb-string-label', x, y: NUT_Y - 11,
    }, string.name));
  });

  if (showAllNotes) {
    for (const string of STRINGS) {
      for (let s = 0; s <= span; s++) {
        const midi = string.midi + s;
        // Only draw a spot on the string it is normally played on.
        const canonical = fingeringFor(midi);
        if (!canonical || canonical.stringIndex !== string.index) continue;
        addGhost(svg, string.index, s, midi, span, interactive, onSelect);
      }
    }
  }

  const liveLayer = el('g', { class: 'fb-live' });
  svg.appendChild(liveLayer);

  const markLayer = el('g', { class: 'fb-marks' });
  svg.appendChild(markLayer);

  container.appendChild(svg);

  function setNotes(notes = []) {
    markLayer.replaceChildren();
    for (const entry of notes) {
      const midi = typeof entry === 'number' ? entry : entry.midi;
      const state = typeof entry === 'number' ? null : entry.state;
      const fingering = fingeringFor(midi);
      if (!fingering) continue;
      drawDot(markLayer, fingering, state, span);
    }
    stringNodes.forEach((node, i) => {
      const active = notes.some((entry) => {
        const midi = typeof entry === 'number' ? entry : entry.midi;
        return fingeringFor(midi)?.stringIndex === i;
      });
      node.classList.toggle('is-active', active);
    });
  }

  /** Live mic reading, drawn between the frets it actually falls between. */
  function setLive(reading) {
    liveLayer.replaceChildren();
    if (!reading) return;
    const fingering = fingeringFor(reading.midi);
    if (!fingering) return;

    // Offset the dot by how sharp or flat it is, so a flat note sits visibly
    // closer to the nut than the tape it should be on.
    const semis = fingering.semitones + (reading.cents || 0) / 100;
    const x = stringX(fingering.stringIndex);
    const y = semitoneY(Math.max(0, semis), span);
    const good = Math.abs(reading.cents ?? 0) <= (reading.tolerance ?? 25);

    liveLayer.appendChild(el('circle', {
      class: `fb-dot ${good ? 'is-live' : 'is-off'}`,
      cx: x, cy: y, r: 9, opacity: 0.9,
    }));
  }

  function clear() {
    markLayer.replaceChildren();
    liveLayer.replaceChildren();
    stringNodes.forEach((n) => n.classList.remove('is-active'));
  }

  return { setNotes, setLive, clear, element: svg };
}

function drawDot(layer, fingering, state, span) {
  const x = stringX(fingering.stringIndex);
  const y = semitoneY(fingering.semitones, span);
  const open = fingering.finger === 0;

  const group = el('g');
  if (open) {
    group.appendChild(el('circle', { class: 'fb-dot-open', cx: x, cy: y, r: 7 }));
  } else {
    group.appendChild(el('circle', {
      class: `fb-dot${state ? ` is-${state}` : ''}`, cx: x, cy: y, r: 10,
    }));
    group.appendChild(el('text', { class: 'fb-dot-label', x, y }, String(fingering.finger)));
  }
  layer.appendChild(group);
}

function addGhost(svg, stringIndex, semitones, midi, span, interactive, onSelect) {
  const x = stringX(stringIndex);
  const y = semitoneY(semitones, span);
  const group = el('g', { class: 'fb-dot-group' });

  group.appendChild(el('circle', { class: 'fb-dot-ghost', cx: x, cy: y, r: 6 }));

  if (interactive) {
    const hit = el('circle', {
      class: 'fb-hit', cx: x, cy: y, r: 13,
      tabindex: '0', role: 'button',
      'aria-label': `${noteName(midi)}, ${semitones === 0 ? 'open string' : `finger ${fingeringFor(midi)?.finger}`}`,
    });
    const fire = () => onSelect?.(fingeringFor(midi));
    hit.addEventListener('click', fire);
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fire();
      }
    });
    svg.appendChild(hit);
  }

  svg.appendChild(group);
}

/** A tiny inline fingerboard for tables and lists. */
export function fingeringBadge(midi) {
  const fingering = fingeringFor(midi);
  if (!fingering) return '—';
  return fingering.finger === 0
    ? `${fingering.string} open`
    : `${fingering.string} · ${fingering.label}`;
}
