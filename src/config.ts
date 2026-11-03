/**
 * Tunable values of the extension in one place.
 */

/**
 * Which browser language the "Automatic" language setting follows (English if the extension isn't
 * translated into it):
 * - `'ui'`: the language of the browser's own interface (menus, dialogs), via
 *   `browser.i18n.getUILanguage()`. Usually follows the operating system.
 * - `'preferred'`: the first language the browser asks websites for, via `navigator.language`.
 *   Set in Chrome under Settings → Languages → Preferred languages; can differ from the interface
 *   language (e.g. an English browser that prefers German websites).
 */
export const AUTO_LANGUAGE_SOURCE: 'ui' | 'preferred' = 'preferred';

/** Pledges per page in the RSI hangar ("My Gear"). Fixed by RSI. */
export const HANGAR_PAGE_SIZE = 10;

/**
 * URL parameter that pre-fills the search of the manager view, e.g.
 * `/account/pledges?search=f8c+lightning#hangar-manager`.
 */
export const SEARCH_URL_PARAM = 'search';

/**
 * URL parameter of the "show in My Gear" links: the pledge id to scroll to and highlight, e.g.
 * `/account/pledges?page=52&highlight=68429257`. It is removed from the URL once handled.
 */
export const HIGHLIGHT_URL_PARAM = 'highlight';

/**
 * If the stored page of a pledge is outdated, up to this many neighbouring pages are searched
 * (in the background) before giving up.
 */
export const HIGHLIGHT_MAX_PAGE_HOPS = 3;

/** Delay after the last keystroke before the search term is written to the URL. */
export const SEARCH_URL_SYNC_DELAY_MS = 300;

/** Buy back pledges per page; the largest page size RSI accepts for the buy back list. */
export const BUYBACK_PAGE_SIZE = 250;

/**
 * Buy back pledges bought before this date are "probably giftable" when bought back with real
 * money (warbond). Purchase dates aren't listed in the buy back, so they are derived from the
 * pledge id (ids grow over time) and the reclaim date (see buyback-view.ts).
 */
export const BUYBACK_GIFTABLE_PURCHASED_BEFORE = '2026-10-30';

/**
 * Rows the manager lists render at first. Filtering and searching always cover all entries; only
 * drawing is limited, which keeps thousands of entries fast.
 */
export const LIST_RENDER_BATCH = 100;

/**
 * Rows added per step while scrolling. Each step runs when the browser is idle, between the
 * frames of the scrolling. Steps of 100 rows blocked scrolling for 50–150 ms each (noticeable
 * hitches); small steps stay well below one frame.
 */
export const LIST_RENDER_STEP = 15;

/**
 * How far before the end of the rendered rows the next rows are added (CSS margin). Large enough
 * that the small steps stay ahead of fast scrolling.
 */
export const LIST_RENDER_AHEAD = '2500px';

/** Full sync: hangar pages requested at the same time – fast, but gentle on the RSI servers. */
export const SYNC_CONCURRENCY = 3;

/**
 * Estimated work of the full sync's requests, for its progress bar – in "list entries": a list
 * page costs `requestOverhead` plus one per entry it lists, a buy back detail page `detailPage`.
 * `finish` is what hangar and buy back each need after their pages: ship images and links
 * (Fleetyards, slower when new ships came up) and storing – about 0.1–0.3 s. Counting it keeps
 * the bar from showing 100 % while that still runs.
 * Measured in a full sync (3 requests in parallel) in November 2026: ~80 ms per hangar page (10
 * pledges) and ~470 ms per buy back page (250 pledges). A buy back page so fills the bar about
 * 6 times as much as a hangar page – not 25 times, as every request has a fixed cost.
 */
export const SYNC_WORK = { requestOverhead: 40, detailPage: 70, finish: 150 };

/**
 * The original ship prices (RSI's ship upgrade tool) are reloaded with every full refresh, and
 * by the smart update once they are older than this. They change rarely.
 */
export const SHIP_PRICES_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Fleetyards models per request when looking up erkul ids (~60 KB each). */
export const FLEETYARDS_DETAILS_BATCH_SIZE = 20;

/** Smart updates: keep the stored hangar current by checking a few pages instead of all. */
export const SMART_UPDATE = {
  /** Minimum time between two automatic checks. */
  checkIntervalMs: 5 * 60 * 1000,
  /** Pages checked per run in addition to the first and the last page (rotating through all). */
  spotCheckPages: 2,
  /** The same for the buy back, whose pages are much larger (250 pledges, ~1 MB each). */
  buybackSpotCheckPages: 1,
  /** Extra pages a check may load to locate changes; beyond that a full refresh is suggested. */
  maxRepairPages: 15,
  /** A full refresh is suggested once the last one is older than this. */
  suggestFullSyncAfterDays: 30,
  /** How often relative times in the status line ("2 min ago") are refreshed. */
  statusRefreshMs: 30 * 1000,
} as const;

/**
 * Demo mode (a setting) for screenshots: a fixed selection of the stored pledges with made-up
 * pledge ids (see `src/demo`).
 */
export const DEMO = {
  /** Pledges shown in "My Hangar" and in the buy back. */
  hangarPledges: 100,
  buybackPledges: 50,
  /** Ships whose pledges are always part of the demo (by the ship's name, not by pledge id). */
  includeShips: ['Polaris'],
  /** Pledges with applied CCUs always part of the demo, for their "Applied upgrades". */
  upgradedPledges: 4,
} as const;

/**
 * Orders of the pledges (see `src/orders`): read from RSI's pledge log (25 entries per page,
 * hundreds of pages for large accounts) and billing list (100 orders per page). The first sync
 * reads everything, later ones only the new entries.
 */
export const ORDERS = {
  /** Requests at the same time. RSI already throttles three (HTTP 429) every now and then. */
  concurrency: 2,
  /** Waits before trying a throttled (HTTP 429) request again. */
  retryDelaysMs: [2_000, 4_000, 8_000, 16_000],
  billingPageSize: 100,
} as const;

/** CIG refunds purchases paid with money within this many days (shown in "My Hangar"). */
export const REFUND_DAYS = 30;
/** From this many days left on, the refund tag is highlighted. */
export const REFUND_URGENT_DAYS = 7;

/**
 * RSI's support form (Zendesk) opened by "Refund Request": its "Ship & Pledge Query" form with
 * "Tell us more about your problem" set to "Other ship or pledge query" (a custom field).
 */
export const REFUND_REQUEST_FORM = {
  url: 'https://support.robertsspaceindustries.com/hc/en-us/requests/new',
  ticketFormId: '360000663594',
  problemFieldId: '360014846974',
  problemValue: 'other_ship_or_pledge_query',
} as const;
