// Everything the site remembers, in localStorage. No backend, no accounts.

const KEY = 'violinGuide.v1';

const EMPTY = {
  lessons: {},      // lessonId -> true
  exercises: {},    // exerciseId -> { passed, bestCents, at }
  songs: {},        // songId -> { bestAccuracy, lastPlayed, runs }
  userSongs: {},    // songId -> full song object the user recorded or imported
  practice: {},     // 'YYYY-MM-DD' -> minutes
  session: { date: null, done: [] },  // today's task list
  drills: {},       // drillId -> { date, index, record } mid-run position
  settings: {
    a4: 440,
    tolerance: 25,      // cents; how close counts as in tune
    metronome: true,
    countIn: true,
    tempoScale: 1,
    volume: 0.7,
  },
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = {
      ...structuredClone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
    };
  } catch {
    // Corrupted or unavailable storage shouldn't take the app down.
    cache = structuredClone(EMPTY);
  }
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    // Private browsing or a full quota — the app still works this session.
  }
}

export function getSettings() {
  return { ...load().settings };
}

export function setSetting(key, value) {
  load().settings[key] = value;
  save();
}

// --- Curriculum ----------------------------------------------------------

export function isLessonDone(id) {
  return Boolean(load().lessons[id]);
}

export function setLessonDone(id, done = true) {
  const data = load();
  if (done) data.lessons[id] = true;
  else delete data.lessons[id];
  save();
}

export function getExercise(id) {
  return load().exercises[id] || null;
}

export function recordExercise(id, { passed, avgCents }) {
  const data = load();
  const previous = data.exercises[id] || {};
  data.exercises[id] = {
    passed: passed || previous.passed || false,
    bestCents: previous.bestCents == null
      ? avgCents
      : Math.min(previous.bestCents, avgCents ?? Infinity),
    at: today(),
  };
  save();
}

export function completedLessonCount() {
  return Object.keys(load().lessons).length;
}

// --- Songs ---------------------------------------------------------------

export function getSongProgress(id) {
  return load().songs[id] || { bestAccuracy: 0, runs: 0, lastPlayed: null };
}

export function recordSongRun(id, { accuracy, avgCents, mode }) {
  const data = load();
  const previous = getSongProgress(id);
  data.songs[id] = {
    bestAccuracy: Math.max(previous.bestAccuracy || 0, accuracy),
    lastAccuracy: accuracy,
    lastAvgCents: avgCents,
    lastMode: mode,
    runs: (previous.runs || 0) + 1,
    lastPlayed: today(),
  };
  save();
}

/** Songs the user recorded, imported, or typed in. */
export function getUserSongs() {
  return Object.values(load().userSongs);
}

export function getUserSong(id) {
  return load().userSongs[id] || null;
}

export function saveUserSong(song) {
  load().userSongs[song.id] = song;
  save();
  return song;
}

export function deleteUserSong(id) {
  delete load().userSongs[id];
  save();
}

// --- Practice streak -----------------------------------------------------

export function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function logPractice(minutes = 1) {
  const data = load();
  const day = today();
  data.practice[day] = (data.practice[day] || 0) + minutes;
  save();
}

export function getPracticeLog() {
  return { ...load().practice };
}

/** Consecutive days practised, counting back from today (or yesterday). */
export function getStreak() {
  const log = load().practice;
  const cursor = new Date();
  let streak = 0;

  // Today not yet practised shouldn't read as a broken streak until tomorrow.
  const key = (d) => {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  if (!log[key(cursor)]) cursor.setDate(cursor.getDate() - 1);

  while (log[key(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function practisedToday() {
  return Boolean(load().practice[today()]);
}

// --- Backup --------------------------------------------------------------

export function exportAll() {
  return JSON.stringify(load(), null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  cache = { ...structuredClone(EMPTY), ...parsed };
  save();
}

export function resetAll() {
  cache = structuredClone(EMPTY);
  save();
}

// --- the daily session ---------------------------------------------------
//
// Kept per-day rather than cumulative: the session is "what to do today", so a
// new day starts it clean instead of showing yesterday's ticks.

function sessionToday() {
  const data = load();
  if (!data.session || data.session.date !== today()) {
    data.session = { date: today(), done: [] };
  }
  return data.session;
}

export function getSessionDone() {
  return [...sessionToday().done];
}

export function setSessionStep(id, done = true) {
  const session = sessionToday();
  const set = new Set(session.done);
  if (done) set.add(id);
  else set.delete(id);
  session.done = [...set];
  save();
}

export function resetSession() {
  const data = load();
  data.session = { date: today(), done: [] };
  save();
}

// --- drill progress ------------------------------------------------------
//
// Where you were in a drill, so leaving the page mid-scale does not throw the
// run away. Dated, because resuming yesterday's half-finished scale is not
// what anyone wants.

export function getDrillProgress(id) {
  const saved = load().drills?.[id];
  if (!saved || saved.date !== today()) return null;
  return saved;
}

export function saveDrillProgress(id, { index, record }) {
  const data = load();
  if (!data.drills) data.drills = {};
  data.drills[id] = { date: today(), index, record };
  save();
}

export function clearDrillProgress(id) {
  const data = load();
  if (data.drills) delete data.drills[id];
  save();
}

// --- per-song playback speed ---------------------------------------------

export function getSongTempoScale(id) {
  return load().songs[id]?.tempoScale ?? 1;
}

export function setSongTempoScale(id, scale) {
  const data = load();
  if (!data.songs[id]) data.songs[id] = { bestAccuracy: 0, runs: 0, lastPlayed: null };
  data.songs[id].tempoScale = scale;
  save();
}
