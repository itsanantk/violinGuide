# Violin Guide

An interactive violin learning guide and practice assistant that listens through
your microphone. It teaches the basics from the ground up, gives practice advice,
holds a library of songs with note-by-note fingering, and checks in real time
whether you are actually playing in tune.

Built for a self-taught early beginner. No teacher assumed, no account, no server.

## Running it

Double-click **`start.bat`**, or:

```
py -m http.server 8080
```

then open <http://localhost:8080>.

It must be served over `http://localhost`, not opened as a file. Browsers refuse
microphone access and ES modules from `file://`, and the failure looks like the
app is broken rather than blocked.

Click **Enable sound & mic** once per session — Chrome will not start audio or
listen without a click first.

## What's in it

| Page | What it does |
| --- | --- |
| **Today** | Practice streak, a suggested 20-minute session built from your current level, recent songs |
| **Learn** | Seven levels from holding the violin to playing the songs, with mic-checked drills |
| **Songs** | Guides, full note tables, notation, and two practice modes per song |
| **Tuner** | Live pitch, cents readout, reference drone, the four open strings |
| **Trainer** | Daily drills — note checks, long tones, scales, and ear training |
| **Fingerboard** | Every note in first position, clickable, with the finger for each |
| **Tips** | Advice organised for someone learning without a teacher |

### The two practice modes

**Learn mode** waits for you. It holds on each note until the microphone hears it
in tune, so you cannot practise straight past a mistake. Sections can be looped.

**Play-along** does not wait. The site plays the song while you play over it, and
every note is scored live as hit, close, wrong, or missed. Tempo goes down to 40%.

> Use headphones for play-along. Through speakers the microphone hears the backing
> track as well as your violin. Without headphones, turn off "Play the song" and
> keep the metronome — you still get scored.

## Songs

**Ode to Joy** and **Canon in D** are public domain and ship with complete note
data.

**500 Miles** and **Exit Music (For a Film)** are still under copyright, so they
ship as full practice guides — key, tempo, technique, what to drill — with the
melody left for you to add. Three ways to do that, in the song's editor:

- **Play it in.** Play the melody and the site writes it down. Leave a small gap
  between notes; that gap is how it knows where one ends.
- **Import MIDI.** Pick a `.mid` file you have. It is read in the browser and
  never uploaded. Chords are reduced to the top line.
- **Type it.** The shorthand format below.

Anything you add gets the same fingering, listening, scoring and play-along as
the built-in songs. So does any new song you create.

## The note format

```
# Verse                     a named section
D4 q, E4 q, F#4 q, G4 q |   four quarter notes, then a bar line
(A4 h, F#4 h) |             a slur — both notes in one bow stroke
rest q, D4 q., E4 e |       a rest, a dotted quarter, an eighth
A4 1.5                      or just say how many beats
// anything after slashes is a comment
```

Durations are `w h q e s` (whole, half, quarter, eighth, sixteenth); add `.` to
dot one. Notes are `D4`, `F#4`, `Bb3`. Open strings are G3, D4, A4, E5; middle C
is C4.

Bar lines are checked against the time signature and warn if a bar does not add
up. Notes outside first position are flagged, with a one-click octave shift when
one would fix it.

Bowing is derived, not written: a slur is one bow stroke, unslurred notes are one
each, and directions alternate down/up from the start, retaking down after a rest.

## Your data

Everything — progress, scores, streak, songs you added — lives in this browser's
`localStorage`. There is no backend. Clearing site data wipes it, so use
**Today → Your data → Export** if you care about the streak.

## Tests

```
npm test                      # all three suites

node test/pitch.test.mjs      # pitch detection accuracy
node test/notation.test.mjs   # parsing, slurs, bowing, fingering, song data
node test/scoring.test.mjs    # hit/close/wrong/missed judgement
```

The pitch tests check the detector against synthesised sawtooth, sine and
harmonic-rich buffers across the violin range, verifying it lands within 3 cents,
does not make octave errors, and refuses to guess on silence or noise.

## How it works

- **Pitch detection** is the McLeod Pitch Method — normalised square difference
  autocorrelation with parabolic interpolation, plus an RMS gate and a median
  smoother. Chosen over plain autocorrelation because a violin's strong upper
  harmonics make naive autocorrelation report the octave above.
- **Playback** schedules Web Audio events ahead of the audio clock rather than
  firing them from `requestAnimationFrame`, so the metronome does not drift.
- **The violin voice** is a sawtooth through a tracking lowpass with shallow
  vibrato — a bowed string really does produce near-sawtooth motion, so it lands
  closer to a violin than a sine would without shipping samples.
- **Fingering is never stored**, only derived, so an edited note can never
  disagree with its own finger diagram.

No dependencies, no build step, no network calls except the Google Fonts
stylesheet.

## Layout

```
index.html
css/          style.css · components.css
js/
  app.js        router and shell
  store.js      localStorage
  theory.js     notes, frequencies, first-position fingering
  notation.js   the shorthand format, slurs, bowing
  audio/        pitch · mic · synth · scheduler · transcribe
  data/         songs · curriculum · tips · midi
  ui/           fingerboard · staff · noteLane · drill · dom
  views/        one per page
test/
```
