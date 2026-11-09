import { describe, expect, it } from 'vitest';
import {
  isInFastWindow,
  lastReadTime,
  storeItemsMaxAgeMs,
  upgradeToolMaxAgeMs,
} from './refresh-schedule';

/** A local time on November 9, 2026. */
const at = (hours: number, minutes: number, seconds = 0) =>
  new Date(2026, 10, 9, hours, minutes, seconds).getTime();

describe('isInFastWindow', () => {
  it('spans the full hour from xx:59 to xx:10', () => {
    expect(isInFastWindow(at(11, 58, 59))).toBe(false);
    expect(isInFastWindow(at(11, 59))).toBe(true);
    expect(isInFastWindow(at(12, 0))).toBe(true);
    expect(isInFastWindow(at(12, 10, 59))).toBe(true);
    expect(isInFastWindow(at(12, 11))).toBe(false);
    expect(isInFastWindow(at(12, 30))).toBe(false);
  });

  it('also takes a window within the hour', () => {
    expect(isInFastWindow(at(12, 20), { from: 15, to: 25 })).toBe(true);
    expect(isInFastWindow(at(12, 30), { from: 15, to: 25 })).toBe(false);
  });
});

describe('upgradeToolMaxAgeMs', () => {
  it('is 30 seconds around the full hour and the interval otherwise', () => {
    expect(upgradeToolMaxAgeMs(at(12, 2), 5)).toBe(30_000);
    expect(upgradeToolMaxAgeMs(at(12, 20), 5)).toBe(5 * 60_000);
  });
});

describe('lastReadTime', () => {
  it('is the latest of the fixed minutes', () => {
    expect(lastReadTime(at(12, 0))).toBe(at(12, 0));
    expect(lastReadTime(at(12, 4, 59))).toBe(at(12, 0));
    expect(lastReadTime(at(12, 7))).toBe(at(12, 5));
    expect(lastReadTime(at(12, 29))).toBe(at(12, 10));
    expect(lastReadTime(at(12, 59))).toBe(at(12, 35));
  });

  it('goes back to the hour before, also over midnight', () => {
    expect(lastReadTime(at(0, 0), [30])).toBe(new Date(2026, 10, 8, 23, 30).getTime());
  });
});

describe('storeItemsMaxAgeMs', () => {
  it('lets the items read since the last fixed minute count as current', () => {
    const now = at(12, 7);
    const maxAge = storeItemsMaxAgeMs(now);
    // Read at 12:05:30: current. Read at 12:04: due (12:05 was missed), but only once.
    expect(now - at(12, 5, 30) < maxAge).toBe(true);
    expect(now - at(12, 4) < maxAge).toBe(false);
  });
});
