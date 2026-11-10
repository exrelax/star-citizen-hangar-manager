import { describe, expect, it } from 'vitest';
import { SITE_DATA } from '@/config';
import { lastSiteDataReadTime, readMinutes } from './site-data-schedule';

/** A time (UTC) on November 10, 2026 (`day` for another day of the month). */
const at = (hours: number, minutes: number, day = 10) => Date.UTC(2026, 10, day, hours, minutes);
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

describe('readMinutes', () => {
  it('reads every two hours, hourly from 14:00 to 22:00, every 15 minutes from 15:00 to 18:30', () => {
    expect(readMinutes(SITE_DATA.schedule).map(time)).toEqual([
      '01:00',
      '03:00',
      '05:00',
      '07:00',
      '09:00',
      '11:00',
      '13:00',
      '14:00',
      '15:00',
      '15:15',
      '15:30',
      '15:45',
      '16:00',
      '16:15',
      '16:30',
      '16:45',
      '17:00',
      '17:15',
      '17:30',
      '17:45',
      '18:00',
      '18:15',
      '18:30',
      '19:00',
      '20:00',
      '21:00',
      '22:00',
      '23:00',
    ]);
  });
});

describe('lastSiteDataReadTime', () => {
  it('is the latest time of the schedule, the same in every time zone', () => {
    expect(lastSiteDataReadTime(at(13, 0))).toBe(at(13, 0));
    expect(lastSiteDataReadTime(at(13, 59))).toBe(at(13, 0));
    expect(lastSiteDataReadTime(at(14, 30))).toBe(at(14, 0));
    expect(lastSiteDataReadTime(at(16, 44))).toBe(at(16, 30));
    expect(lastSiteDataReadTime(at(18, 59))).toBe(at(18, 30));
    expect(lastSiteDataReadTime(at(23, 30))).toBe(at(23, 0));
  });

  it('is yesterday’s last time before the first one of the day', () => {
    const schedule = [{ from: '08:00', to: '20:00', everyMinutes: 360 }];
    expect(lastSiteDataReadTime(at(7, 0), schedule)).toBe(at(20, 0, 9));
    expect(lastSiteDataReadTime(at(0, 30))).toBe(at(23, 0, 9));
  });
});
