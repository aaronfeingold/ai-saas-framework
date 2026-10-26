// Spend caps are defined on UTC periods: calendar day, Monday-start week, calendar month.

const DAY_MS = 86_400_000;

export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function nextUtcDayStart(d: Date): Date {
  return new Date(utcDayStart(d).getTime() + DAY_MS);
}

export function utcWeekStart(d: Date): Date {
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(utcDayStart(d).getTime() - daysSinceMonday * DAY_MS);
}

export function nextUtcWeekStart(d: Date): Date {
  return new Date(utcWeekStart(d).getTime() + 7 * DAY_MS);
}

export function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function nextUtcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
