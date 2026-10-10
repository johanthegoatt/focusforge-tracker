import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceSecond,
  completeInterval,
  createTimerState,
  normalizeCycleConfig,
  normalizeMinutes,
  progressRatio,
  resetTimer,
  setMinutes,
  pauseTimer,
  startTimer,
  restoreTimer,
  snapshotTimer,
  syncToClock,
  tabTitle
} from "../src/timerMachine.js";

test("normalizeMinutes clamps invalid values", () => {
  assert.equal(normalizeMinutes("abc"), 25);
  assert.equal(normalizeMinutes(-4), 1);
  assert.equal(normalizeMinutes(999), 90);
});

test("timer advances to finished state", () => {
  const timer = createTimerState(1);
  startTimer(timer);
  timer.secondsLeft = 1;
  const result = advanceSecond(timer);
  assert.equal(result, "finished");
  assert.equal(timer.phase, "finished");
  assert.equal(timer.secondsLeft, 0);
});

test("setMinutes and resetTimer restore idle session", () => {
  const timer = createTimerState(25);
  setMinutes(timer, 15);
  assert.equal(timer.durationSeconds, 900);
  timer.phase = "running";
  timer.secondsLeft = 300;
  resetTimer(timer);
  assert.equal(timer.phase, "idle");
  assert.equal(timer.secondsLeft, 900);
  assert.equal(progressRatio(timer), 0);
});

test("completeInterval transitions focus to short break and then back", () => {
  const timer = createTimerState(25);
  const cycle = normalizeCycleConfig({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4
  });

  timer.phase = "finished";
  timer.mode = "focus";
  let transition = completeInterval(timer, cycle);
  assert.equal(transition.transitioned, true);
  assert.equal(transition.nextMode, "short-break");
  assert.equal(timer.minutes, 5);

  timer.phase = "finished";
  timer.mode = "short-break";
  transition = completeInterval(timer, cycle);
  assert.equal(transition.nextMode, "focus");
  assert.equal(timer.minutes, 25);
});

test("completeInterval switches to long break every configured focus intervals", () => {
  const timer = createTimerState(30);
  const cycle = normalizeCycleConfig({
    focusMinutes: 30,
    shortBreakMinutes: 5,
    longBreakMinutes: 20,
    longBreakEvery: 2
  });

  timer.completedFocusIntervals = 1;
  timer.phase = "finished";
  timer.mode = "focus";
  const transition = completeInterval(timer, cycle);
  assert.equal(transition.nextMode, "long-break");
  assert.equal(timer.minutes, 20);
});

test("syncToClock follows the wall clock, not the number of ticks", () => {
  const timer = createTimerState(25);
  const t0 = 1_000_000;
  startTimer(timer, t0);
  assert.equal(syncToClock(timer, t0 + 400), "noop");
  assert.equal(timer.secondsLeft, 1500);
  assert.equal(syncToClock(timer, t0 + 1000), "tick");
  assert.equal(timer.secondsLeft, 1499);
  assert.equal(syncToClock(timer, t0 + 10 * 60 * 1000 + 300), "tick");
  assert.equal(timer.secondsLeft, 900);
});

test("a tab that sleeps past the end finishes at zero on wake", () => {
  const timer = createTimerState(5);
  startTimer(timer, 0);
  assert.equal(syncToClock(timer, 60 * 60 * 1000), "finished");
  assert.equal(timer.phase, "finished");
  assert.equal(timer.secondsLeft, 0);
  assert.equal(syncToClock(timer, 60 * 60 * 1000 + 1000), "noop");
});

test("pause keeps the time left and resume sets a new end time", () => {
  const timer = createTimerState(10);
  startTimer(timer, 0);
  assert.equal(pauseTimer(timer, 125_500), true);
  assert.equal(timer.phase, "paused");
  assert.equal(timer.secondsLeft, 475);
  assert.equal(syncToClock(timer, 9_999_999), "noop");
  assert.equal(timer.secondsLeft, 475);
  startTimer(timer, 200_000);
  syncToClock(timer, 200_000 + 475_000);
  assert.equal(timer.phase, "finished");
});

test("pause after the end time counts as finished, not paused", () => {
  const timer = createTimerState(1);
  startTimer(timer, 0);
  assert.equal(pauseTimer(timer, 61_000), false);
  assert.equal(timer.phase, "finished");
});

test("a running timer comes back after a reload and keeps counting", () => {
  const timer = createTimerState(25);
  startTimer(timer, 1_000_000);
  const saved = JSON.parse(JSON.stringify(snapshotTimer(timer)));
  const back = restoreTimer(saved, 25, 1_000_000 + 60_000);
  assert.equal(back.phase, "running");
  assert.equal(back.secondsLeft, 24 * 60);
  assert.equal(back.endsAt, timer.endsAt);
});

test("a timer that ran out while the tab was closed comes back finished", () => {
  const timer = createTimerState(25);
  startTimer(timer, 0);
  const back = restoreTimer(snapshotTimer(timer), 25, 26 * 60 * 1000);
  assert.equal(back.phase, "finished");
  assert.equal(back.secondsLeft, 0);
  assert.equal(back.mode, "focus");
  // Logged at the real end time, not when the tab was reopened.
  assert.equal(back.finishedAt, 25 * 60 * 1000);
});

test("a paused break keeps its mode, time left and count", () => {
  const back = restoreTimer(
    { mode: "short-break", phase: "paused", minutes: 5, secondsLeft: 90, endsAt: 0, completedFocusIntervals: 3 },
    25
  );
  assert.equal(back.mode, "short-break");
  assert.equal(back.durationSeconds, 300);
  assert.equal(back.secondsLeft, 90);
  assert.equal(back.completedFocusIntervals, 3);
});

test("junk in storage gives a fresh timer", () => {
  for (const junk of [null, "x", { mode: "nap", phase: "idle" }, { mode: "focus", phase: "melting" }]) {
    const back = restoreTimer(junk, 30);
    assert.equal(back.phase, "idle");
    assert.equal(back.secondsLeft, 30 * 60);
  }
  const noEnd = restoreTimer({ mode: "focus", phase: "running", minutes: 25, secondsLeft: 100 }, 25);
  assert.equal(noEnd.phase, "paused");
  assert.equal(noEnd.secondsLeft, 100);
});

test("the tab title shows the time left while the clock runs", () => {
  const timer = createTimerState(25);
  assert.equal(tabTitle(timer), "FocusForge");
  startTimer(timer, 0);
  syncToClock(timer, 61_000);
  assert.equal(tabTitle(timer), "23:59 Focus | FocusForge");
  pauseTimer(timer, 61_000);
  assert.equal(tabTitle(timer), "Paused 23:59 | FocusForge");
  startTimer(timer, 0);
  syncToClock(timer, 25 * 60_000);
  assert.equal(tabTitle(timer), "Time's up! | FocusForge");
  completeInterval(timer);
  startTimer(timer, 0);
  assert.equal(tabTitle(timer), "05:00 Break | FocusForge");
});
