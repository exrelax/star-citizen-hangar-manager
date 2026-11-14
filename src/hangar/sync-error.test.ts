import { describe, expect, it } from 'vitest';
import { syncErrorReport } from './sync-error';

describe('syncErrorReport', () => {
  it('names version, browser, part and error, without pledge ids', () => {
    const report = syncErrorReport(
      {
        storage: 'buyback',
        code: 'SYNC-BUYBACK-FAIL',
        message: 'Loading buy back pledge 115089796 failed: HTTP 404',
        at: Date.UTC(2026, 10, 14, 10, 0),
      },
      { version: '1.2.0', userAgent: 'Mozilla/5.0 Chrome/142' },
    );
    expect(report).toBe(
      [
        'Star Citizen Hangar Manager 1.2.0',
        'Mozilla/5.0 Chrome/142',
        'SYNC-BUYBACK-FAIL: reading buyback failed at 2026-11-14T10:00:00.000Z',
        'Loading buy back pledge <id> failed: HTTP 404',
      ].join('\n'),
    );
  });

  it('keeps page numbers and HTTP statuses', () => {
    const report = syncErrorReport(
      {
        storage: 'buyback',
        code: 'SYNC-BUYBACK-FAIL',
        message: 'Loading buy back page 3 failed: HTTP 502',
        at: 0,
      },
      { version: '1.2.0', userAgent: 'UA' },
    );
    expect(report).toContain('Loading buy back page 3 failed: HTTP 502');
  });
});
