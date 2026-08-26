// The scrolling lane for play-along.
//
// Canvas rather than SVG: this redraws every frame while notes move, and
// swapping dozens of DOM nodes at 60fps is exactly what canvas is for.
//
// Notes scroll right-to-left past a fixed playhead, with your live pitch drawn
// as a moving dot on the same vertical scale — so "am I above or below the
// note" is answered by looking at one place.

import { isRest } from '../notation.js';

const PLAYHEAD_FRACTION = 0.28;
const PIXELS_PER_BEAT = 110;

export function createNoteLane(canvas, notes, options = {}) {
  const { beatsPerBar = 4 } = options;

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  const pitched = notes.filter((n) => !isRest(n) && n.midi != null);
  const lowest = pitched.length ? Math.min(...pitched.map((n) => n.midi)) : 62;
  const highest = pitched.length ? Math.max(...pitched.map((n) => n.midi)) : 76;
  // A little headroom so notes never sit flush against the edges.
  const lo = lowest - 3;
  const hi = highest + 3;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function yFor(midi) {
    const span = hi - lo;
    return height - ((midi - lo) / span) * height;
  }

  function draw(beat, { statuses = {}, live = null, tolerance = 25 } = {}) {
    if (!width || !height) return;
    const playheadX = width * PLAYHEAD_FRACTION;

    ctx.clearRect(0, 0, width, height);

    // Bar lines
    ctx.strokeStyle = 'rgba(58,47,35,0.7)';
    ctx.lineWidth = 1;
    const firstBar = Math.floor((beat - playheadX / PIXELS_PER_BEAT) / beatsPerBar) * beatsPerBar;
    for (let b = firstBar; b * PIXELS_PER_BEAT - beat * PIXELS_PER_BEAT + playheadX < width; b += beatsPerBar) {
      const x = playheadX + (b - beat) * PIXELS_PER_BEAT;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
      ctx.stroke();
    }

    // Guide line at the current target pitch, so the eye has something to track
    const current = notes.find((n) => beat >= n.startBeat && beat < n.endBeat);
    if (current && !isRest(current) && current.midi != null) {
      const y = yFor(current.midi);
      ctx.strokeStyle = 'rgba(200,113,55,0.22)';
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Notes
    for (const note of notes) {
      const x = playheadX + (note.startBeat - beat) * PIXELS_PER_BEAT;
      const w = Math.max(6, note.beats * PIXELS_PER_BEAT - 4);
      if (x > width || x + w < 0) continue;

      if (isRest(note)) {
        ctx.fillStyle = 'rgba(110,98,82,0.25)';
        ctx.fillRect(x, height / 2 - 2, w, 4);
        continue;
      }

      const y = yFor(note.midi);
      const status = statuses[note.index];
      const past = beat > note.endBeat;

      let fill = 'rgba(198,184,157,0.55)';
      if (status === 'hit') fill = '#7fa65c';
      else if (status === 'close') fill = '#e0a63d';
      else if (status === 'wrong' || status === 'missed') fill = '#c15a48';
      else if (past) fill = 'rgba(110,98,82,0.5)';
      else if (beat >= note.startBeat) fill = '#c87137';

      roundRect(ctx, x, y - 7, w, 14, 5);
      ctx.fillStyle = fill;
      ctx.fill();

      if (w > 26) {
        ctx.fillStyle = 'rgba(23,19,15,0.85)';
        ctx.font = '700 10px JetBrains Mono, monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(note.name ?? '', x + 6, y);
      }

      // Bow direction above the note
      if (note.strokeStart && note.bowSymbol && w > 14) {
        ctx.fillStyle = 'rgba(224,166,61,0.75)';
        ctx.font = '700 11px JetBrains Mono, monospace';
        ctx.fillText(note.bowSymbol, x + 2, y - 16);
      }
    }

    // Your live pitch
    if (live && live.midi != null) {
      const exactMidi = live.midi + (live.cents || 0) / 100;
      const y = yFor(exactMidi);
      const good = Math.abs(live.cents ?? 0) <= tolerance;

      ctx.beginPath();
      ctx.arc(playheadX, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = good ? '#7fa65c' : '#c15a48';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(playheadX, y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = good ? 'rgba(127,166,92,0.35)' : 'rgba(193,90,72,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function destroy() {
    observer.disconnect();
  }

  return { draw, destroy, yFor };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
