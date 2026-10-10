import { cleanLabel, minutesByLabel, recentLabels, recordSession, summarizeSessions } from "./src/stats.js";
import {
  clock,
  completeInterval,
  elapsedMinutes,
  normalizeCycleConfig,
  normalizeMinutes,
  pauseTimer,
  progressRatio,
  resetTimer,
  restoreTimer,
  setMinutes,
  snapshotTimer,
  startTimer,
  syncToClock,
  tabTitle
} from "./src/timerMachine.js";
import { askForNotes, chime, notesAllowed, notesSupported, showNote, unlockSound } from "./src/alerts.js";
import { loadPreferences, loadSessions, loadTimer, savePreferences, saveSessions, saveTimer } from "./src/storage.js";
import { createEmber } from "./src/ember.js";

const $ = (id) => document.getElementById(id);
const minutesInput = $("minutes");
const timerEl = $("timer");
const ringFill = $("ring-fill");
const modeEl = $("mode");
const roundEl = $("round");
const statsEl = $("stats");
const whereEl = $("where");
const historyEl = $("history");
const statusEl = $("status");
const startBtn = $("start");
const finishBtn = $("finish");
const nextBtn = $("next");
const resetBtn = $("reset");
const notesBox = $("notes");
const labelInput = $("label");
const labelList = $("label-list");
const cycleSteps = document.querySelectorAll(".cycle li");
const presetChips = document.querySelectorAll(".presets .chip");

const preferences = loadPreferences();
const sessions = loadSessions();
const timer = restoreTimer(loadTimer(), preferences.minutes);
const cycleConfig = normalizeCycleConfig({
  focusMinutes: preferences.minutes,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4
});
const ember = createEmber({
  tipFor: () => tipKey(),
  onWake: () => labelInput.focus()
});
let intervalId = 0;

const MODE_TEXT = { focus: "Focus", "short-break": "Short break", "long-break": "Long break" };

function tipKey() {
  if (timer.phase === "running") return timer.mode === "focus" ? "focusing" : "resting";
  if (timer.phase === "paused") return "paused";
  if (timer.mode !== "focus") return "breakReady";
  return sessions.length ? "ready" : "first";
}

function moodNow() {
  if (timer.phase === "running") return timer.mode === "focus" ? "focus" : "happy";
  if (timer.phase === "paused") return "worried";
  if (timer.mode !== "focus") return "happy";
  return sessions.length ? "happy" : "sleepy";
}

function say(text) {
  statusEl.textContent = text;
}

function persistTimer() {
  saveTimer(snapshotTimer(timer));
}

function renderTimer() {
  persistTimer();
  timerEl.textContent = clock(timer.secondsLeft);
  document.title = tabTitle(timer);
  modeEl.textContent = MODE_TEXT[timer.mode];
  const round = (timer.completedFocusIntervals % cycleConfig.longBreakEvery) + (timer.mode === "focus" ? 1 : 0);
  roundEl.textContent = timer.mode === "long-break"
    ? "You earned this one"
    : `Round ${Math.max(1, round)} of ${cycleConfig.longBreakEvery}`;
  const ratio = Math.max(0, Math.min(1, progressRatio(timer)));
  ringFill.style.strokeDashoffset = String(100 - ratio * 100);
  document.body.dataset.mode = timer.mode;
  document.body.dataset.phase = timer.phase;

  startBtn.textContent = timer.phase === "running" ? "Pause" : timer.phase === "paused" ? "Keep going" : "Start";
  finishBtn.hidden = !(timer.mode === "focus" && timer.phase !== "idle");
  nextBtn.textContent = timer.mode === "focus" ? "Skip to break" : "Skip break";
  for (const step of cycleSteps) step.classList.toggle("on", step.dataset.step === timer.mode);
  for (const chip of presetChips) chip.setAttribute("aria-pressed", String(Number(chip.dataset.minutes) === preferences.minutes));
  ember.mood(moodNow());
}

function tile(value, label) {
  const li = document.createElement("li");
  const big = document.createElement("strong");
  big.textContent = value;
  const small = document.createElement("span");
  small.textContent = label;
  li.append(big, small);
  return li;
}

function minutesText(total) {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function renderStats() {
  const summary = summarizeSessions(sessions, new Date());
  statsEl.replaceChildren(
    tile(minutesText(summary.todayMinutes), "today"),
    tile(minutesText(summary.last7DaysMinutes), "this week"),
    tile(`${summary.streakDays} ${summary.streakDays === 1 ? "day" : "days"}`, "streak"),
    tile(`${summary.bestStreakDays} ${summary.bestStreakDays === 1 ? "day" : "days"}`, "best streak")
  );
}

function renderWhere() {
  const rows = minutesByLabel(sessions, new Date());
  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Finish a focus block and it shows up here, sorted by what you named it.";
    whereEl.replaceChildren(li);
    return;
  }
  whereEl.replaceChildren(...rows.map((row) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "where-name";
    name.textContent = row.label;
    const mins = document.createElement("span");
    mins.className = "where-mins";
    mins.textContent = `${minutesText(row.minutes)} · ${Math.round(row.share * 100)}%`;
    const bar = document.createElement("span");
    bar.className = "where-bar";
    bar.style.setProperty("--share", row.share.toFixed(3));
    li.append(name, mins, bar);
    return li;
  }));
}

function renderHistory() {
  const recent = sessions.slice(-8).reverse();
  if (recent.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing yet. Press Start and your first one lands here.";
    historyEl.replaceChildren(li);
    return;
  }
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  historyEl.replaceChildren(...recent.map((session) => {
    const li = document.createElement("li");
    const what = document.createElement("span");
    what.textContent = session.label || "Focus";
    const when = document.createElement("span");
    when.className = "muted";
    when.textContent = `${session.minutes} min · ${fmt.format(new Date(session.completedAt))}`;
    li.append(what, when);
    return li;
  }));
}

function renderLabelChoices() {
  labelList.replaceChildren(...recentLabels(sessions).map((label) => {
    const option = document.createElement("option");
    option.value = label;
    return option;
  }));
}

function renderLogs() {
  renderStats();
  renderWhere();
  renderHistory();
  renderLabelChoices();
}

function stopTickLoop() {
  if (!intervalId) return;
  window.clearInterval(intervalId);
  intervalId = 0;
}

function ensureTickLoop() {
  if (intervalId) return;
  intervalId = window.setInterval(tick, 250);
}

function tick() {
  const outcome = syncToClock(timer, Date.now());
  if (outcome === "noop") return;
  if (outcome === "finished") {
    stopTickLoop();
    finishInterval();
    return;
  }
  renderTimer();
}

function logFocus(minutes, at) {
  if (minutes < 1) return false;
  recordSession(sessions, { minutes, label: preferences.label, completedAt: new Date(at).toISOString() });
  saveSessions(sessions);
  renderLogs();
  return true;
}

// When time runs out the focus block is logged on the spot and the break is
// lined up, so a session is never lost to a forgotten button press.
function finishInterval({ quiet = false } = {}) {
  const wasFocus = timer.mode === "focus";
  const minutes = timer.minutes;
  if (wasFocus) logFocus(minutes, timer.finishedAt || Date.now());
  const transition = completeInterval(timer, cycleConfig);
  renderTimer();
  const long = transition.nextMode === "long-break";
  const message = wasFocus
    ? `Nice, ${minutes} minutes done. Take a ${long ? "long" : "short"} break, then press Start.`
    : "Break's over. Press Start when you're ready.";
  say(message);
  if (quiet) return;
  chime();
  if (wasFocus) ember.cheer(long ? "Four in a row! Go stretch, get water, look out a window." : "Done! Stand up for a minute. Your eyes will thank you.");
  else ember.say("Welcome back. Same thing, or something new?");
  if (preferences.notes) showNote(wasFocus ? "Focus done" : "Break's over", message);
}

function handleStartPause() {
  if (timer.phase === "running") {
    pauseTimer(timer, Date.now());
    stopTickLoop();
    renderTimer();
    say("Paused. Press Keep going when you're back.");
    return;
  }
  unlockSound();
  const wasPaused = timer.phase === "paused";
  if (!startTimer(timer, Date.now())) return;
  ensureTickLoop();
  renderTimer();
  if (timer.mode === "focus") {
    say(wasPaused ? "Back at it." : `Go! ${timer.minutes} minutes${preferences.label ? ` on ${preferences.label}` : ""}.`);
    if (!wasPaused) ember.say("I'll keep quiet till the time's up. You've got this.");
  } else {
    say("Break started. Step away from the screen if you can.");
  }
}

function handleFinishNow() {
  if (timer.mode !== "focus" || timer.phase === "idle") return;
  syncToClock(timer, Date.now());
  const minutes = elapsedMinutes(timer);
  stopTickLoop();
  const logged = logFocus(minutes, Date.now());
  resetTimer(timer);
  renderTimer();
  if (logged) {
    say(`Logged ${minutes} ${minutes === 1 ? "minute" : "minutes"}. The clock is ready for the next one.`);
    ember.cheer("Every minute counts. Nice work.");
  } else {
    say("Less than a minute, so nothing was logged.");
  }
}

function handleSkip() {
  stopTickLoop();
  const wasFocus = timer.mode === "focus";
  timer.phase = "finished";
  timer.secondsLeft = 0;
  timer.endsAt = 0;
  const transition = completeInterval(timer, cycleConfig);
  // Skipping is not finishing, so it does not move the round counter on.
  if (wasFocus) timer.completedFocusIntervals -= 1;
  renderTimer();
  say(transition.nextMode === "focus" ? "Break skipped. Ready to focus." : "Skipped to your break. Nothing was logged.");
}

function handleReset() {
  stopTickLoop();
  resetTimer(timer);
  renderTimer();
  say("Clock reset.");
}

function applyMinutes(value) {
  const next = normalizeMinutes(value);
  preferences.minutes = next;
  cycleConfig.focusMinutes = next;
  savePreferences(preferences);
  minutesInput.value = String(next);
  if (timer.mode === "focus" && timer.phase !== "running") {
    stopTickLoop();
    const done = timer.completedFocusIntervals;
    setMinutes(timer, next);
    timer.completedFocusIntervals = done;
  }
  renderTimer();
  say(`Focus blocks are now ${next} minutes.`);
}

function handleLabelChange() {
  preferences.label = cleanLabel(labelInput.value);
  labelInput.value = preferences.label;
  savePreferences(preferences);
}

async function handleNotesToggle() {
  if (!notesBox.checked) {
    preferences.notes = false;
    savePreferences(preferences);
    return;
  }
  const answer = await askForNotes();
  preferences.notes = answer === "granted";
  notesBox.checked = preferences.notes;
  savePreferences(preferences);
  if (answer === "denied") say("Notes are blocked for this site. You can allow them from the icon next to the web address.");
}

function syncNotesBox() {
  if (!notesSupported()) {
    notesBox.closest("label").hidden = true;
    return;
  }
  notesBox.checked = Boolean(preferences.notes) && notesAllowed();
}

function handleKeys(event) {
  if (event.target.closest("input, textarea, select, summary") || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.code === "Space" && !event.target.closest("button")) {
    event.preventDefault();
    handleStartPause();
  } else if (key === "f") handleFinishNow();
  else if (key === "n") handleSkip();
  else if (key === "r") handleReset();
}

minutesInput.addEventListener("change", () => applyMinutes(minutesInput.value));
for (const chip of presetChips) chip.addEventListener("click", () => applyMinutes(chip.dataset.minutes));
notesBox.addEventListener("change", handleNotesToggle);
labelInput.addEventListener("change", handleLabelChange);
labelInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLabelChange();
    labelInput.blur();
  }
});
startBtn.addEventListener("click", handleStartPause);
finishBtn.addEventListener("click", handleFinishNow);
nextBtn.addEventListener("click", handleSkip);
resetBtn.addEventListener("click", handleReset);
document.addEventListener("keydown", handleKeys);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tick();
  else persistTimer();
});

minutesInput.value = String(preferences.minutes);
labelInput.value = preferences.label;
syncNotesBox();
renderLogs();
if (timer.phase === "finished") {
  finishInterval({ quiet: true });
} else {
  renderTimer();
  if (timer.phase === "running") {
    ensureTickLoop();
    say("Still going. Your clock kept time while the page was closed.");
  }
}
