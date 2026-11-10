import { describe, expect, it } from 'vitest';
import { formatCountdown } from './countdown';

const HOUR = 60 * 60 * 1000;

describe('formatCountdown', () => {
  it('counts days, then hours, minutes and seconds', () => {
    expect(formatCountdown(2 * 24 * HOUR + 3 * HOUR + 12 * 60_000 + 45_500, 'en')).toBe(
      '2 d 03:12:45',
    );
    expect(formatCountdown(2 * 24 * HOUR, 'de')).toBe('2 T 00:00:00');
    expect(formatCountdown(59_999, 'en')).toBe('00:00:59');
    expect(formatCountdown(-5, 'en')).toBe('00:00:00');
  });
});
