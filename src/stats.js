function dayKey(value) {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
}

export function createSessionLog(seed = []) {
  return seed.map((item) => ({
    minutes: Number(item.minutes) || 0,
    completedAt: new Date(item.completedAt).toISOString()
  }));
}

export function recordSession(log, session) {
  const entry = {
    minutes: Number(session.minutes) || 0,
    completedAt: new Date(session.completedAt || Date.now()).toISOString()
  };
  log.push(entry);
  return entry;
}

function buildDaySet(log) {
  return new Set(log.map((item) => dayKey(item.completedAt)));
}

function streakCount(daySet, now) {
  let streak = 0;
  const cursor = new Date(now);

  while (true) {
    const key = dayKey(cursor);
    if (!daySet.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function last7DayMinutes(log, now) {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 6);

  return log
    .filter((item) => {
      const completed = new Date(item.completedAt);
      return completed >= start && completed <= end;
    })
    .reduce((sum, item) => sum + item.minutes, 0);
}

function bestStreak(daySet) {
  if (daySet.size === 0) return 0;
  let best = 0;
  for (const key of daySet.values()) {
    const cursor = new Date(`${key}T00:00:00.000Z`);
    let streak = 0;
    while (true) {
      const day = cursor.toISOString().slice(0, 10);
      if (!daySet.has(day)) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    best = Math.max(best, streak);
  }
  return best;
}

function averageSessionMinutes(log) {
  if (log.length === 0) return 0;
  return Number((log.reduce((sum, item) => sum + item.minutes, 0) / log.length).toFixed(2));
}

export function summarizeSessions(log, now = new Date()) {
  const totalMinutes = log.reduce((sum, item) => sum + item.minutes, 0);
  const daySet = buildDaySet(log);

  return {
    totalSessions: log.length,
    totalMinutes,
    averageSessionMinutes: averageSessionMinutes(log),
    streakDays: streakCount(daySet, now),
    bestStreakDays: bestStreak(daySet),
    last7DaysMinutes: last7DayMinutes(log, now)
  };
}
