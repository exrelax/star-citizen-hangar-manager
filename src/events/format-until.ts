const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The time until `at` in words, e.g. "in 3 days", "in 5 hours", "tomorrow": in days from one day
 * on, else in hours, else in minutes.
 */
export function formatUntil(at: number, now: number, locale: string): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const left = Math.max(0, at - now);
  if (left >= DAY) return format.format(Math.floor(left / DAY), 'day');
  if (left >= HOUR) return format.format(Math.floor(left / HOUR), 'hour');
  return format.format(Math.max(1, Math.ceil(left / MINUTE)), 'minute');
}
