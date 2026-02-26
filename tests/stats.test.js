import test from "node:test";
import assert from "node:assert/strict";

import { createSessionLog, recordSession, summarizeSessions } from "../src/stats.js";

test("recordSession appends normalized entry", () => {
  const log = createSessionLog();
  const entry = recordSession(log, { minutes: 25, completedAt: "2026-02-20T00:00:00.000Z" });

  assert.equal(log.length, 1);
  assert.equal(entry.minutes, 25);
  assert.equal(entry.completedAt, "2026-02-20T00:00:00.000Z");
});

test("summarizeSessions computes totals", () => {
  const log = createSessionLog([
    { minutes: 25, completedAt: "2026-02-20T08:00:00.000Z" },
    { minutes: 30, completedAt: "2026-02-21T08:00:00.000Z" }
  ]);

  const summary = summarizeSessions(log, new Date("2026-02-21T09:00:00.000Z"));
  assert.equal(summary.totalSessions, 2);
  assert.equal(summary.totalMinutes, 55);
});

test("summarizeSessions calculates streak days", () => {
  const log = createSessionLog([
    { minutes: 20, completedAt: "2026-02-19T08:00:00.000Z" },
    { minutes: 20, completedAt: "2026-02-20T08:00:00.000Z" },
    { minutes: 20, completedAt: "2026-02-21T08:00:00.000Z" }
  ]);

  const summary = summarizeSessions(log, new Date("2026-02-21T09:00:00.000Z"));
  assert.equal(summary.streakDays, 3);
  assert.equal(summary.bestStreakDays >= summary.streakDays, true);
});

test("summarizeSessions computes average session minutes", () => {
  const log = createSessionLog([
    { minutes: 10, completedAt: "2026-02-18T08:00:00.000Z" },
    { minutes: 20, completedAt: "2026-02-19T08:00:00.000Z" },
    { minutes: 30, completedAt: "2026-02-20T08:00:00.000Z" }
  ]);

  const summary = summarizeSessions(log, new Date("2026-02-21T09:00:00.000Z"));
  assert.equal(summary.averageSessionMinutes, 20);
});
