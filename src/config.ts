/**
 * Tunable values of the extension in one place.
 */

/** Pledges per page in the RSI hangar ("My Gear"). Fixed by RSI. */
export const HANGAR_PAGE_SIZE = 10;

/**
 * URL parameter that pre-fills the search of the manager view, e.g.
 * `/account/pledges?search=f8c+lightning#hangar-manager`.
 */
export const SEARCH_URL_PARAM = 'search';

/** Delay after the last keystroke before the search term is written to the URL. */
export const SEARCH_URL_SYNC_DELAY_MS = 300;

/** Full sync: hangar pages requested at the same time – fast, but gentle on the RSI servers. */
export const SYNC_CONCURRENCY = 3;

/** Fleetyards models per request when looking up erkul ids (~60 KB each). */
export const FLEETYARDS_DETAILS_BATCH_SIZE = 20;

/** Smart updates: keep the stored hangar current by checking a few pages instead of all. */
export const SMART_UPDATE = {
  /** Minimum time between two automatic checks. */
  checkIntervalMs: 5 * 60 * 1000,
  /** Pages checked per run in addition to the first and the last page (rotating through all). */
  spotCheckPages: 2,
  /** Extra pages a check may load to locate changes; beyond that a full refresh is suggested. */
  maxRepairPages: 15,
  /** A full refresh is suggested once the last one is older than this. */
  suggestFullSyncAfterDays: 30,
  /** How often relative times in the status line ("2 min ago") are refreshed. */
  statusRefreshMs: 30 * 1000,
} as const;
