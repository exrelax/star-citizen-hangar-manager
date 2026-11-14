import { ERROR_LOG_VERSION, type ErrorLog, type ErrorLogEntry } from '@/errors/error-log';
import type { ErrorCode } from '@/errors/codes';

/*
 * The error log of the demo mode (#340, #341, #342): made-up entries instead of the real log, which
 * holds pledge titles, order dates and ids of the account (#132). They show what the log looks
 * like – a narrowed page with its sub-errors, a repeated error, a URL, the place in the code of an
 * unexpected error, the outline of an entry RSI changed – with times relative to now, so the
 * screenshot always looks recent. Ids are made up like the demo's other ids, pledge names come
 * from the public Pledge Store.
 */

const MINUTE = 60_000;
const BUYBACK = 'https://robertsspaceindustries.com/en/account/buy-back-pledges';

type DemoEntry = Omit<ErrorLogEntry, 'at' | 'code' | 'subErrors'> & {
  minutesAgo: number;
  code: ErrorCode;
  subErrors?: (Omit<NonNullable<ErrorLogEntry['subErrors']>[number], 'at'> & {
    minutesAgo: number;
  })[];
};

const ENTRIES: DemoEntry[] = [
  {
    minutesAgo: 3 * 24 * 60,
    code: 'SITE-DATA-FAIL',
    message: 'Expected price increases: HTTP 503; kept the last read',
    url: 'https://exrelax.github.io/star-citizen-hangar-manager/data/price-increases.json',
  },
  {
    minutesAgo: 26 * 60,
    code: 'HANGAR-LINKS-FAIL',
    message: 'FleetYards: Failed to fetch; kept the known ship links',
    url: 'https://api.fleetyards.net/v1/models/slugs',
  },
  {
    minutesAgo: 9 * 60,
    code: 'PARSE-BUYBACK-NO-ID',
    message: '"Standalone Ships - Aurora MR" on a buy back page: no pledge id; left out',
    outline: [
      'li.row',
      '  figure',
      '    img',
      '  div.information',
      '    h1',
      '    dl',
      '      dt',
      '      dd',
      '  div.holosmallbtn-wrapper',
      '    button.holosmallbtn[type]',
    ].join('\n'),
  },
  {
    minutesAgo: 5 * 60,
    code: 'SMART-CHECK-FAIL',
    message: 'Buy back smart update: HTTP 502',
    url: `${BUYBACK}?page=1&pagesize=10`,
    count: 3,
  },
  {
    minutesAgo: 90,
    code: 'SYNC-UNEXPECTED',
    message:
      "Reading hangar stopped: Cannot read properties of undefined (reading 'title'); kept the last state",
    stack: [
      'at mainItem (content-scripts/hangar.js:13:20418)',
      'at buybackShipNames (content-scripts/hangar.js:13:20877)',
      'at Array.flatMap (<anonymous>)',
      'at enrichBuyback (content-scripts/hangar.js:13:24102)',
    ],
  },
  {
    minutesAgo: 42,
    code: 'BB-PAGE-SKIP',
    message:
      'Buy back position 1312, page of 1 pledge: HTTP 500; the pledge there was left out; the ' +
      'last read had buy back pledge #DEMO7Q2K4 "Package - Cutlass Black Starter Pack" (game ' +
      'package, contains "Cutlass Black and 5 items") there, after "Paints - Cutlass - Red ' +
      'Alert Paint", before "Upgrade - Avenger Titan to Cutlass Black"',
    url: `${BUYBACK}?page=1312&pagesize=1`,
    subErrors: [
      {
        minutesAgo: 43,
        message: 'Buy back page 6 of 250 pledges: HTTP 500',
        url: `${BUYBACK}?page=6&pagesize=250`,
      },
      {
        minutesAgo: 43,
        message: 'Buy back page 27 of 50 pledges: HTTP 500',
        url: `${BUYBACK}?page=27&pagesize=50`,
      },
      {
        minutesAgo: 42,
        message: 'Buy back page 132 of 10 pledges: HTTP 500',
        url: `${BUYBACK}?page=132&pagesize=10`,
      },
    ],
  },
  {
    minutesAgo: 12,
    code: 'BB-DETAIL-OPEN',
    message:
      'Buy back pledge #DEMO3M8Z1 "Package - Titan Starter Pack" (game package, contains ' +
      '"Avenger Titan and 3 items"): HTTP 404 when opened; read again next time',
    url: 'https://robertsspaceindustries.com/pledge/buyback/DEMO3M8Z1',
  },
];

/** The demo's error log, oldest first like the real one. */
export function demoErrorLog(now = Date.now()): ErrorLog {
  const at = (minutesAgo: number) => now - minutesAgo * MINUTE;
  return {
    version: ERROR_LOG_VERSION,
    entries: ENTRIES.map(({ minutesAgo, subErrors, ...entry }) => ({
      ...entry,
      at: at(minutesAgo),
      ...(subErrors && {
        subErrors: subErrors.map(({ minutesAgo: subAgo, ...sub }) => ({ ...sub, at: at(subAgo) })),
      }),
    })),
  };
}
