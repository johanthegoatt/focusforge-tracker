import { createSessionLog } from "./stats.js";

const SESSION_KEY = "focusforge:sessions:v2";
const PREF_KEY = "focusforge:preferences:v2";

export function loadSessions(storage = localStorage) {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return createSessionLog();
    return createSessionLog(JSON.parse(raw));
  } catch {
    return createSessionLog();
  }
}

export function saveSessions(log, storage = localStorage) {
  storage.setItem(SESSION_KEY, JSON.stringify(log));
}

export function loadPreferences(storage = localStorage) {
  const fallback = { minutes: 25, notes: false, label: "" };
  try {
    const raw = storage.getItem(PREF_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const minutes = Number(parsed.minutes);
    return {
      minutes: Number.isFinite(minutes) ? minutes : fallback.minutes,
      notes: parsed.notes === true,
      label: typeof parsed.label === "string" ? parsed.label.slice(0, 40) : ""
    };
  } catch {
    return fallback;
  }
}

export function savePreferences(preferences, storage = localStorage) {
  storage.setItem(PREF_KEY, JSON.stringify(preferences));
}


const TIMER_KEY = "focusforge:timer:v1";

export function loadTimer(storage = localStorage) {
  try {
    const raw = storage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTimer(snapshot, storage = localStorage) {
  try {
    storage.setItem(TIMER_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode or a full disk: the timer still works, it just won't survive a reload.
  }
}
