import { translate, type Locale } from '@/i18n';

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

/**
 * The time left as a countdown, e.g. "2 d 03:12:45" (the days in the language) or "03:12:45";
 * never below zero.
 */
export function formatCountdown(left: number, locale: Locale): string {
  const total = Math.max(0, Math.floor(left / SECOND));
  const days = Math.floor((total * SECOND) / DAY);
  const rest = total - (days * DAY) / SECOND;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(Math.floor(rest / 3600))}:${pad(Math.floor((rest % 3600) / 60))}:${pad(rest % 60)}`;
  return days ? `${translate(locale, 'events.days', [days])} ${clock}` : clock;
}
