// The learning path, ordered. Each level builds the specific thing the next
// one needs, and the whole ladder points at the D major / B minor finger
// pattern the song library uses.
//
// Exercises that say `check` are verified by the microphone — the type maps to
// a drill in views/learn.js.

export const LEVELS = [
  {
    id: 'l0',
    number: 0,
    title: 'Know your violin',
    blurb: 'Ten minutes that saves you a lot of confusion later.',
    lessons: [
      {
        id: 'l0-parts',
        title: 'The parts you actually need names for',
        detail: 'Scroll, pegs, nut, fingerboard, strings, bridge, f-holes, tailpiece, fine tuners, chin rest.',
        body: 'The four strings from left to right as you hold it are G, D, A, E — lowest to '
          + 'highest. The pegs at the scroll make big tuning changes; the fine tuners at the '
          + 'tailpiece make small ones. The bridge is not glued down — it is held by string '
          + 'tension alone, which is why you never let all four strings go slack at once.',
      },
      {
        id: 'l0-bow',
        title: 'The bow, and rosin',
        detail: 'Tighten before playing, loosen after. Rosin is what makes sound possible.',
        body: 'Tighten the bow until roughly a pencil fits between the hair and the stick at '
          + 'the middle — never more. Loosen it after every session or the stick warps. A new '
          + 'bow needs rosin worked in properly: ten to twenty firm strokes along the full '
          + 'length. Without rosin the bow slides silently across the string and beginners '
          + 'often think the violin is broken.',
      },
      {
        id: 'l0-tuning',
        title: 'How tuning works',
        detail: 'Tighter is sharper. Tune A first, then D, G, E.',
        body: 'Turning a peg or fine tuner tightens the string, raising the pitch. Push the peg '
          + 'gently inward as you turn or it will slip straight back out. Use the Tuner page: '
          + 'bow one string at a time and bring it up slowly. If a string is sharp, come down '
          + 'below the note and come back up to it — approaching from below holds better.',
      },
    ],
    exercises: [
      {
        id: 'l0-ex-tune',
        title: 'Get all four strings in tune',
        type: 'openStrings',
        detail: 'Bow each open string and bring it within 15 cents.',
        tolerance: 15,
        holdSeconds: 1,
      },
    ],
  },

  {
    id: 'l1',
    number: 1,
    title: 'Holding it',
    blurb: 'The part that has no shortcut, and the part self-taught players get wrong.',
    lessons: [
      {
        id: 'l1-hold',
        title: 'Violin on the collarbone',
        detail: 'Not the shoulder. Jaw weight holds it, not the left hand.',
        body: 'The violin rests on your collarbone with the chin rest under your jaw, pointing '
          + 'roughly at your left foot. Let the weight of your head hold it. Test: drop your '
          + 'left hand completely — the violin should stay. If it falls, you need a shoulder '
          + 'rest, or a taller one. This is a setup problem, not a strength problem.',
      },
      {
        id: 'l1-lefthand',
        title: 'Left hand frame',
        detail: 'Straight wrist, thumb light on the side of the neck, fingers curved over the strings.',
        body: 'The neck sits on the pad of your first finger and against the side of your thumb '
          + '— not in the web between them. Wrist straight, seen from the side. Elbow tucked '
          + 'under the violin so your fingers can curve down onto the strings rather than '
          + 'reaching flat across them. A collapsed wrist is the single most common self-taught '
          + 'habit and it caps how far you can get.',
      },
      {
        id: 'l1-bowhold',
        title: 'Bow hold',
        detail: 'Bent thumb at the frog corner, curved pinky on top, fingers relaxed and spread.',
        body: 'Thumb bent, tip touching the corner where the frog meets the stick. Middle two '
          + 'fingers drape over the stick, index a little further along, pinky curved on top of '
          + 'the stick. Everything stays soft — the bow is balanced, not gripped. Practise '
          + 'picking the bow up and putting it down until the shape happens by itself.',
      },
      {
        id: 'l1-check',
        title: 'Check yourself on video',
        detail: 'Film from the front and the side. Do it again in a month.',
        body: 'Front angle shows bow straightness and whether your shoulder is creeping up. '
          + 'Side angle shows the left wrist and thumb. Without a teacher this recording is '
          + 'your second pair of eyes, and it catches things you genuinely cannot feel while '
          + 'concentrating on playing.',
      },
    ],
    exercises: [],
  },

  {
    id: 'l2',
    number: 2,
    title: 'Bowing open strings',
    blurb: 'No left hand at all. Just getting a real sound out.',
    lessons: [
      {
        id: 'l2-straight',
        title: 'Keep the bow parallel to the bridge',
        detail: 'Watch it in a mirror. It will want to drift toward the fingerboard.',
        body: 'Bow at a right angle to the string, halfway between the bridge and the end of '
          + 'the fingerboard. Move from the elbow for the upper half, and open the whole arm '
          + 'for the lower half. A crooked bow gives a thin whistly sound no amount of finger '
          + 'accuracy will fix.',
      },
      {
        id: 'l2-whole',
        title: 'Use the whole bow',
        detail: 'Frog to tip, evenly, without the sound changing.',
        body: 'Beginners live in the middle third. Draw slow full bows on the open D string and '
          + 'listen for the sound thinning at the tip or crunching at the frog. Evening that '
          + 'out is a weight problem: you need slightly more arm weight at the tip and less at '
          + 'the frog.',
      },
      {
        id: 'l2-crossing',
        title: 'String crossings',
        detail: 'Move the whole arm to a new level, not just the wrist.',
        body: 'Each string sits at a different arm height. Practise going D–A–D–A slowly, '
          + 'stopping on each, then without stopping. Then try G–D–A–E and back. Do this '
          + 'before you ever try it inside a song.',
      },
      {
        id: 'l2-tone',
        title: 'The three things that control tone',
        detail: 'Speed, weight, and distance from the bridge.',
        body: 'On one open string, try: fast light bow near the fingerboard; slow heavy bow near '
          + 'the bridge; and the wrong combinations, so you hear what a bad sound is made of. '
          + 'Once you can name what is wrong you can fix it deliberately.',
      },
    ],
    exercises: [
      {
        id: 'l2-ex-hold',
        title: 'Hold each open string steady',
        type: 'longTone',
        detail: 'Two seconds within 20 cents, on all four strings.',
        notes: ['G3', 'D4', 'A4', 'E5'],
        tolerance: 20,
        holdSeconds: 2,
      },
    ],
  },

  {
    id: 'l3',
    number: 3,
    title: 'First position',
    blurb: 'Fingers down. This is the pattern every song in the library uses.',
    lessons: [
      {
        id: 'l3-tapes',
        title: 'Put tapes on',
        detail: 'At 1st, 2nd, 3rd and 4th finger. Take them off gradually, later.',
        body: 'Use the Fingerboard page to see where they go. There are no purity points for '
          + 'guessing — you need a correct reference while your ear develops, and months of '
          + 'guessing wrong teaches your hand the wrong positions. The 1st finger tape usually '
          + 'comes off first, once that note is reliable.',
      },
      {
        id: 'l3-pattern',
        title: 'The D major finger pattern',
        detail: 'High 2nd finger: 2 sits right against 3, not evenly spaced.',
        body: 'On the D and A strings the pattern is: 1st finger a whole step up, 2nd finger a '
          + 'whole step above that (so F# and C#), 3rd finger a half step above 2 — meaning 2 '
          + 'and 3 are touching. That crowded feeling between 2 and 3 is the whole pattern. '
          + 'Every song here uses it.',
      },
      {
        id: 'l3-fingers',
        title: 'Drop from the knuckle, keep fingers down',
        detail: 'Fingers curve and fall from the base joint. Leave lower fingers down.',
        body: 'When you play 3rd finger, leave 1 and 2 down. It keeps the hand shaped and makes '
          + 'the next note faster. Fingers fall from the base knuckle rather than reaching from '
          + 'the tip, and land on the fingertip, not the pad.',
      },
      {
        id: 'l3-ring',
        title: 'Listen for the ring',
        detail: 'A perfectly in-tune note that matches an open string makes the violin bloom.',
        body: 'Play 3rd finger G on the D string. When it is exactly in tune, the G string '
          + 'vibrates along with it and the sound suddenly opens up. Same with 1st finger E on '
          + 'the D string against... nothing, but 3rd finger A on the D string rings against '
          + 'the open A. Chase that. It trains your ear faster than a tuner does.',
      },
    ],
    exercises: [
      {
        id: 'l3-ex-dstring',
        title: 'The D string, note by note',
        type: 'noteSet',
        detail: 'D, E, F#, G, A — played in tune, in any order the app asks.',
        notes: ['D4', 'E4', 'F#4', 'G4', 'A4'],
        tolerance: 25,
        rounds: 10,
      },
      {
        id: 'l3-ex-astring',
        title: 'The A string, note by note',
        type: 'noteSet',
        detail: 'A, B, C#, D, E — the same pattern, one string up.',
        notes: ['A4', 'B4', 'C#5', 'D5', 'E5'],
        tolerance: 25,
        rounds: 10,
      },
    ],
  },

  {
    id: 'l4',
    number: 4,
    title: 'Scales',
    blurb: 'The most useful boring thing you will ever do.',
    lessons: [
      {
        id: 'l4-dmajor',
        title: 'D major, one octave',
        detail: 'D E F# G A B C# D — open D up to 3rd finger on the A string.',
        body: 'Starts on the open D string, crosses to the A string at the fifth note. Play it '
          + 'slowly with four counts per note, checking each against the tuner. Then two counts. '
          + 'Then one. Do not speed up until every note is right at the slower speed.',
      },
      {
        id: 'l4-bminor',
        title: 'B minor, two octaves',
        detail: 'B3 to B5. Fits first position exactly, and preps the harder songs.',
        body: 'From 2nd finger B on the G string up to 4th finger B on the E string. It is the '
          + 'same two sharps as D major — the same finger pattern — but it covers all four '
          + 'strings and the full first-position range. A two-octave D major would need a '
          + 'shift, which is why this is the two-octave scale here.',
      },
      {
        id: 'l4-drone',
        title: 'Practise against a drone',
        detail: 'Put the tonic drone on and play the scale over it.',
        body: 'Intonation is relative, not absolute. Against a sustained D, every note of a D '
          + 'major scale sounds either consonant or grating, and the difference is far easier '
          + 'to hear than a note by itself. Use the drone on the Tuner page. This is the single '
          + 'fastest way to improve intonation.',
      },
      {
        id: 'l4-longtones',
        title: 'Long tones',
        detail: 'One note, one full slow bow, absolutely steady.',
        body: 'Eight counts up-bow, eight counts down-bow, on one note, keeping the pitch and '
          + 'the volume dead steady the whole way. It is dull and it is the fastest route to a '
          + 'good sound. The long-tone game in Trainer scores you on it.',
      },
    ],
    exercises: [
      {
        id: 'l4-ex-dmajor',
        title: 'D major scale, one octave',
        type: 'scale',
        detail: 'Up and down, every note verified.',
        tonic: 'D4',
        quality: 'major',
        octaves: 1,
        tolerance: 25,
      },
      {
        id: 'l4-ex-bminor',
        title: 'B minor scale, two octaves',
        type: 'scale',
        detail: 'B3 to B5 and back. All four strings.',
        tonic: 'B3',
        quality: 'minor',
        octaves: 2,
        tolerance: 30,
      },
    ],
  },

  {
    id: 'l5',
    number: 5,
    title: 'Rhythm and bowing',
    blurb: 'Notes in the right place, in the right direction.',
    lessons: [
      {
        id: 'l5-count',
        title: 'Count out loud',
        detail: 'Actually out loud. Silently does not work the same way.',
        body: 'Say "one two three four" while you play. It sounds silly and it fixes rhythm '
          + 'problems that no amount of listening does. Dotted rhythms especially — count '
          + '"one-two-and" so the short note really is short.',
      },
      {
        id: 'l5-metronome',
        title: 'Use the metronome properly',
        detail: 'Set it slow enough to be right every time, then move up 5%.',
        body: 'Start at the speed where you never make a mistake — this will feel absurdly slow. '
          + 'Play it correct five times, then raise the tempo about 5%. If it breaks, go back '
          + 'down. The play-along has a tempo slider that goes down to 40%.',
      },
      {
        id: 'l5-bowing',
        title: 'Down-bow and up-bow',
        detail: '⊓ is down (frog to tip), ∨ is up. Strong beats usually take a down-bow.',
        body: 'Bows alternate by default. A slur — notes joined under a curve — means all of '
          + 'those notes happen in one bow stroke, which is why slurs change bow direction '
          + 'planning. The song pages show the bow direction above every note.',
      },
      {
        id: 'l5-slurs',
        title: 'Slurs',
        detail: 'Two or more notes in one bow. Keep the bow moving evenly through the change.',
        body: 'The bow does not stop or change speed when the finger changes — that is what '
          + 'makes it sound joined. Practise two notes to a bow, then four, keeping the bow '
          + 'speed constant so both notes get equal length.',
      },
    ],
    exercises: [],
  },

  {
    id: 'l6',
    number: 6,
    title: 'The songs',
    blurb: 'Everything above, applied. Work down the list.',
    lessons: [
      {
        id: 'l6-ode',
        title: 'Ode to Joy',
        detail: 'Two strings, stepwise, no surprises. Your first real piece.',
        body: 'Uses only what Level 3 taught. Learn mode first, then play-along at 60% and work '
          + 'the tempo up. Watch the dotted rhythm at the end of each phrase.',
        link: '#/songs/ode-to-joy',
      },
      {
        id: 'l6-500',
        title: '500 Miles',
        detail: 'Same key, slower, more about tone than fingers.',
        body: 'Needs its notes added first — play it in, import a MIDI, or type it. Then it is '
          + 'a bow-distribution exercise more than a left-hand one.',
        link: '#/songs/five-hundred-miles',
      },
      {
        id: 'l6-canon',
        title: 'Canon in D',
        detail: 'All four strings, up to F#5 on the E string.',
        body: 'A real step up. Learn the quicker second section first — the slow opening exposes '
          + 'every wobble in your bow and is harder than it looks.',
        link: '#/songs/canon-in-d',
      },
      {
        id: 'l6-exit',
        title: 'Exit Music (For a Film)',
        detail: 'B minor, very slow, very exposed. Save it for last.',
        body: 'Do the two-octave B minor scale from Level 4 until it is solid first. This piece '
          + 'is a bow-control test wearing a melody, and attempting it too early mostly teaches '
          + 'frustration.',
        link: '#/songs/exit-music',
      },
    ],
    exercises: [],
  },
];

export function allLessons() {
  return LEVELS.flatMap((level) => level.lessons.map((l) => ({ ...l, levelId: level.id })));
}

export function allExercises() {
  return LEVELS.flatMap((level) => level.exercises.map((e) => ({ ...e, levelId: level.id })));
}

export function getExerciseById(id) {
  return allExercises().find((e) => e.id === id) ?? null;
}

export function totalSteps() {
  return allLessons().length + allExercises().length;
}
