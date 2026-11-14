import { ERROR_LOG_VERSION, type ErrorLog } from '@/errors/error-log';
import type { ErrorCode } from '@/errors/codes';

/*
 * The error log of the demo mode (#340, #341): made-up entries instead of the real log, which
 * holds pledge titles, order dates and ids of the account (#132). They show what the log looks
 * like – a skipped pledge, a repeated error, errors of several areas – with times relative to now,
 * so the screenshot always looks recent. The ids are made up like the demo's other ids.
 */

const MINUTE = 60_000;

const ENTRIES: { minutesAgo: number; code: ErrorCode; message: string; count?: number }[] = [
  {
    minutesAgo: 3 * 24 * 60,
    code: 'SITE-DATA-FAIL',
    message: 'Expected price increases: HTTP 503; kept the last read',
  },
  {
    minutesAgo: 26 * 60,
    code: 'HANGAR-LINKS-FAIL',
    message: 'FleetYards: Failed to fetch; kept the known ship links',
  },
  {
    minutesAgo: 5 * 60,
    code: 'SMART-CHECK-FAIL',
    message: 'Buy back smart update: HTTP 502',
    count: 3,
  },
  {
    minutesAgo: 42,
    code: 'BB-PAGE-SKIP',
    message: 'Buy back position 1312: HTTP 500; the pledge there was left out',
  },
  {
    minutesAgo: 41,
    code: 'BB-DETAIL-SKIP',
    message: 'Buy back pledge #DEMO7Q2K4: HTTP 404; kept without its items and price',
  },
  {
    minutesAgo: 12,
    code: 'BB-DETAIL-OPEN',
    message: 'Buy back pledge #DEMO7Q2K4: HTTP 404 when opened; read again next time',
  },
];

/** The demo's error log, oldest first like the real one. */
export function demoErrorLog(now = Date.now()): ErrorLog {
  return {
    version: ERROR_LOG_VERSION,
    entries: ENTRIES.map(({ minutesAgo, ...entry }) => ({
      ...entry,
      at: now - minutesAgo * MINUTE,
    })),
  };
}
