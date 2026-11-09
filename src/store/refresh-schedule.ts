import { PLEDGE_STORE, STORE_ITEMS } from '@/config';

/*
 * When the Pledge Store is read again (#162): CIG changes it mostly at the full hour, sometimes a
 * few minutes late. So the warbond CCUs are read every 30 seconds around the full hour and at the
 * interval of the settings otherwise, and the Pledge Store items only at a few fixed minutes. All
 * times are on the local clock. A run that was missed (browser closed, computer asleep) runs once
 * at the next chance: only the latest due time counts, not every missed one.
 */

type Window = { readonly from: number; readonly to: number };

/** Whether `now` is in the fast window around the full hour (both minutes included). */
export function isInFastWindow(now: number, window: Window = PLEDGE_STORE.fastWindow): boolean {
  const minute = new Date(now).getMinutes();
  return window.from <= window.to
    ? minute >= window.from && minute <= window.to
    : minute >= window.from || minute <= window.to;
}

/**
 * How old the warbond CCUs may be at `now` before they are read again: `fastWindow.everyMs` in
 * the window around the full hour, otherwise the interval of the settings.
 */
export function upgradeToolMaxAgeMs(now: number, intervalMinutes: number): number {
  const interval = intervalMinutes * 60_000;
  return isInFastWindow(now) ? Math.min(PLEDGE_STORE.fastWindow.everyMs, interval) : interval;
}

/** The latest time at or before `now` whose minute is one of `minutes` (at 0 seconds). */
export function lastReadTime(
  now: number,
  minutes: readonly number[] = STORE_ITEMS.readAtMinutes,
): number {
  const sorted = [...minutes].sort((a, b) => b - a);
  const hour = new Date(now);
  hour.setMinutes(0, 0, 0);
  // This hour's latest minute that has passed, else the last one of the hour before.
  for (const offset of [0, -1]) {
    for (const minute of sorted) {
      const time = new Date(hour);
      time.setHours(hour.getHours() + offset, minute);
      if (time.getTime() <= now) return time.getTime();
    }
  }
  return now;
}

/**
 * How old the Pledge Store items may be at `now` before they are read again: read since the
 * latest of the fixed minutes, they are current.
 */
export const storeItemsMaxAgeMs = (now: number) => now - lastReadTime(now);
