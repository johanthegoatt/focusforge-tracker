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
    completedFocusIntervals: 0
  };
}

export function setMinutes(state, minutes) {
  const next = normalizeMinutes(minutes);
  state.minutes = next;
  state.durationSeconds = next * 60;
  state.secondsLeft = next * 60;
  state.phase = "idle";
  state.mode = "focus";
  return state;
}

export function startTimer(state) {
  if (state.phase === "running") return false;
  if (state.phase === "finished" && state.secondsLeft === 0) {
    state.secondsLeft = state.durationSeconds;
  }
  state.phase = "running";
  return true;
}

export function pauseTimer(state) {
  if (state.phase !== "running") return false;
  state.phase = "paused";
  return true;
}

export function resetTimer(state) {
  state.secondsLeft = state.durationSeconds;
  state.phase = "idle";
  return state;
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
