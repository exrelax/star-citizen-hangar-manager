import { describe, expect, it } from 'vitest';
import { formatUntil } from './format-until';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('formatUntil', () => {
  it('counts days, then hours, then minutes', () => {
    expect(formatUntil(NOW + 3 * 24 * HOUR + HOUR, NOW, 'en')).toBe('in 3 days');
    expect(formatUntil(NOW + 5 * HOUR, NOW, 'en')).toBe('in 5 hours');
    expect(formatUntil(NOW + 90_000, NOW, 'en')).toBe('in 2 minutes');
    expect(formatUntil(NOW + 24 * HOUR, NOW, 'de')).toBe('morgen');
  });
});
