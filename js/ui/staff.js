// A small treble-staff renderer.
//
// Deliberately not full music engraving — this is a reading aid that sits next
// to the fingerboard and the note names, so it draws heads, stems, accidentals,
// ledger lines, slur arcs and bow marks, and stops there. Anything more would
// mean shipping an engraving library for a single melody line.

const SVG_NS = 'http://www.w3.org/2000/svg';

const GAP = 9;            // space between staff lines
const STAFF_TOP = 34;     // y of the top line
const BOTTOM_LINE = STAFF_TOP + GAP * 4;
const BOTTOM_STEP = 30;   // diatonic step of E4, the bottom line
const LEFT = 52;          // room for the clef and key signature
const MIN_NOTE_GAP = 30;

// Pitch classes covered by the key signature. Every song in the library is in
// D major or B minor, so F# and C# are already declared and must NOT be drawn
// again on each note — repeating them is what makes beginner-facing notation
// look wrong to anyone who reads music.
const DEFAULT_KEY_SHARPS = [6, 1]; // F#, C#

// Pitch class -> [letter index, has accidental]
const SPELLING = [
  [0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0],
  [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0],
];

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  if (text != null) node.textContent = text;
  return node;
}

function diatonicStep(midi) {
  const [letter] = SPELLING[((midi % 12) + 12) % 12];
  return (Math.floor(midi / 12) - 1) * 7 + letter;
}

function hasSharp(midi) {
  return SPELLING[((midi % 12) + 12) % 12][1] === 1;
}

function yForStep(step) {
  return BOTTOM_LINE - (step - BOTTOM_STEP) * (GAP / 2);
}

/**
 * @param {HTMLElement} container
 * @param {Array} notes resolved notes (see notation.resolveNotes)
 * @param {object} options
 * @returns {{ setCurrent(index), element }}
 */
export function renderStaff(container, notes, options = {}) {
  const {
    showBowing = true, currentIndex = -1, doneUpTo = -1,
    keySharps = DEFAULT_KEY_SHARPS,
  } = options;

  container.replaceChildren();

  const spacing = Math.max(MIN_NOTE_GAP, 0);
  const width = LEFT + notes.length * spacing + 40;
  const height = 108;

  const svg = el('svg', {
    class: 'staff',
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': 'Notation',
    preserveAspectRatio: 'xMinYMid meet',
  });
  svg.style.minWidth = `${width}px`;

  for (let i = 0; i < 5; i++) {
    const y = STAFF_TOP + i * GAP;
    svg.appendChild(el('line', { class: 'staff-line', x1: 10, y1: y, x2: width - 10, y2: y }));
  }

  svg.appendChild(el('text', { class: 'staff-clef', x: 12, y: BOTTOM_LINE + 3 }, '\u{1D11E}'));

  // Key signature, drawn once at the left.
  const keyX = 34;
  keySharps.forEach((pitchClass, i) => {
    // Place each sharp on its conventional staff line for treble clef.
    const midi = pitchClass === 6 ? 78 : pitchClass === 1 ? 73 : 66 + pitchClass;
    svg.appendChild(el('text', {
      class: 'staff-accidental', x: keyX + i * 8, y: yForStep(diatonicStep(midi)) + 4,
    }, '♯'));
  });

  const noteNodes = [];

  notes.forEach((note, index) => {
    const x = LEFT + index * spacing + spacing / 2;

    if (note.rest) {
      svg.appendChild(el('rect', {
        class: 'staff-rest',
        x: x - 4, y: STAFF_TOP + GAP * 1.5, width: 8, height: 5, rx: 1,
      }));
      noteNodes.push(null);
      return;
    }

    const step = diatonicStep(note.midi);
    const y = yForStep(step);
    const group = el('g');

    // Ledger lines, above and below.
    for (let s = BOTTOM_STEP - 2; s >= step; s -= 2) {
      group.appendChild(el('line', {
        class: 'staff-ledger', x1: x - 8, y1: yForStep(s), x2: x + 8, y2: yForStep(s),
      }));
    }
    for (let s = BOTTOM_STEP + 10; s <= step; s += 2) {
      group.appendChild(el('line', {
        class: 'staff-ledger', x1: x - 8, y1: yForStep(s), x2: x + 8, y2: yForStep(s),
      }));
    }

    const pitchClass = ((note.midi % 12) + 12) % 12;
    if (hasSharp(note.midi) && !keySharps.includes(pitchClass)) {
      group.appendChild(el('text', { class: 'staff-accidental', x: x - 15, y: y + 4 }, '♯'));
    }

    const filled = note.beats < 2;
    const head = el('ellipse', {
      class: `staff-note${index === currentIndex ? ' is-current' : ''}${index <= doneUpTo ? ' is-done' : ''}`,
      cx: x, cy: y, rx: 5.2, ry: 3.9,
      transform: `rotate(-20 ${x} ${y})`,
      fill: filled ? undefined : 'none',
      stroke: filled ? undefined : 'currentColor',
      'stroke-width': filled ? undefined : 1.3,
    });
    if (!filled) head.style.color = 'var(--parchment)';
    group.appendChild(head);

    if (note.beats < 4) {
      const stemUp = step < BOTTOM_STEP + 4;
      const x1 = stemUp ? x + 5 : x - 5;
      const y2 = stemUp ? y - 26 : y + 26;
      group.appendChild(el('line', { class: 'staff-stem', x1, y1: y, x2: x1, y2 }));

      if (note.beats <= 0.5) {
        group.appendChild(el('path', {
          class: 'staff-stem',
          d: stemUp
            ? `M ${x1} ${y2} q 7 5 5 13`
            : `M ${x1} ${y2} q 7 -5 5 -13`,
          fill: 'none',
        }));
      }
    }

    svg.appendChild(group);
    noteNodes.push(head);

    if (showBowing && note.strokeStart && note.bowSymbol) {
      svg.appendChild(el('text', {
        class: 'staff-bow', x, y: STAFF_TOP - 8,
      }, note.bowSymbol));
    }
  });

  // Slur arcs, drawn per bow stroke so they line up with the bowing marks.
  if (showBowing) {
    let start = null;
    notes.forEach((note, index) => {
      const slur = note.slur ?? null;
      const previous = index > 0 ? notes[index - 1].slur ?? null : null;
      if (slur !== null && slur !== previous) start = index;
      const next = index < notes.length - 1 ? notes[index + 1].slur ?? null : null;
      if (slur !== null && slur !== next && start !== null) {
        const x1 = LEFT + start * spacing + spacing / 2;
        const x2 = LEFT + index * spacing + spacing / 2;
        const mid = (x1 + x2) / 2;
        svg.appendChild(el('path', {
          class: 'staff-slur',
          d: `M ${x1} ${STAFF_TOP - 3} Q ${mid} ${STAFF_TOP - 15} ${x2} ${STAFF_TOP - 3}`,
        }));
        start = null;
      }
    });
  }

  container.appendChild(svg);

  return {
    element: svg,
    setCurrent(index, done = index - 1) {
      noteNodes.forEach((node, i) => {
        if (!node) return;
        node.classList.toggle('is-current', i === index);
        node.classList.toggle('is-done', i <= done);
      });
      const node = noteNodes[index];
      if (node && container.scrollWidth > container.clientWidth) {
        const target = LEFT + index * spacing - container.clientWidth / 2;
        container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      }
    },
  };
}
