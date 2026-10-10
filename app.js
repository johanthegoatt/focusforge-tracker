import { recordSession, summarizeSessions } from "./src/stats.js";
import {
  completeInterval,
  createTimerState,
  normalizeCycleConfig,
  normalizeMinutes,
  pauseTimer,
  progressRatio,
  resetTimer,
  restoreTimer,
  setMinutes,
  snapshotTimer,
  startTimer,
  syncToClock
} from "./src/timerMachine.js";
import { loadPreferences, loadSessions, loadTimer, savePreferences, saveSessions, saveTimer } from "./src/storage.js";

const minutesInput = document.getElementById("minutes");
const timerEl = document.getElementById("timer");
const progressBarEl = document.getElementById("progress-bar");
const statsEl = document.getElementById("stats");
const historyEl = document.getElementById("history");
const statusEl = document.getElementById("status");
const modeEl = document.getElementById("mode");

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");
const completeBtn = document.getElementById("complete");
const nextBtn = document.getElementById("next");

const preferences = loadPreferences();
const sessions = loadSessions();
const timer = restoreTimer(loadTimer(), preferences.minutes);
const cycleConfig = normalizeCycleConfig({
  focusMinutes: preferences.minutes,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4
});
let intervalId = 0;

function toClock(seconds) {
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function persistTimer() {
  saveTimer(snapshotTimer(timer));
}

function renderTimer() {
  persistTimer();
  timerEl.textContent = toClock(timer.secondsLeft);
  modeEl.textContent = `Mode: ${timer.mode} | Completed focus intervals: ${timer.completedFocusIntervals}`;
  const ratio = Math.max(0, Math.min(1, progressRatio(timer)));
  progressBarEl.style.width = `${(ratio * 100).toFixed(2)}%`;
}

function renderStats() {
  const summary = summarizeSessions(sessions, new Date());
  statsEl.innerHTML = "";

  const rows = [
    `Total sessions: ${summary.totalSessions}`,
    `Total minutes: ${summary.totalMinutes}`,
    `Average session minutes: ${summary.averageSessionMinutes}`,
    `Current streak days: ${summary.streakDays}`,
    `Best streak days: ${summary.bestStreakDays}`,
    `Minutes in last 7 days: ${summary.last7DaysMinutes}`
  ];

  for (const row of rows) {
    const li = document.createElement("li");
    li.textContent = row;
    statsEl.append(li);
  }
}

function renderHistory() {
  historyEl.innerHTML = "";
  const recent = [...sessions].slice(-8).reverse();
  if (recent.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No sessions recorded yet.";
    historyEl.append(li);
    return;
  }

  for (const session of recent) {
    const item = document.createElement("li");
    const date = new Date(session.completedAt).toLocaleString();
    item.textContent = `${session.minutes}m completed at ${date}`;
    historyEl.append(item);
  }
}

function saveMinutesPreference(value) {
  preferences.minutes = normalizeMinutes(value);
  cycleConfig.focusMinutes = preferences.minutes;
  savePreferences(preferences);
}

function syncMinutesInput() {
  minutesInput.value = String(timer.minutes);
}

function stopTickLoop() {
  if (!intervalId) return;
  window.clearInterval(intervalId);
  intervalId = 0;
}

function tick() {
  const outcome = syncToClock(timer, Date.now());
  if (outcome === "noop") return;
  renderTimer();
  if (outcome === "finished") {
    stopTickLoop();
    finishInterval();
  }
}

// When time runs out the focus block is logged on the spot and the break is
// lined up, so a session is never lost to a forgotten button press.
function finishInterval() {
  const wasFocus = timer.mode === "focus";
  const minutes = timer.minutes;
  if (wasFocus) {
    recordSession(sessions, { minutes, completedAt: new Date(timer.finishedAt || Date.now()).toISOString() });
    saveSessions(sessions);
    renderStats();
    renderHistory();
  }
  const transition = completeInterval(timer, cycleConfig);
  renderTimer();
  statusEl.textContent = wasFocus
    ? `Nice, ${minutes} minutes logged. Time for a ${transition.nextMode === "long-break" ? "long" : "short"} break.`
    : "Break's over. Ready when you are.";
}

function ensureTickLoop() {
  if (intervalId) return;
  intervalId = window.setInterval(tick, 250);
}

function handleMinutesChange() {
  const next = normalizeMinutes(minutesInput.value);
  setMinutes(timer, next);
  saveMinutesPreference(next);
  syncMinutesInput();
  renderTimer();
  statusEl.textContent = `Session length set to ${next} minutes.`;
}

function handleStart() {
  const changed = startTimer(timer, Date.now());
  if (!changed) return;
  ensureTickLoop();
  statusEl.textContent = "Session started.";
  renderTimer();
}

function handlePause() {
  const changed = pauseTimer(timer, Date.now());
  stopTickLoop();
  renderTimer();
  if (!changed) {
    if (timer.phase === "finished") statusEl.textContent = "Timer finished. Press Complete Session or Next Interval.";
    return;
  }
  statusEl.textContent = "Session paused.";
}

function handleReset() {
  resetTimer(timer);
  stopTickLoop();
  renderTimer();
  statusEl.textContent = "Timer reset.";
}

function completeSession() {
  if (timer.mode !== "focus") {
    statusEl.textContent = "Only focus intervals are recorded as completed sessions.";
    return;
  }

  const completedMinutes = timer.minutes;
  recordSession(sessions, {
    minutes: completedMinutes,
    completedAt: new Date().toISOString()
  });
  saveSessions(sessions);
  renderStats();
  renderHistory();
  handleReset();
  statusEl.textContent = `Recorded ${completedMinutes} minutes.`;
}

function handleNextInterval() {
  const transition = completeInterval(timer, cycleConfig);
  if (!transition.transitioned) {
    statusEl.textContent = "Finish the current interval before moving to the next one.";
    return;
  }
  renderTimer();
  statusEl.textContent = `Switched to ${transition.nextMode}.`;
}

function handleKeyShortcuts(event) {
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === "input") return;

  if (event.code === "Space") {
    event.preventDefault();
    if (timer.phase === "running") {
      handlePause();
    } else {
      handleStart();
    }
    return;
  }

  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    handleReset();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    completeSession();
    return;
  }

  if (event.key === "n" || event.key === "N") {
    event.preventDefault();
    handleNextInterval();
  }
}

minutesInput.addEventListener("change", handleMinutesChange);
startBtn.addEventListener("click", handleStart);
pauseBtn.addEventListener("click", handlePause);
resetBtn.addEventListener("click", handleReset);
completeBtn.addEventListener("click", completeSession);
nextBtn.addEventListener("click", handleNextInterval);
document.addEventListener("keydown", handleKeyShortcuts);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tick();
  else persistTimer();
});

syncMinutesInput();
renderStats();
renderHistory();
if (timer.phase === "finished") {
  finishInterval();
} else {
  renderTimer();
  if (timer.phase === "running") ensureTickLoop();
}
