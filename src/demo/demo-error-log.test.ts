import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/errors/codes';
import { formatErrorLog } from '@/errors/error-log';
import { demoErrorLog } from './demo-error-log';

describe('demoErrorLog', () => {
  const now = Date.UTC(2026, 10, 14, 12, 0);
  const log = demoErrorLog(now);

  it('uses documented codes only, dated before now, oldest first', () => {
    for (const entry of log.entries) expect(Object.keys(ERROR_CODES)).toContain(entry.code);
    const times = log.entries.map((entry) => entry.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.max(...times)).toBeLessThan(now);
  });

  it('shows a narrowed page with its sub-errors, a repeated error, URL, stack and outline', () => {
    const text = formatErrorLog(log);
    expect(text).toContain('► BB-PAGE-SKIP');
    expect(text).toContain('↳');
    expect(text).toContain('(×3)');
    expect(text).toContain('URL: https://');
    expect(text).toContain('at mainItem');
    expect(text).toContain('Outline:');
  });

  it('holds no real-looking pledge ids', () => {
    expect(formatErrorLog(log)).not.toMatch(/#\d{5,}/);
  });
});
