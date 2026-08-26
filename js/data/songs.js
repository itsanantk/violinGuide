// The song library.
//
// Notes are written as readable names ("F#4") with a duration in beats, so the
// whole arrangement stays hand-editable. Fingering is never stored — it is
// derived from theory.js at render time, so there is one source of truth and
// an edited note can't disagree with its own finger diagram.
//
// Beethoven and Pachelbel are public domain and ship with full note data.
// The two modern songs ship as practice guides with an empty `notes` array and
// `needsNotes: true`; you fill those in yourself with Record, MIDI import, or
// the note editor. See js/data/README.md.

import { parseNotation } from '../notation.js';

/** Compact writing helper: seq('Theme', 'F#4 q, F#4 q, G4 q') */
function seq(section, ...lines) {
  const { notes } = parseNotation(lines.join('\n'));
  return notes.map((n) => ({ ...n, section }));
}

const odeToJoy = {
  id: 'ode-to-joy',
  title: 'Ode to Joy',
  composer: 'Beethoven',
  year: 1824,
  key: 'D major',
  tempo: 96,
  timeSignature: [4, 4],
  difficulty: 1,
  builtIn: true,
  strings: ['G', 'D', 'A'],
  about:
    'The best first real song on the violin. It moves almost entirely by step, ' +
    'stays on two strings, and never asks for a note you have not already met in ' +
    'the D major scale.',
  guide: [
    {
      heading: 'Before you start',
      body: 'Play a D major scale slowly and check every note against the tuner. ' +
        'This whole melody lives inside that scale, so if the scale is in tune the ' +
        'song will be too.',
    },
    {
      heading: 'Fingers you need',
      body: 'On the D string: 1st finger E, 2nd finger F# (high 2 — right up against ' +
        'the 3rd finger), 3rd finger G. On the A string: open A. That is the entire ' +
        'song. The 2nd finger position is the one beginners get wrong; it should feel ' +
        'crowded next to the 3rd, not evenly spaced.',
    },
    {
      heading: 'The rhythm trap',
      body: 'The end of each phrase is a dotted quarter followed by an eighth — long, ' +
        'then quick. Almost everyone flattens this into two even notes. Count "one-two-and" ' +
        'out loud until the short note really is short.',
    },
    {
      heading: 'Bowing',
      body: 'Start with separate bows, one per note, using the middle third of the bow. ' +
        'Keep the bow parallel to the bridge. Once the notes are secure, try slurring ' +
        'each pair of repeated notes to smooth the line.',
    },
    {
      heading: 'How to practise it',
      body: 'Use Learn mode at first — it waits for each note, so you cannot rush past ' +
        'something out of tune. When you can get through cleanly, switch to Play-along ' +
        'at 60% tempo and work up.',
    },
  ],
  notes: [
    ...seq('Theme',
      'F#4 q, F#4 q, G4 q, A4 q',
      'A4 q, G4 q, F#4 q, E4 q',
      'D4 q, D4 q, E4 q, F#4 q',
      'F#4 q., E4 e, E4 h'),
    ...seq('Theme repeated',
      'F#4 q, F#4 q, G4 q, A4 q',
      'A4 q, G4 q, F#4 q, E4 q',
      'D4 q, D4 q, E4 q, F#4 q',
      'E4 q., D4 e, D4 h'),
    ...seq('Middle section',
      'E4 q, E4 q, F#4 q, D4 q',
      'E4 q, F#4 e, G4 e, F#4 q, D4 q',
      'E4 q, F#4 e, G4 e, F#4 q, E4 q',
      'D4 q, E4 q, A3 h'),
    ...seq('Final theme',
      'F#4 q, F#4 q, G4 q, A4 q',
      'A4 q, G4 q, F#4 q, E4 q',
      'D4 q, D4 q, E4 q, F#4 q',
      'E4 q., D4 e, D4 h'),
  ],
};

const canonInD = {
  id: 'canon-in-d',
  title: 'Canon in D',
  composer: 'Pachelbel',
  year: 1680,
  key: 'D major',
  tempo: 68,
  timeSignature: [4, 4],
  difficulty: 3,
  builtIn: true,
  strings: ['G', 'D', 'A', 'E'],
  about:
    'A simplified version of the famous melody. It uses all four strings and ' +
    'reaches up to F#5 on the E string, so it is a real step up from Ode to Joy — ' +
    'but every note is still first position.',
  guide: [
    {
      heading: 'What makes this harder',
      body: 'Two things: you cross all four strings, and you spend real time on the ' +
        'E string, which is unforgiving about intonation and bow pressure. Nothing ' +
        'here needs a shift, though.',
    },
    {
      heading: 'Start with the second half',
      body: 'The opening is long slow notes, which sounds easy but exposes every ' +
        'wobble in your bow. The quicker second section is more fun and more ' +
        'forgiving. Learn that first, then come back to the opening once your ' +
        'long tones are steadier.',
    },
    {
      heading: 'String crossings',
      body: 'Practise the quick section without the left hand at all: just bow the ' +
        'open strings in the same pattern the melody uses. The right arm needs to ' +
        'know where it is going before the fingers get involved.',
    },
    {
      heading: 'The E string',
      body: 'Use less bow weight up here than you think. If it whistles or sounds ' +
        'glassy, you are pressing. Move the bow a little further from the bridge and ' +
        'lighten the index finger.',
    },
    {
      heading: 'Tempo',
      body: 'It is written slow on purpose. Play-along starts at 68 bpm; drop it to ' +
        '50% while learning. Speed is the last thing to add, not the first.',
    },
  ],
  notes: [
    ...seq('Descending theme',
      'F#5 h, E5 h', 'D5 h, C#5 h', 'B4 h, A4 h', 'B4 h, C#5 h',
      'D5 h, C#5 h', 'B4 h, A4 h', 'G4 h, F#4 h', 'G4 h, E4 h'),
    ...seq('Variation',
      'D4 q, F#4 q, A4 q, G4 q', 'F#4 q, D4 q, F#4 q, E4 q',
      'D4 q, B3 q, D4 q, A4 q', 'G4 q, B4 q, A4 q, G4 q',
      'F#4 q, D4 q, E4 q, C#5 q', 'D4 q, F#4 q, A4 q, A4 q',
      'B4 q, G4 q, A4 q, F#4 q', 'D4 q, D4 q, D4 h'),
  ],
};

// --- Songs you supply the notes for --------------------------------------
//
// These carry everything except the melody: key, tempo, structure, and what to
// actually work on. Add the notes with Record, MIDI import, or the editor and
// every feature — Learn mode, Play-along, scoring, fingering — works exactly
// as it does for the built-in songs.

const fiveHundredMiles = {
  id: 'five-hundred-miles',
  title: '500 Miles',
  composer: 'Hedy West',
  year: 1961,
  key: 'D major',
  tempo: 92,
  timeSignature: [4, 4],
  difficulty: 2,
  builtIn: false,
  needsNotes: true,
  strings: ['D', 'A'],
  about:
    'A slow folk ballad in D major. Once you add the notes, this is a good second ' +
    'song: the range is narrow, the rhythm is gentle, and it rewards a singing tone ' +
    'more than fast fingers.',
  guide: [
    {
      heading: 'Getting the notes in',
      body: 'Easiest route: open Record and play the melody by ear one phrase at a ' +
        'time — the site writes down what it hears. If you have a MIDI file, import ' +
        'it instead and pick the melody track. You can fix any note afterwards in ' +
        'the editor.',
    },
    {
      heading: 'Why this key works',
      body: 'In D major you are using the same finger pattern as Ode to Joy and the ' +
        'D major scale: high 2nd finger on both the D and A strings. Nothing new for ' +
        'the left hand, so you can put your attention on tone.',
    },
    {
      heading: 'What to actually work on',
      body: 'Bow distribution. The phrases are long and slow, and beginners run out ' +
        'of bow halfway through. Practise drawing one full slow bow that lasts eight ' +
        'counts without changing speed or wandering toward the fingerboard.',
    },
    {
      heading: 'Make it sound like a song',
      body: 'Verses repeat, so vary them: play one verse near the fingerboard for a ' +
        'softer sound, the next closer to the bridge for more edge. Same notes, ' +
        'different colour.',
    },
    {
      heading: 'Drill first',
      body: 'Run the D major scale in Trainer as long tones before playing. Four ' +
        'counts up, four counts down, checking each note against the tuner.',
    },
  ],
  notes: [],
};

const exitMusic = {
  id: 'exit-music',
  title: 'Exit Music (For a Film)',
  composer: 'Radiohead',
  year: 1997,
  key: 'B minor',
  tempo: 64,
  timeSignature: [4, 4],
  difficulty: 4,
  builtIn: false,
  needsNotes: true,
  strings: ['G', 'D', 'A'],
  about:
    'Very slow, very exposed, in B minor. The hardest of the four — not because ' +
    'the notes are difficult but because slow playing hides nothing. Every bow ' +
    'change and every slightly-off finger is audible.',
  guide: [
    {
      heading: 'Getting the notes in',
      body: 'Play it by ear into Record a phrase at a time, or import a MIDI file ' +
        'and choose the vocal line. If the melody sits below the violin, transpose ' +
        'it up an octave in the editor — the site flags any note that falls outside ' +
        'first position.',
    },
    {
      heading: 'Learn the scale first',
      body: 'B natural minor, two octaves, B3 to B5. That fits first position ' +
        'exactly: 2nd finger on the G string at the bottom, 4th finger on the E ' +
        'string at the top. It is in the curriculum at Level 4, and it is genuinely ' +
        'the fastest way into this piece.',
    },
    {
      heading: 'B minor vs D major',
      body: 'Same two sharps, same finger pattern you already know. What changes is ' +
        'where the tune settles. Practise ending phrases on B and listening for it ' +
        'as home rather than D.',
    },
    {
      heading: 'The real challenge: bow control',
      body: 'At 64 bpm a whole note lasts nearly four seconds. Long tones are the ' +
        'whole game here. Use the long-tone game in Trainer and aim to hold a note ' +
        'steady within 10 cents for eight seconds before you attempt the piece.',
    },
    {
      heading: 'Tone',
      body: 'This wants a dark, close sound. Stay a little further from the bridge, ' +
        'keep the bow slow and heavy rather than fast and light, and let notes ' +
        'connect — no gap at the bow change.',
    },
    {
      heading: 'Save it for last',
      body: 'Work through the other three first. This one asks for control you build ' +
        'over months, and attempting it too early mostly teaches frustration.',
    },
  ],
  notes: [],
};

export const SONGS = [odeToJoy, fiveHundredMiles, canonInD, exitMusic];

export function getSong(id) {
  return SONGS.find((s) => s.id === id) || null;
}

/** Total beats, used for progress bars and duration estimates. */
export function totalBeats(song) {
  return song.notes.reduce((sum, n) => sum + n.beats, 0);
}

export function estimatedSeconds(song) {
  return (totalBeats(song) / song.tempo) * 60;
}

/** Built-in songs plus anything the user recorded, imported, or typed. */
export function allSongs(userSongs = []) {
  const overrides = new Map(userSongs.map((s) => [s.id, s]));
  const merged = SONGS.map((song) => {
    const user = overrides.get(song.id);
    if (!user) return song;
    overrides.delete(song.id);
    // A user's notes fill in a song that shipped without them.
    return { ...song, notes: user.notes, needsNotes: false, editedByUser: true };
  });
  return [...merged, ...overrides.values()];
}

export { seq };
