import test from "node:test";
import assert from "node:assert/strict";

import { createSessionLog, minutesByLabel, recentLabels, recordSession, summarizeSessions } from "../src/stats.js";

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

  const summary = summarizeSessions(log, new Date("2026-02-21T09:00:00.000Z"), 0);
  assert.equal(summary.totalSessions, 2);
  assert.equal(summary.totalMinutes, 55);
});

test("summarizeSessions calculates streak days", () => {
  const log = createSessionLog([
    { minutes: 20, completedAt: "2026-02-19T08:00:00.000Z" },
    { minutes: 20, completedAt: "2026-02-20T08:00:00.000Z" },
    { minutes: 20, completedAt: "2026-02-21T08:00:00.000Z" }
  ]);

  const summary = summarizeSessions(log, new Date("2026-02-21T09:00:00.000Z"), 0);
  assert.equal(summary.streakDays, 3);
  assert.equal(summary.bestStreakDays >= summary.streakDays, true);
});

test("summarizeSessions computes average session minutes", () => {
  const log = createSessionLog([
    { minutes: 10, completedAt: "2026-02-18T08:00:00.000Z" },
    { minutes: 20, completedAt: "2026-02-19T08:00:00.000Z" },
    { minutes: 30, completedAt: "2026-02-20T08:00:00.000Z" }
  ]);

  const summary = summarizeSessions(log, new Date("2026-02-21T09:00:00.000Z"), 0);
  assert.equal(summary.averageSessionMinutes, 20);
});

test("days are counted on the local clock, not UTC", () => {
  // 07:00 in Manila on the 21st is 23:00 UTC on the 20th.
  const log = createSessionLog([
    { minutes: 25, completedAt: "2026-02-19T23:00:00.000Z" },
    { minutes: 25, completedAt: "2026-02-20T23:00:00.000Z" }
  ]);
  const now = new Date("2026-02-21T02:00:00.000Z");
  const manila = summarizeSessions(log, now, -480);
  assert.equal(manila.streakDays, 2);
  assert.equal(manila.todayMinutes, 25);
  const utc = summarizeSessions(log, now, 0);
  assert.equal(utc.todayMinutes, 0);
});

test("a streak is not broken before the first session of the day", () => {
  const log = createSessionLog([
    { minutes: 25, completedAt: "2026-02-19T10:00:00.000Z" },
    { minutes: 25, completedAt: "2026-02-20T10:00:00.000Z" }
  ]);
  const summary = summarizeSessions(log, new Date("2026-02-21T06:00:00.000Z"), 0);
  assert.equal(summary.streakDays, 2);
  assert.equal(summary.bestStreakDays, 2);
});

test("the last 7 days include all of the 7th day back", () => {
  const log = createSessionLog([
    { minutes: 25, completedAt: "2026-02-15T01:00:00.000Z" },
    { minutes: 25, completedAt: "2026-02-14T23:00:00.000Z" }
  ]);
  const summary = summarizeSessions(log, new Date("2026-02-21T20:00:00.000Z"), 0);
  assert.equal(summary.last7DaysMinutes, 25);
});

test("labels are kept, trimmed and totalled for the week", () => {
  const log = createSessionLog();
  recordSession(log, { minutes: 25, completedAt: "2026-02-20T08:00:00.000Z", label: "  Thesis  " });
  recordSession(log, { minutes: 50, completedAt: "2026-02-21T08:00:00.000Z", label: "thesis" });
  recordSession(log, { minutes: 25, completedAt: "2026-02-21T09:00:00.000Z", label: "Email" });
  recordSession(log, { minutes: 25, completedAt: "2026-02-21T10:00:00.000Z" });
  recordSession(log, { minutes: 99, completedAt: "2026-01-01T10:00:00.000Z", label: "Old" });
  assert.equal(log[0].label, "Thesis");
  assert.equal("label" in log[3], false);

  const rows = minutesByLabel(log, new Date("2026-02-21T12:00:00.000Z"), 7, 0);
  assert.deepEqual(rows.map((r) => [r.label, r.minutes, r.sessions]), [
    ["Thesis", 75, 2],
    ["Email", 25, 1],
    ["Other", 25, 1]
  ]);
  assert.equal(rows[0].share, 0.6);
  assert.deepEqual(recentLabels(log), ["Old", "Email", "thesis"]);
});
