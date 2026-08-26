// Practice advice, written for someone learning without a teacher.
//
// Bias throughout: things you can check on yourself, and the specific mistakes
// nobody is standing there to correct.

export const TIP_GROUPS = [
  {
    id: 'setup',
    title: 'Holding the thing',
    blurb: 'Most beginner pain is a setup problem, not a practice problem.',
    tips: [
      {
        title: 'The violin should stay up without your left hand',
        body: 'Rest it on your collarbone, not your shoulder, and let the weight of your ' +
          'jaw hold it. Test it: let go with your left hand entirely. If the violin drops, ' +
          'your shoulder rest or chin rest is not set up for your neck length yet.',
        why: 'If the left hand is holding the instrument up, it cannot move freely, and ' +
          'every finger placement fights the grip.',
      },
      {
        title: 'Your left wrist should be straight',
        body: 'Look at your wrist from the side. If it is bent inward so your palm ' +
          'approaches the neck, the fingers lose reach and the 4th finger becomes ' +
          'impossible. Bring the elbow further under the violin instead.',
        why: 'A collapsed wrist is the single most common self-taught habit, and it caps ' +
          'how far you can get before you have to unlearn it.',
      },
      {
        title: 'Thumb opposite the first finger, roughly',
        body: 'The left thumb sits lightly on the side of the neck, across from the first ' +
          'or second finger. It should not clamp, and the neck should not sit in the ' +
          'web between thumb and index.',
        why: 'A clamped thumb tenses the whole hand and makes shifting impossible later.',
      },
      {
        title: 'Check for a raised shoulder',
        body: 'Play a few notes in front of a mirror or with your phone recording. If your ' +
          'left shoulder has crept up toward your ear, stop and reset. Do this check every ' +
          'session for a while — it creeps back.',
        why: 'Raised shoulders cause the neck and back pain people assume is normal. It is not.',
      },
    ],
  },
  {
    id: 'bow',
    title: 'The bow arm',
    blurb: 'Tone lives here. Almost all of it.',
    tips: [
      {
        title: 'Bow parallel to the bridge',
        body: 'The bow should travel in a straight line perpendicular to the strings, not ' +
          'drift toward the fingerboard or bridge. Watch it in a mirror, or look down at ' +
          'the bow while you play a slow open string.',
        why: 'A crooked bow makes a thin, whistly sound no amount of finger accuracy fixes.',
      },
      {
        title: 'Bent thumb, loose fingers',
        body: 'The bow thumb stays curved, tucked at the corner where the frog meets the ' +
          'stick. If it locks straight, the whole hand stiffens. Your pinky rests curved ' +
          'on top of the stick.',
        why: 'A straight thumb is a locked hand, and a locked hand cannot control weight ' +
          'or make a smooth bow change.',
      },
      {
        title: 'Weight from the arm, not squeeze from the hand',
        body: 'Tone comes from letting the arm\'s weight fall into the string through a ' +
          'relaxed hand. If you are gripping to get volume, you will get a crushed sound ' +
          'instead of a loud one.',
        why: 'Squeezing is the reason beginner violins sound scratchy even when in tune.',
      },
      {
        title: 'Three things control your sound',
        body: 'Bow speed, bow weight, and how far you are from the bridge. Closer to the ' +
          'bridge takes more weight and gives more edge; closer to the fingerboard wants ' +
          'less weight and gives a softer sound. Experiment on one open string.',
        why: 'Once you know these three, you can fix a bad sound deliberately instead of ' +
          'hoping it improves.',
      },
      {
        title: 'Use the whole bow',
        body: 'Beginners live in the middle third. Practise long open-string notes going ' +
          'from frog to tip and back, keeping the sound even the whole way.',
        why: 'The bow behaves differently at each end. If you never go there, half your ' +
          'instrument is unavailable.',
      },
    ],
  },
  {
    id: 'intonation',
    title: 'Playing in tune',
    blurb: 'This is what the microphone is for.',
    tips: [
      {
        title: 'Tapes are fine. Use them.',
        body: 'Put tape at 1st, 2nd, 3rd and 4th finger. There is no purity points for ' +
          'suffering. Take them off gradually — the 1st finger tape usually comes off first.',
        why: 'You need a correct reference while your ear is still developing. Guessing ' +
          'badly for months just teaches your hand the wrong positions.',
      },
      {
        title: 'Listen for the ring',
        body: 'When you play a note perfectly in tune that matches an open string — D, A, ' +
          'E, G and their octaves — the open string vibrates along with it and the sound ' +
          'suddenly blooms. Chase that feeling.',
        why: 'It is a physical, audible check that works without any device, and it trains ' +
          'the ear faster than a tuner does.',
      },
      {
        title: 'Use the drone',
        body: 'Put a drone on the tuner page, then play a slow scale against it. Every ' +
          'note will sound consonant or grating against the drone. That contrast is far ' +
          'easier to hear than a note in isolation.',
        why: 'Intonation is relative. Hearing a note against a reference is how you actually ' +
          'develop pitch, rather than reading a number off a needle.',
      },
      {
        title: 'Fix from the source, not the note',
        body: 'If your 3rd finger is consistently flat, the problem is usually the hand ' +
          'position or a collapsed wrist, not the finger. Reset the frame and check again.',
        why: 'Correcting one note at a time is endless. Correcting the hand shape fixes ' +
          'a whole group at once.',
      },
      {
        title: 'Do not stare at the needle',
        body: 'Play the note, then look. If you watch the tuner while you play you will ' +
          'chase it with your finger and never build the ear.',
        why: 'The goal is to hear when you are out of tune, not to read when you are.',
      },
    ],
  },
  {
    id: 'practice',
    title: 'How to practise',
    blurb: 'Twenty focused minutes beats two distracted hours.',
    tips: [
      {
        title: 'Slow is not a warm-up, it is the method',
        body: 'Play a passage at the speed where you get it right every single time, then ' +
          'raise the tempo by about 5%. If it breaks, drop back. This feels absurdly slow ' +
          'and it works better than anything else.',
        why: 'Practising a mistake fast is just rehearsing the mistake.',
      },
      {
        title: 'Practise the hard bar, not the whole song',
        body: 'Find the two bars that go wrong and play only those, twenty times. Running ' +
          'the piece top to bottom mostly rehearses the parts you can already do.',
        why: 'Time spent on what you can already play does not make you better at what you cannot.',
      },
      {
        title: 'Separate the hands',
        body: 'If a passage is not working, play it with the left hand alone (silent ' +
          'fingering, or plucked), then bow the rhythm on open strings. Put them back ' +
          'together afterward.',
        why: 'Two problems at once is usually one problem you cannot see.',
      },
      {
        title: 'Record yourself weekly',
        body: 'Your phone is enough. Playing feels different from how it sounds, and you ' +
          'will hear things live that you cannot notice while concentrating on doing them.',
        why: 'Without a teacher, a recording is your second pair of ears. It is the closest ' +
          'substitute there is.',
      },
      {
        title: 'End on something that works',
        body: 'Finish each session playing something you can do well. Stopping in ' +
          'frustration makes tomorrow harder.',
        why: 'Consistency beats intensity, and consistency is mostly about wanting to come back.',
      },
      {
        title: 'A short session still counts',
        body: 'Ten minutes daily beats ninety minutes on Sunday. Log it and keep the streak.',
        why: 'Physical skills consolidate between sessions. Frequency matters more than duration.',
      },
    ],
  },
  {
    id: 'care',
    title: 'Looking after it',
    blurb: 'Cheap habits that prevent expensive problems.',
    tips: [
      {
        title: 'Loosen the bow after every session',
        body: 'Turn the screw until the hair is slack but not flopping. Tighten before ' +
          'playing until roughly a pencil fits between hair and stick at the middle.',
        why: 'Leaving a bow tight warps the camber permanently. It is the most common way ' +
          'people quietly ruin a bow.',
      },
      {
        title: 'Wipe the rosin dust off',
        body: 'A dry cloth over the strings and the top of the violin after playing. Never ' +
          'use household cleaners or water on the varnish.',
        why: 'Rosin dust bonds to varnish over time and is genuinely difficult to remove later.',
      },
      {
        title: 'Do not touch the bow hair',
        body: 'Skin oils stop rosin gripping. Handle the bow by the stick and frog only.',
        why: 'Oily patches on the hair make dead spots where the bow will not grab the string.',
      },
      {
        title: 'New strings, roughly yearly',
        body: 'If you play daily. Old strings go dull, false, and hard to tune. Change them ' +
          'one at a time so the bridge and soundpost keep their tension.',
        why: 'Changing all four at once can drop the soundpost inside the violin, which is ' +
          'a shop visit.',
      },
      {
        title: 'Watch the bridge',
        body: 'The back of the bridge should sit at 90 degrees to the top of the violin. ' +
          'Tuning pulls it forward over time. Straighten it gently, or take it in.',
        why: 'A leaning bridge eventually warps or snaps, and it kills the tone before it does.',
      },
    ],
  },
  {
    id: 'noteacher',
    title: 'Learning without a teacher',
    blurb: 'Where self-teaching actually goes wrong, and what to do instead.',
    tips: [
      {
        title: 'Get one lesson, occasionally',
        body: 'Even a single lesson every month or two catches the setup problems that ' +
          'cost months. If that is not possible, post a short video to a violin forum ' +
          'and ask specifically about your bow hold and left wrist.',
        why: 'The things you cannot self-diagnose are almost entirely physical setup, and ' +
          'they are what limit you two years from now.',
      },
      {
        title: 'Film yourself from the front and the side',
        body: 'Two angles. Front shows bow straightness and shoulder tension; side shows ' +
          'left wrist and thumb. Compare against a good player doing the same thing.',
        why: 'It is the closest you can get to having someone watch you.',
      },
      {
        title: 'Trust discomfort as a signal',
        body: 'Tension, pinching, or pain means something is wrong with position — never ' +
          'push through it. Stop, reset, and if it repeats, change the setup.',
        why: 'Playing through pain causes injuries that take far longer to heal than they ' +
          'took to cause.',
      },
      {
        title: 'Do not skip the boring parts',
        body: 'Scales, long tones and open-string bowing feel like a detour from songs. ' +
          'They are the fastest route to playing songs well.',
        why: 'Self-taught players usually over-index on repertoire and under-index on ' +
          'fundamentals, then plateau.',
      },
    ],
  },
];

export function findTip(groupId, index) {
  return TIP_GROUPS.find((g) => g.id === groupId)?.tips[index] ?? null;
}

export function allTips() {
  return TIP_GROUPS.flatMap((g) => g.tips.map((t) => ({ ...t, group: g.title })));
}
