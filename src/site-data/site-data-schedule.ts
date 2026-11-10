import { SITE_DATA } from '@/config';

/*
 * When the data files of the project website are read again: at the times of
 * `SITE_DATA.schedule`, more often in the afternoon and evening, when CIG changes the Pledge Store
 * and the files are updated for it (e.g. during the IAE). Each window gives times from its start
 * to its end (both included) every `everyMinutes`; the times of all windows count. All times are
 * on the local clock, like the Pledge Store's (#162). A time that was missed (no RSI page open,
 * computer asleep) is caught up once at the next chance: only the latest time counts, not every
 * missed one.
 */

/** A window of the day, `"HH:MM"` on the local clock, with its interval. */
export interface ReadWindow {
  readonly from: string;
  readonly to: string;
  readonly everyMinutes: number;
}

const minutesOf = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** The minutes of the day to read at, earliest first. */
export function readMinutes(schedule: readonly ReadWindow[]): number[] {
  const minutes = new Set<number>();
  for (const { from, to, everyMinutes } of schedule) {
    const end = Math.min(minutesOf(to), 24 * 60 - 1);
    for (let minute = minutesOf(from); minute <= end; minute += everyMinutes) minutes.add(minute);
  }
  return [...minutes].sort((a, b) => a - b);
}

/** The latest time to read at, at or before `now` (today's, else yesterday's last). */
export function lastSiteDataReadTime(
  now: number,
  schedule: readonly ReadWindow[] = SITE_DATA.schedule,
): number {
  const minutes = readMinutes(schedule).reverse();
  for (const dayOffset of [0, -1]) {
    for (const minute of minutes) {
      const time = new Date(now);
      // Hours and minutes of the local clock, also across a change to or from summer time.
      time.setDate(time.getDate() + dayOffset);
      time.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (time.getTime() <= now) return time.getTime();
    }
  }
  return now;
}
