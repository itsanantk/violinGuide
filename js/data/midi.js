// A small Standard MIDI File reader.
//
// Only what this app needs: note on/off, tempo, and track names. Enough to pull
// a melody line out of a file you already have, without shipping a MIDI library.
//
// Chords are handled by keeping the highest note sounding at any moment, since
// the melody is almost always on top — and this app can only play one line.

const HEADER = 0x4d546864; // "MThd"
const TRACK = 0x4d54726b;  // "MTrk"

class Reader {
  constructor(buffer) {
    this.view = new DataView(buffer);
    this.pos = 0;
  }
  u8() { return this.view.getUint8(this.pos++); }
  u16() { const v = this.view.getUint16(this.pos); this.pos += 2; return v; }
  u32() { const v = this.view.getUint32(this.pos); this.pos += 4; return v; }
  bytes(n) {
    const out = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n);
    this.pos += n;
    return out;
  }
  /** MIDI variable-length quantity: 7 bits per byte, high bit means "continues". */
  varint() {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.u8();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) break;
    }
    return value;
  }
  get done() { return this.pos >= this.view.byteLength; }
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {{tracks: Array, ticksPerBeat: number, tempo: number}}
 * @throws {Error} with a readable message for anything that is not a MIDI file
 */
export function parseMidi(buffer) {
  const reader = new Reader(buffer);

  if (buffer.byteLength < 14 || reader.u32() !== HEADER) {
    throw new Error('That does not look like a MIDI file.');
  }
  const headerLength = reader.u32();
  reader.u16(); // format
  const trackCount = reader.u16();
  const division = reader.u16();
  reader.pos = 8 + headerLength;

  if (division & 0x8000) {
    throw new Error('This file uses SMPTE timing, which this importer does not read.');
  }
  const ticksPerBeat = division;

  let microsecondsPerBeat = 500000; // 120 bpm default
  const tracks = [];

  for (let t = 0; t < trackCount && !reader.done; t++) {
    if (reader.u32() !== TRACK) break;
    const length = reader.u32();
    const end = reader.pos + length;

    const events = [];
    let tick = 0;
    let runningStatus = 0;
    let name = '';

    while (reader.pos < end) {
      tick += reader.varint();
      let status = reader.u8();

      if (status < 0x80) {
        // Running status: reuse the last status byte and rewind one.
        reader.pos--;
        status = runningStatus;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;

      if (status === 0xff) {
        const metaType = reader.u8();
        const metaLength = reader.varint();
        const data = reader.bytes(metaLength);
        if (metaType === 0x51 && metaLength === 3) {
          microsecondsPerBeat = (data[0] << 16) | (data[1] << 8) | data[2];
        } else if (metaType === 0x03) {
          name = new TextDecoder().decode(data);
        }
      } else if (status === 0xf0 || status === 0xf7) {
        reader.pos += reader.varint();
      } else if (type === 0x80 || type === 0x90) {
        const note = reader.u8();
        const velocity = reader.u8();
        // A note-on with zero velocity is a note-off; plenty of files do this.
        const on = type === 0x90 && velocity > 0;
        events.push({ tick, on, note, velocity });
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        reader.pos += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        reader.pos += 1;
      } else {
        // Unknown status; bail on this track rather than reading garbage.
        break;
      }
    }

    reader.pos = end;
    if (events.length) tracks.push({ index: t, name, events });
  }

  if (!tracks.length) throw new Error('No notes found in that MIDI file.');

  return {
    tracks,
    ticksPerBeat,
    tempo: Math.round(60000000 / microsecondsPerBeat),
  };
}

/**
 * Turn one track into this app's notes.
 * Overlapping notes are reduced to the highest sounding pitch, and gaps become
 * rests, so a piano-style track still yields a playable single line.
 */
export function trackToNotes(track, ticksPerBeat, { quantiseTo = 0.25 } = {}) {
  const sounding = new Map(); // note -> startTick
  const segments = [];        // {startTick, endTick, note}

  for (const event of track.events) {
    if (event.on) {
      sounding.set(event.note, event.tick);
    } else if (sounding.has(event.note)) {
      const startTick = sounding.get(event.note);
      sounding.delete(event.note);
      if (event.tick > startTick) {
        segments.push({ startTick, endTick: event.tick, note: event.note });
      }
    }
  }

  if (!segments.length) return [];
  segments.sort((a, b) => a.startTick - b.startTick || b.note - a.note);

  // Walk forward, keeping the top voice and never letting notes overlap.
  const line = [];
  for (const segment of segments) {
    const previous = line.at(-1);
    if (!previous) { line.push({ ...segment }); continue; }

    if (segment.startTick < previous.endTick) {
      // Overlaps: keep whichever is higher, and trim the loser.
      if (segment.note > previous.note) {
        previous.endTick = segment.startTick;
        if (previous.endTick <= previous.startTick) line.pop();
        line.push({ ...segment });
      }
      // Lower note inside a higher one: drop it.
      continue;
    }
    line.push({ ...segment });
  }

  const notes = [];
  let cursor = line[0].startTick;

  for (const segment of line) {
    const restTicks = segment.startTick - cursor;
    const restBeats = snap(restTicks / ticksPerBeat, quantiseTo);
    if (restBeats >= quantiseTo) notes.push({ rest: true, beats: restBeats });

    const beats = snap((segment.endTick - segment.startTick) / ticksPerBeat, quantiseTo);
    if (beats >= quantiseTo) notes.push({ midi: segment.note, beats });

    cursor = segment.endTick;
  }

  return notes;
}

function snap(beats, step) {
  return Math.round(beats / step) * step;
}

/** A readable label for the track picker. */
export function describeTrack(track, ticksPerBeat) {
  const notes = track.events.filter((e) => e.on);
  if (!notes.length) return null;
  const pitches = notes.map((e) => e.note);
  const lowest = Math.min(...pitches);
  const highest = Math.max(...pitches);
  return {
    index: track.index,
    name: track.name || `Track ${track.index + 1}`,
    noteCount: notes.length,
    lowest,
    highest,
  };
}
