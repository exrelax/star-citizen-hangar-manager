import type { BuybackFilter } from '@/buyback/buyback-view';
import type { FilterGroups, PledgeFilter } from '@/hangar/filters';
import type { BuybackHighlight, HangarHighlight, HighlightMap } from '@/hangar/highlights';
import type { HangarSort } from '@/hangar/sorting';

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

/**
 * Features that can be switched on or off before they are settled (not settings: for testing).
 */
export const FEATURES = {
  /** The active tab's highlight slides over to the tab clicked (see `TabBar.vue`). */
  tabSlideAnimation: true,
} as const;

/** RSI's hangar page, which hosts the manager (the popup's links add the tab's hash). */
export const RSI_HANGAR_URL = 'https://robertsspaceindustries.com/en/account/pledges';

/**
 * RSI's Games Library: which pledge grants the game access of each game. Linked from protected
 * pledges (see `Pledge.protectedGames`).
 */
export const RSI_GAMES_LIBRARY_URL =
  'https://robertsspaceindustries.com/account/settings/games-library';

/** The extension's source code, linked from the popup and the settings ("About"). */
export const REPOSITORY_URL = 'https://github.com/exrelax/star-citizen-hangar-manager';

/** Pages of the repository linked from the settings ("About"). */
export const REPOSITORY_LINKS = {
  /** The issue forms: bug reports, and a link to the ideas in GitHub Discussions. */
  issues: `${REPOSITORY_URL}/issues/new/choose`,
  privacy: `${REPOSITORY_URL}/blob/main/PRIVACY.md`,
  changelog: `${REPOSITORY_URL}/blob/main/CHANGELOG.md`,
  license: `${REPOSITORY_URL}/blob/main/LICENSE`,
} as const;

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
 * RSI's Gifting FAQs: the gifting rules since `BUYBACK_GIFTABLE_PURCHASED_BEFORE`, including
 * gifting after a buy back. Linked from the gift dialog and the "probably giftable" notes.
 */
export const GIFTING_FAQ_URL =
  'https://support.robertsspaceindustries.com/hc/en-us/articles/115013325608-Gifting-FAQs';

/**
 * Rows the manager lists render at first. Filtering and searching always cover all entries; only
 * drawing is limited, which keeps thousands of entries fast.
 */
export const LIST_RENDER_BATCH = 100;

/**
 * Rows added per step while scrolling, each when the browser is idle. Small steps stay well below
 * one frame; steps of 100 rows made scrolling stutter (50–150 ms each).
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
 * Weights of the full sync's steps for its progress bar, counted in list entries:
 * - a list page: `requestOverhead` plus one per entry on it
 * - a buy back detail page: `detailPage`
 * - `finish`: the work after the pages of hangar and buy back each (ship images and links,
 *   storing; 0.1–0.3 s), so the bar doesn't reach 100 % too early
 *
 * Measured in November 2026 (3 requests in parallel): ~80 ms per hangar page (10 pledges),
 * ~470 ms per buy back page (250 pledges). So a buy back page weighs about 6 hangar pages, not
 * 25: every request has a fixed cost.
 */
export const SYNC_WORK = { requestOverhead: 40, detailPage: 70, finish: 150 };

/**
 * RSI's ship upgrade tool (see `src/ships`): ships with their standard prices, ships on sale and
 * warbond editions, read with one request. Read again with every full refresh and, with smart
 * updates, at the interval of the settings (`PLEDGE_STORE.refreshMinutes`) and every 30 seconds
 * around the full hour (`PLEDGE_STORE.fastWindow`).
 */
export const UPGRADE_TOOL = {
  /** With smart updates off: read again once the stored data is older than this. */
  maxAgeWithoutSmartUpdatesMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * RSI's public Ship Matrix: which ships are flight ready (#252). For now read on the cycle of the
 * Pledge Store items (`STORE_ITEMS`), when CIG changes the store and ships become flight ready,
 * but defined on its own, so it can change apart from them. Its answer is large (about 5 MB).
 */
export const SHIP_MATRIX = {
  url: 'https://robertsspaceindustries.com/ship-matrix/index',
  /**
   * Smart updates read it at these minutes of every hour (local clock, see
   * `src/store/refresh-schedule.ts`). Without smart updates once a day
   * (`maxAgeWithoutSmartUpdatesMs`).
   */
  readAtMinutes: [0, 5, 10, 30, 35],
  maxAgeWithoutSmartUpdatesMs: 24 * 60 * 60 * 1000,
} as const;

/** Fleetyards models per request when looking up erkul ids (~60 KB each). */
export const FLEETYARDS_DETAILS_BATCH_SIZE = 20;

/** Smart updates: keep the stored hangar current by checking a few pages instead of all. */
export const SMART_UPDATE = {
  /** Minimum minutes between two automatic checks (a setting; its default and range). */
  checkMinutes: { default: 5, min: 1, max: 1440 },
  /**
   * Hangar pages checked per run in addition to the first and the last page, rotating through
   * all (a setting; its default and range).
   */
  spotCheckPages: { default: 2, min: 1, max: 10 },
  /** The same for the buy back, whose pages are much larger (250 pledges, ~1 MB each). */
  buybackSpotCheckPages: 1,
  /**
   * The buy back compares its number of pledges with small pages (#126): first and last page,
   * the pages of the pledge log's pledges and the binary search load this many pledges each
   * (~80 KB instead of ~1 MB, measured November 2026); only the spot check loads a full page.
   * Locating a change takes more of them (log2 of ~400 pages), so they may take more pages too.
   */
  buybackCount: { pageSize: 10, maxRepairPages: 30 },
  /** Extra pages a check may load to locate changes; beyond that a full refresh is suggested. */
  maxRepairPages: 15,
  /** A full refresh is suggested once the last one is older than this. */
  suggestFullSyncAfterDays: 30,
  /** How often relative times in the status line ("2 min ago") are refreshed. */
  statusRefreshMs: 30 * 1000,
  /**
   * While the manager is shown in a visible tab, it looks this long after its last look (and the
   * check it started) whether a check is due (see `smart-update/schedule.ts`): the status never
   * gets much older than the interval plus this. A look without a due check only reads the
   * extension's storage, no request goes to RSI.
   */
  timerStepMs: 10 * 1000,
  /**
   * A check another tab announced counts as ended after this long, in case its end never arrives
   * (the tab was closed meanwhile). Checks take seconds; a large buy back up to a minute.
   */
  checkingElsewhereMaxMs: 2 * 60 * 1000,
  /**
   * An exchange, gift or applied upgrade confirmed in RSI's dialogs (#124, see
   * `smart-update/own-actions.ts`): checked this long after the click, once RSI processed it, or
   * on the next page load if RSI reloads it first – up to `maxAgeMs` after the click.
   */
  ownAction: { checkAfterMs: 4 * 1000, maxAgeMs: 2 * 60 * 1000 },
  /**
   * The adaptive interval (#125, see `smart-update/backoff.ts`): it doubles after each check that
   * found nothing, up to `maxFactor` times the set one, until a change or input in a tab. Input
   * is noted at most once per `inputThrottleMs`.
   */
  backoff: { maxFactor: 4, inputThrottleMs: 30 * 1000 },
} as const;

/**
 * The data files of the project website (`site/public/data/`), which GitHub Pages serves to any
 * origin, so no host permission is needed; only data, never code. Read at the times of `schedule`
 * (UTC, the same for every user; see `src/site-data/site-data-schedule.ts`): every two hours,
 * hourly from 14:00 to 22:00 and every 15 minutes from 15:00 to 18:30 – in Central European
 * (winter) time every two hours, hourly from 15:00 to 23:00 and every 15 minutes from 16:00 to
 * 19:30, when CIG usually changes the Pledge Store (e.g. 17:00 during the IAE). After a failure
 * again after `retryMs` at the latest.
 */
export const SITE_DATA = {
  schedule: [
    { from: '01:00', to: '23:59', everyMinutes: 120 },
    { from: '14:00', to: '22:00', everyMinutes: 60 },
    { from: '15:00', to: '18:30', everyMinutes: 15 },
  ],
  retryMs: 60 * 60 * 1000,
} as const;

/**
 * The ships' facts of the project website (#107, #109): status, "always available" and standard
 * price of every ship with their history (`data/ships.json`). Larger than the other files and
 * changing rarely: read at most once a day. A copy is bundled for the first start and offline.
 */
export const SHIP_FACTS = {
  url: 'https://exrelax.github.io/star-citizen-hangar-manager/data/ships.json',
  /** The format the extension reads; files of other versions are ignored. */
  schemaVersion: 1,
  maxAgeMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * The event notices of the Pledge Store tab (#69): a list of events (e.g. the Intergalactic
 * Aerospace Expo) on the project website, read like its other data files (`SITE_DATA`).
 */
export const EVENTS = {
  url: 'https://exrelax.github.io/star-citizen-hangar-manager/data/events.json',
  /** Where event images may come from: the project website only. */
  imageBase: 'https://exrelax.github.io/star-citizen-hangar-manager/',
  /** The format the extension reads; files of other versions are ignored. */
  schemaVersion: 1,
} as const;

/**
 * Earlier warbond offers of the project website (`data/warbond-history.json`): offers seen before
 * the Hangar Manager read the Pledge Store, shown with the history of this browser (#4, #297).
 * Changing rarely: read at most once a day.
 */
export const WARBOND_HISTORY_SITE = {
  url: 'https://exrelax.github.io/star-citizen-hangar-manager/data/warbond-history.json',
  /** The format the extension reads; files of other versions are ignored. */
  schemaVersion: 1,
  maxAgeMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * The expected price increases of the Buy Back Reminder (#195): ships whose price is expected to
 * rise, on the project website like the events, read the same way (`SITE_DATA`).
 */
export const PRICE_INCREASES = {
  url: 'https://exrelax.github.io/star-citizen-hangar-manager/data/price-increases.json',
  /** The format the extension reads; files of other versions are ignored. */
  schemaVersion: 1,
  /**
   * The buy back filter "Price Increase Expected" and its notification count price increases
   * within this many days (a setting; this is its default and its range, #192).
   */
  periodDays: { default: 14, min: 1, max: 90 },
  /**
   * A buy back pledge with less time than this left until its expected price increase is told in
   * the browser, also while no RSI page is open (#193).
   */
  browserNoticeMs: 2 * 24 * 60 * 60 * 1000,
} as const;

/**
 * The items of RSI's Pledge Store (see `src/store/items`), read with the store's own search: all
 * items of these products, 100 per request – 13 requests, ~2 s for ~680 items (November 2026).
 * Physical merchandise and CCUs (from the ship upgrade tool) are left out.
 */
export const STORE_ITEMS = {
  /** RSI's product ids: standalone ships, gear, packs, add-ons, game packages, paints, … */
  products: [
    { id: 72, name: 'Standalone Ships' },
    { id: 289, name: 'Gear' },
    { id: 270, name: 'Packs' },
    { id: 3, name: 'Add-Ons' },
    { id: 45, name: 'Package' },
    { id: 268, name: 'Paints' },
    { id: 65, name: 'Subscribers Store' },
    { id: 60, name: 'Gift Cards' },
  ],
  pageSize: 100,
  /** Requests at the same time. */
  concurrency: 2,
  /**
   * Smart updates read the items at these minutes of every hour (local clock), when CIG changes
   * the Pledge Store (see `src/store/refresh-schedule.ts`). Without smart updates once a day
   * (`maxAgeWithoutSmartUpdatesMs`).
   */
  readAtMinutes: [0, 5, 10, 30, 35],
  maxAgeWithoutSmartUpdatesMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * RSI's volume discount tiers for paints (November 2026), taken off in the cart: 2 paints 15 %,
 * 3 paints 20 %, 5 paints 25 %, 7 paints 30 %, 10 or more 35 %. A paint pledge's discount within
 * `tolerance` percentage points of a tier is rounded to it (see `roundToPaintTier`); older paint
 * packages with other discounts keep theirs.
 */
export const PAINT_DISCOUNT_TIERS = {
  tiers: [
    { paints: 2, percent: 15 },
    { paints: 3, percent: 20 },
    { paints: 5, percent: 25 },
    { paints: 7, percent: 30 },
    { paints: 10, percent: 35 },
  ],
  tolerance: 0.2,
} as const;

/**
 * The Paint Discount Consultant (see `src/store/paint-consultant`): RSI's cart takes this many of
 * the same item; a kept plan is checked against the orders for this many days (#105).
 */
export const PAINT_CONSULTANT = { maxPerItem: 5, fillerCheckDays: 7 } as const;

/** The "Pledge Store" tab: current warbond CCUs from RSI's ship upgrade tool (see `src/store`). */
export const PLEDGE_STORE = {
  /** Ships to start from shown per warbond: those with the cheapest CCUs to it. */
  baseShips: 10,
  /**
   * Smart updates read the stored offers again once they are older than this many minutes (a
   * setting; this is its default and its range).
   */
  refreshMinutes: { default: 5, min: 1, max: 1440 },
  /**
   * Around the full hour, when CIG changes the Pledge Store, the warbond CCUs are read every
   * `everyMs` instead (minutes of the local clock, both included; see
   * `src/store/refresh-schedule.ts`).
   */
  fastWindow: { from: 59, to: 10, everyMs: 30 * 1000 },
  /**
   * A read of the upgrade tool or the store items holds a lease in the storage for at most this
   * long, so RSI's tabs and the background script don't read at the same time (#163).
   */
  readLeaseMs: 60 * 1000,
  /**
   * While browser notifications are on, the background script looks this often whether the
   * Pledge Store is due (an alarm; Chrome allows 30 seconds at the most).
   */
  backgroundCheckMinutes: 0.5,
  /** How often an open Pledge Store tab looks whether its offers are due. */
  dueCheckMs: 60 * 1000,
  /** Sightings of warbond offers kept in the history at the most (#4); the oldest go first. */
  historyMax: 2000,
} as const;

/**
 * Demo mode (a setting) for screenshots: a fixed selection of the stored pledges with made-up
 * pledge ids (see `src/demo`).
 */
export const DEMO = {
  /**
   * Made-up ids of the generated demo pledges count down from here (#175): far above RSI's, and
   * the views show them only as made-up display ids.
   */
  idBase: 990_000_000,
  /** How many pledges of each kind the generated demo hangar has (#175, the demo settings). */
  composition: {
    ships: 14,
    packages: 4,
    ccus: 30,
    paints: 30,
    gear: 8,
    addOns: 6,
    packs: 3,
    rewards: 5,
  },
  /** Minutes the invisible demo mode for screenshots lasts (#133, development builds only). */
  invisibleMinutes: 10,
  /** Buy back tokens an account can have at most. */
  maxBuybackTokens: 2,
  /** How many pledges of each kind the generated buy back has (#177). */
  buybackComposition: {
    ships: 5,
    packages: 2,
    ccus: 14,
    paints: 14,
    gear: 5,
    addOns: 3,
    withoutPrice: 2,
    rewards: 2,
  },
  /** Pledges shown in "My Hangar" and in the buy back (the selection of the own pledges). */
  hangarPledges: 100,
  buybackPledges: 50,
  /** Ships whose pledges are always part of the demo (by the ship's name, not by pledge id). */
  includeShips: ['Polaris'],
  /** Pledges with applied CCUs always part of the demo, for their "Applied upgrades". */
  upgradedPledges: 4,
  /**
   * Days left to refund for the first pledges with a money-paid order: their purchase date is
   * set accordingly, so the demo always shows the refund tag – normal and in its last week.
   */
  refundDaysLeft: [20, 3],
  /**
   * Hours before the start of the current hour that the newest meltable pledge bought with store
   * credit was bought in the demo, so marking it to melt shows the countdown to RSI's 24 hours.
   */
  justBoughtHoursAgo: 3,
  /** Earliest made-up purchase date (the other dates are random, up to today). */
  earliestDate: '2013-01-01',
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

/**
 * Exchanging the last pledge with game access first shows a warning whose "Continue" is enabled
 * after this delay – as in RSI's own dialog.
 */
export const EXCHANGE_ATTENTION_DELAY_MS = 5_000;

/**
 * Bulk melting (an experimental setting) exchanges the selected pledges one after the other, with
 * this pause between two of RSI's requests, so they don't come in a burst.
 */
export const BULK_EXCHANGE_DELAY_MS = 1_000;

/**
 * RSI lets a pledge be melted only this long after it was bought, with store credit or money
 * (RSI Support: "Reclaim a Pledge"). Pledges marked to melt count down to it (see
 * `hangar/melt-marks.ts`).
 */
export const MELT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** How often times counting down (e.g. to melting a marked pledge) are updated on screen. */
export const CLOCK_TICK_MS = 30 * 1000;

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

/**
 * What a filter set to "include" or a sorting highlights in the rows (#216): the values it is
 * about, so the list shows why each entry is there. The targets are fixed per list
 * (`hangar/highlights.ts`).
 */
export const FILTER_HIGHLIGHTS: {
  hangar: HighlightMap<PledgeFilter, HangarHighlight>;
  buyback: HighlightMap<BuybackFilter, BuybackHighlight>;
  sorts: HighlightMap<HangarSort, HangarHighlight>;
} = {
  hangar: {
    giftable: ['value', 'giftBadge'],
    meltable: ['value', 'meltBadge'],
    valuable: ['value'],
    warbond: ['value'],
    discount: ['discount'],
    lti: ['insuranceBadge'],
    gameAccess: ['gameAccessBadge'],
    priceChange: ['priceIncreaseLabel'],
  },
  buyback: {
    warbond: ['price'],
    available: ['price'],
    priceIncrease: ['priceIncreaseLabel'],
    probablyGiftable: ['giftableLabel'],
    lti: ['insuranceBadge'],
  },
  sorts: { valueDesc: ['value'], valueAsc: ['value'], discountDesc: ['discount'] },
};

/**
 * Preset filter buttons of "My Hangar" and the buy back, until the user changes them in the
 * settings. Per category (`types`: what a pledge is, `features`: what it has):
 * - `order`: the order of the buttons; filters missing here follow at the end
 * - `shown`: the buttons shown at all
 *
 * Which filter belongs to which category is fixed in `hangar/filters.ts` and
 * `buyback/buyback-view.ts`. Filters added in later versions get these presets in the stored
 * settings, too.
 */
export const FILTERS: {
  hangar: FilterGroups<PledgeFilter>;
  buyback: FilterGroups<BuybackFilter>;
} = {
  hangar: {
    types: {
      order: ['ships', 'ccus', 'paints', 'gameAccess', 'rewards'],
      shown: ['ships', 'ccus', 'paints', 'gameAccess', 'rewards'],
    },
    features: {
      order: ['lti', 'warbond', 'giftable', 'meltable', 'valuable', 'discount', 'priceChange'],
      shown: ['lti', 'warbond', 'giftable', 'meltable', 'valuable', 'discount', 'priceChange'],
    },
  },
  buyback: {
    types: {
      order: ['ships', 'ccus', 'paints', 'gameAccess', 'rewards'],
      shown: ['ships', 'ccus', 'paints', 'gameAccess', 'rewards'],
    },
    features: {
      order: ['lti', 'warbond', 'probablyGiftable', 'available', 'priceIncrease'],
      shown: ['lti', 'warbond', 'probablyGiftable', 'available', 'priceIncrease'],
    },
  },
};

/**
 * Text sizes of the setting "Font size": factors on all font sizes (and line heights) of
 * the manager and its dialogs. `medium` is the size the themes are designed in.
 */
export const FONT_SIZE_SCALES = { small: 0.9, medium: 1, large: 1.15 } as const;

/**
 * How long the initial load takes, shown before it starts: pledges of hangar and buy back
 * together, and about how many seconds.
 *
 * Measured in Chrome with nothing stored: ~5,000 pledges (986 hangar, 3,976 buy back, plus 1,555
 * orders; 634 RSI pages) took 81.8 s. The example for 1,000 pledges is scaled down from that.
 * Later refreshes read only the new orders and are much faster (18.7 s, 128 pages).
 */
export const INITIAL_LOAD_EXAMPLES = [
  { pledges: 1000, seconds: 20 },
  { pledges: 5000, seconds: 90 },
] as const;
