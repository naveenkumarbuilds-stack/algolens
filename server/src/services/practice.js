export function localDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function offsetDay(day, amount) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function summarizePractice(logs, today) {
  const counts = new Map();
  for (const log of logs) counts.set(log.practiceDate, (counts.get(log.practiceDate) || 0) + 1);
  const days = [...counts.keys()].sort();
  let longestStreak = 0,
    run = 0,
    previous;
  for (const day of days) {
    run = previous && offsetDay(previous, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }
  let currentStreak = 0,
    day = counts.has(today) ? today : offsetDay(today, -1);
  while (counts.has(day)) {
    currentStreak++;
    day = offsetDay(day, -1);
  }
  return {
    currentStreak,
    longestStreak,
    totalPractices: logs.length,
    weeklyActivity: Array.from({ length: 7 }, (_, i) => {
      const date = offsetDay(today, i - 6);
      return { date, count: counts.get(date) || 0 };
    }),
  };
}
export function logData(user, data, now = new Date()) {
  return {
    ...data,
    userId: user.id,
    timeZone: user.timeZone,
    practiceDate: localDate(now, user.timeZone),
  };
}
