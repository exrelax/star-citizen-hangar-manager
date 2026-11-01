import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relative-time';

const now = Date.parse('2026-11-01T12:00:00Z');
const ago = (ms: number, locale = 'en') => formatRelativeTime(now - ms, now, locale);

describe('formatRelativeTime', () => {
  it('picks the largest fitting unit', () => {
    expect(ago(20 * 1000)).toBe('this minute');
    expect(ago(2 * 60 * 1000)).toBe('2 minutes ago');
    expect(ago(3 * 60 * 60 * 1000)).toBe('3 hours ago');
    expect(ago(24 * 60 * 60 * 1000)).toBe('yesterday');
    expect(ago(32 * 24 * 60 * 60 * 1000)).toBe('32 days ago');
  });

  it('uses the given locale', () => {
    expect(ago(2 * 60 * 1000, 'de')).toBe('vor 2 Minuten');
  });
});
