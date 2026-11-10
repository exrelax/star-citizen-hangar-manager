import { describe, expect, it } from 'vitest';
import { SITE_DATA } from '@/config';
import { lastSiteDataReadTime, readMinutes } from './site-data-schedule';

/** A local time on November 10, 2026 (`day` for another day of the month). */
const at = (hours: number, minutes: number, day = 10) =>
  new Date(2026, 10, day, hours, minutes).getTime();
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

describe('readMinutes', () => {
  it('reads every two hours, hourly from 15:00 to 23:00, every 15 minutes from 16:00 to 19:30', () => {
    expect(readMinutes(SITE_DATA.schedule).map(time)).toEqual([
      '00:00',
      '02:00',
      '04:00',
      '06:00',
      '08:00',
      '10:00',
      '12:00',
      '14:00',
      '15:00',
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
      '18:45',
      '19:00',
      '19:15',
      '19:30',
      '20:00',
      '21:00',
      '22:00',
      '23:00',
    ]);
  });
});

describe('lastSiteDataReadTime', () => {
  it('is the latest time of the schedule', () => {
    expect(lastSiteDataReadTime(at(12, 0))).toBe(at(12, 0));
    expect(lastSiteDataReadTime(at(13, 59))).toBe(at(12, 0));
    expect(lastSiteDataReadTime(at(15, 30))).toBe(at(15, 0));
    expect(lastSiteDataReadTime(at(17, 44))).toBe(at(17, 30));
    expect(lastSiteDataReadTime(at(19, 59))).toBe(at(19, 30));
    expect(lastSiteDataReadTime(at(23, 30))).toBe(at(23, 0));
  });

  it('is yesterday’s last time before the first one of the day', () => {
    const schedule = [{ from: '08:00', to: '20:00', everyMinutes: 360 }];
    expect(lastSiteDataReadTime(at(7, 0), schedule)).toBe(at(20, 0, 9));
    expect(lastSiteDataReadTime(at(0, 30))).toBe(at(0, 0));
  });
});
