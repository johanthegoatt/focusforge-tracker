// Days are counted on your own clock. `offset` is minutes behind UTC, the same
// number Date#getTimezoneOffset gives (-480 in Manila), so a session at 7am
// Manila time lands on that day and not on the day before in UTC.
function dayKey(value, offset) {
  return new Date(new Date(value).getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shiftDay(key, days) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function cleanLabel(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function normalizeEntry(item) {
  const entry = {
    minutes: Number(item.minutes) || 0,
    completedAt: new Date(item.completedAt || Date.now()).toISOString()
  };
  const label = cleanLabel(item.label);
  if (label) entry.label = label;
  return entry;
}

export function createSessionLog(seed = []) {
  return seed.map(normalizeEntry);
}

export function recordSession(log, session) {
  const entry = normalizeEntry(session);
  log.push(entry);
  return entry;
}

function buildDaySet(log, offset) {
  return new Set(log.map((item) => dayKey(item.completedAt, offset)));
}

function runBack(daySet, key) {
  let streak = 0;
  while (daySet.has(key)) {
    streak += 1;
    key = shiftDay(key, -1);
  }
  return streak;
}

// A streak still counts today before today's first session, so it does not
// read 0 every morning.
function streakCount(daySet, todayKey) {
  if (daySet.has(todayKey)) return runBack(daySet, todayKey);
  return runBack(daySet, shiftDay(todayKey, -1));
}

function bestStreak(daySet) {
  let best = 0;
  for (const key of daySet) {
    if (daySet.has(shiftDay(key, 1))) continue;
    best = Math.max(best, runBack(daySet, key));
  }
  return best;
}

function inLastDays(item, todayKey, days, offset) {
  const key = dayKey(item.completedAt, offset);
  return key <= todayKey && key >= shiftDay(todayKey, -(days - 1));
}

function averageSessionMinutes(log) {
  if (log.length === 0) return 0;
  return Number((log.reduce((sum, item) => sum + item.minutes, 0) / log.length).toFixed(2));
}

export function summarizeSessions(log, now = new Date(), offset = new Date(now).getTimezoneOffset()) {
  const totalMinutes = log.reduce((sum, item) => sum + item.minutes, 0);
  const daySet = buildDaySet(log, offset);
  const todayKey = dayKey(now, offset);

  return {
    totalSessions: log.length,
    totalMinutes,
    averageSessionMinutes: averageSessionMinutes(log),
    streakDays: streakCount(daySet, todayKey),
    bestStreakDays: bestStreak(daySet),
    todayMinutes: log.filter((item) => inLastDays(item, todayKey, 1, offset)).reduce((sum, item) => sum + item.minutes, 0),
    last7DaysMinutes: log.filter((item) => inLastDays(item, todayKey, 7, offset)).reduce((sum, item) => sum + item.minutes, 0)
  };
}

// Where the time went: minutes per label over the last `days` days, biggest
// first. Sessions with no label are grouped as "Other".
export function minutesByLabel(log, now = new Date(), days = 7, offset = new Date(now).getTimezoneOffset()) {
  const todayKey = dayKey(now, offset);
  const totals = new Map();
  for (const item of log) {
    if (!inLastDays(item, todayKey, days, offset)) continue;
    const label = item.label || "Other";
    const key = label.toLowerCase();
    const row = totals.get(key) || { label, minutes: 0, sessions: 0 };
    row.minutes += item.minutes;
    row.sessions += 1;
    totals.set(key, row);
  }
  const rows = [...totals.values()].sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
  const all = rows.reduce((sum, row) => sum + row.minutes, 0);
  return rows.map((row) => ({ ...row, share: all ? row.minutes / all : 0 }));
}

// Labels you used most recently, for the suggestions under the label box.
export function recentLabels(log, limit = 6) {
  const seen = new Map();
  for (let i = log.length - 1; i >= 0 && seen.size < limit; i -= 1) {
    const label = log[i].label;
    if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
  }
  return [...seen.values()];
}
