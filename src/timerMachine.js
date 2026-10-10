export function normalizeMinutes(value, min = 1, max = 90) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizedLongBreakEvery(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(12, Math.round(parsed)));
}

export function normalizeCycleConfig(input = {}) {
  return {
    focusMinutes: normalizeMinutes(input.focusMinutes ?? 25),
    shortBreakMinutes: normalizeMinutes(input.shortBreakMinutes ?? 5, 1, 60),
    longBreakMinutes: normalizeMinutes(input.longBreakMinutes ?? 15, 1, 90),
    longBreakEvery: normalizedLongBreakEvery(input.longBreakEvery ?? 4)
  };
}

export function createTimerState(initialMinutes = 25) {
  const minutes = normalizeMinutes(initialMinutes);
  return {
    minutes,
    durationSeconds: minutes * 60,
    secondsLeft: minutes * 60,
    phase: "idle",
    mode: "focus",
    completedFocusIntervals: 0,
    endsAt: 0
  };
}

export function setMinutes(state, minutes) {
  const next = normalizeMinutes(minutes);
  state.minutes = next;
  state.durationSeconds = next * 60;
  state.secondsLeft = next * 60;
  state.phase = "idle";
  state.mode = "focus";
  state.endsAt = 0;
  return state;
}

export function startTimer(state, now = Date.now()) {
  if (state.phase === "running") return false;
  if (state.phase === "finished" && state.secondsLeft === 0) {
    state.secondsLeft = state.durationSeconds;
  }
  state.phase = "running";
  state.endsAt = now + state.secondsLeft * 1000;
  return true;
}

export function pauseTimer(state, now = Date.now()) {
  if (state.phase !== "running") return false;
  syncToClock(state, now);
  if (state.phase !== "running") return false;
  state.phase = "paused";
  state.endsAt = 0;
  return true;
}

export function resetTimer(state) {
  state.secondsLeft = state.durationSeconds;
  state.phase = "idle";
  state.endsAt = 0;
  return state;
}

export function syncToClock(state, now = Date.now()) {
  if (state.phase !== "running" || !state.endsAt) return "noop";
  const left = Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  const changed = left !== state.secondsLeft;
  state.secondsLeft = left;
  if (left === 0) {
    state.phase = "finished";
    state.finishedAt = state.endsAt;
    state.endsAt = 0;
    return "finished";
  }
  return changed ? "tick" : "noop";
}

export function advanceSecond(state) {
  if (state.phase !== "running") return "noop";

  if (state.secondsLeft <= 0) {
    state.phase = "finished";
    return "finished";
  }

  state.secondsLeft -= 1;
  if (state.secondsLeft <= 0) {
    state.secondsLeft = 0;
    state.phase = "finished";
    return "finished";
  }

  return "tick";
}

export function progressRatio(state) {
  if (state.durationSeconds <= 0) return 0;
  return 1 - state.secondsLeft / state.durationSeconds;
}

function applyMode(state, mode, minutes) {
  state.mode = mode;
  state.minutes = minutes;
  state.durationSeconds = minutes * 60;
  state.secondsLeft = minutes * 60;
  state.phase = "idle";
  state.endsAt = 0;
}

export function completeInterval(state, cycleConfigInput = {}) {
  if (state.phase !== "finished") {
    return {
      transitioned: false,
      reason: "interval-not-finished",
      nextMode: state.mode
    };
  }

  const cycle = normalizeCycleConfig(cycleConfigInput);

  if (state.mode === "focus") {
    state.completedFocusIntervals += 1;
    const useLongBreak = state.completedFocusIntervals % cycle.longBreakEvery === 0;
    const nextMode = useLongBreak ? "long-break" : "short-break";
    const nextMinutes = useLongBreak ? cycle.longBreakMinutes : cycle.shortBreakMinutes;
    applyMode(state, nextMode, nextMinutes);
    return {
      transitioned: true,
      reason: "focus-complete",
      nextMode
    };
  }

  applyMode(state, "focus", cycle.focusMinutes);
  return {
    transitioned: true,
    reason: "break-complete",
    nextMode: "focus"
  };
}

const MODES = new Set(["focus", "short-break", "long-break"]);
const PHASES = new Set(["idle", "running", "paused", "finished"]);

// What gets written to storage so a reload, a crash or a tab the browser
// discarded in the background picks up where it left off.
export function snapshotTimer(state) {
  return {
    mode: state.mode,
    phase: state.phase,
    minutes: state.minutes,
    secondsLeft: state.secondsLeft,
    endsAt: state.endsAt,
    finishedAt: state.finishedAt || 0,
    completedFocusIntervals: state.completedFocusIntervals
  };
}

// Rebuild a timer from a snapshot. A running timer keeps counting against its
// end time, so time spent with the tab closed still counts. Anything that does
// not look like a snapshot gives a fresh timer.
export function restoreTimer(saved, fallbackMinutes = 25, now = Date.now()) {
  const state = createTimerState(fallbackMinutes);
  if (!saved || typeof saved !== "object") return state;
  if (!MODES.has(saved.mode) || !PHASES.has(saved.phase)) return state;

  const minutes = normalizeMinutes(saved.minutes);
  const duration = minutes * 60;
  const left = Math.round(Number(saved.secondsLeft));
  state.mode = saved.mode;
  state.minutes = minutes;
  state.durationSeconds = duration;
  state.secondsLeft = Number.isFinite(left) ? Math.max(0, Math.min(duration, left)) : duration;
  state.completedFocusIntervals = Math.max(0, Math.floor(Number(saved.completedFocusIntervals) || 0));
  state.phase = saved.phase;

  if (saved.phase === "running") {
    const endsAt = Number(saved.endsAt);
    if (!Number.isFinite(endsAt) || endsAt <= 0) {
      state.phase = "paused";
      return state;
    }
    state.endsAt = endsAt;
    syncToClock(state, now);
  }
  if (state.phase === "finished") {
    state.secondsLeft = 0;
    if (!state.finishedAt) state.finishedAt = Number(saved.finishedAt) || now;
  }
  return state;
}

const MODE_NAMES = { focus: "Focus", "short-break": "Break", "long-break": "Long break" };

export function clock(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

// The tab title is the one thing you can see while working in another tab,
// so it carries the time left whenever the clock is going.
export function tabTitle(state, appName = "FocusForge") {
  const name = MODE_NAMES[state.mode] || "Focus";
  if (state.phase === "running") return `${clock(state.secondsLeft)} ${name} | ${appName}`;
  if (state.phase === "paused") return `Paused ${clock(state.secondsLeft)} | ${appName}`;
  if (state.phase === "finished") return `Time's up! | ${appName}`;
  return appName;
}
