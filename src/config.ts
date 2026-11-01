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
