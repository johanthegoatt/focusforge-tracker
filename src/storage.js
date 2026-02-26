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
  const fallback = { minutes: 25 };
  try {
    const raw = storage.getItem(PREF_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const minutes = Number(parsed.minutes);
    return {
      minutes: Number.isFinite(minutes) ? minutes : fallback.minutes
    };
  } catch {
    return fallback;
  }
}

export function savePreferences(preferences, storage = localStorage) {
  storage.setItem(PREF_KEY, JSON.stringify(preferences));
}

