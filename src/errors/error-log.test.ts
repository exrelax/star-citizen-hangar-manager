import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  clearErrorLog,
  errorLogItem,
  formatErrorLog,
  logError,
  reasonOf,
  withEntry,
  withoutIds,
  ERROR_LOG_VERSION,
} from './error-log';

beforeEach(() => fakeBrowser.reset());

const entry = (at: number, message = `Error ${at}`) => ({ at, code: 'TEST', message });

describe('withEntry', () => {
  it('keeps the newest entries only', () => {
    let log = null;
    for (let at = 1; at <= 7; at++) log = withEntry(log, entry(at), 5);
    expect(log?.entries.map((e) => e.at)).toEqual([3, 4, 5, 6, 7]);
  });

  it('counts the same error right after itself', () => {
    let log = withEntry(null, entry(1, 'Same'));
    log = withEntry(log, entry(2, 'Same'));
    log = withEntry(log, entry(3, 'Same'));
    log = withEntry(log, entry(4, 'Other'));
    expect(log.entries).toEqual([
      { at: 3, code: 'TEST', message: 'Same', count: 3 },
      { at: 4, code: 'TEST', message: 'Other' },
    ]);
  });
});

describe('logError', () => {
  it('stores errors logged at the same time, and clears them', async () => {
    await Promise.all([logError('A', 'first', 1), logError('B', 'second', 2)]);
    expect((await errorLogItem.getValue())?.entries.map((e) => e.code)).toEqual(['A', 'B']);
    await clearErrorLog();
    expect(await errorLogItem.getValue()).toBeNull();
  });
});

describe('formatErrorLog', () => {
  it('lists the newest first, with code and count, without ids on demand', () => {
    const log = {
      version: ERROR_LOG_VERSION,
      entries: [
        { at: new Date(2026, 10, 14, 14, 56, 29).getTime(), code: 'A', message: 'Pledge #123456' },
        { at: new Date(2026, 10, 14, 15, 0, 0).getTime(), code: 'B', message: 'Page 3', count: 2 },
      ],
    };
    expect(formatErrorLog(log)).toBe(
      '2026-11-14 15:00:00 B Page 3 (×2)\n2026-11-14 14:56:29 A Pledge #123456',
    );
    expect(formatErrorLog(log, true)).toContain('A Pledge #<id>');
    expect(formatErrorLog(null)).toBe('');
  });
});

describe('withoutIds', () => {
  it('keeps page numbers and HTTP statuses', () => {
    expect(withoutIds('Buy back page 3, pledge 115089796: HTTP 404')).toBe(
      'Buy back page 3, pledge <id>: HTTP 404',
    );
  });
});

describe('reasonOf', () => {
  it('keeps the reason of a failed request, else the message', () => {
    expect(reasonOf(new Error('Loading buy back pledge 1 failed: HTTP 404'))).toBe('HTTP 404');
    expect(reasonOf(new Error('are you still logged in?'))).toBe('are you still logged in?');
    expect(reasonOf('text')).toBe('text');
  });
});
