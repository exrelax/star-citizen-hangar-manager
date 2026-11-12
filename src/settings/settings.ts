import { DEFAULT_DEMO_SETTINGS, demoSettingsOf, type DemoSettings } from '@/demo/demo-settings';
import { notificationKindsOf, type NotificationKind } from '@/notifications/kinds';
import { BUYBACK_FILTER_CATEGORIES, type BuybackFilter } from '@/buyback/buyback-view';
import { FILTERS, FONT_SIZE_SCALES, PLEDGE_STORE, PRICE_INCREASES, SMART_UPDATE } from '@/config';
import {
  normalizeFilterGroups,
  PLEDGE_FILTER_CATEGORIES,
  type FilterGroups,
  type PledgeFilter,
} from '@/hangar/filters';
import {
  normalizeSidebarOrder,
  SIDEBAR_BOXES,
  sidebarBoxesOf,
  type SidebarBox,
} from '@/hangar/sidebar';
import { BUYBACK_SORTS, HANGAR_SORTS, type BuybackSort, type HangarSort } from '@/hangar/sorting';
import {
  DEFAULT_HISTORY_PERIOD,
  HISTORY_PERIODS,
  HISTORY_SORTS,
  type HistoryChoice,
} from '@/store/warbond-history-view';
import { isLocale, type Locale } from '@/i18n';

/** `auto`: the browser's language if there is a translation for it, English otherwise. */
export type LanguageSetting = 'auto' | Locale;

/**
 * What "Show in Buy Back" opens on RSI: `single` – a page with only this pledge (page size 1);
 * `list` – the regular list page, scrolled to the pledge and highlighted.
 */
export const BUYBACK_LINK_MODES = ['single', 'list'] as const;
export type BuybackLinkMode = (typeof BUYBACK_LINK_MODES)[number];

/**
 * Look of the manager, in the order of the setting's options: `modern` after Apple's HIG (the
 * default), `rsi` ("Classic RSI") like RSI's account pages (src/themes).
 */
/**
 * How the Paint Discount Consultant tells paints bought again (#139): `plan` – only those of a plan
 * put into the cart; `guess` – also others, by discount and age, shown as a guess to check.
 */
export const REBOUGHT_DETECTIONS = ['plan', 'guess'] as const;
export type ReboughtDetection = (typeof REBOUGHT_DETECTIONS)[number];

/**
 * How the Paint Discount Consultant shows its plan: `ways` – both ways ("buy first", "melt first")
 * side by side as cards, each with its own tier, steps and store credit (the default); `table` –
 * the plan and its paints in tables, as before.
 */
export const CONSULTANT_LAYOUTS = ['choose', 'ways', 'table'] as const;
export type ConsultantLayout = (typeof CONSULTANT_LAYOUTS)[number];

export const THEMES = ['modern', 'rsi'] as const;
export type Theme = (typeof THEMES)[number];

/** Text sizes, smallest first; `medium` is the one the themes are designed in. */
export const FONT_SIZES = Object.keys(FONT_SIZE_SCALES) as (keyof typeof FONT_SIZE_SCALES)[];
export type FontSize = keyof typeof FONT_SIZE_SCALES;

export interface Settings {
  language: LanguageSetting;
  /** Hides all $ amounts (pledge values, discounts, upgrade costs, orders, dialogs). */
  hideMeltValue: boolean;
  /**
   * Shows the exchange and gift dialogs in the selected theme; off: after RSI's own dialogs of
   * "My Gear" (see `hangar/components/action-dialog.css`).
   */
  themedActionDialogs: boolean;
  /**
   * Shows RSI's own texts of the exchange and gift dialogs translated; off: in RSI's English,
   * whose wording counts (see `hangar/rsi-text.ts`).
   */
  translateRsiTexts: boolean;
  /**
   * Experimental: exchanges (melts) all selected pledges of "My Hangar" at once, from the
   * sidebar's selection box (see `hangar/components/BulkExchangeOverlay.vue`).
   */
  bulkMelting: boolean;
  /** Lists only the best insurance in the items of upgraded ships, the one that counts. */
  hideSupersededInsurances: boolean;
  /** The sidebar's summaries also count the pledges per type (ships, CCUs, …). */
  summaryTypes: boolean;
  /** Shows the sidebar below RSI's navigation (see `hangar/components/HangarSidebar.vue`). */
  sidebar: boolean;
  /** Boxes of the sidebar switched off; boxes added later are shown. */
  sidebarHidden: SidebarBox[];
  /** Order of the boxes of the sidebar below RSI's navigation (see `hangar/sidebar.ts`). */
  sidebarOrder: SidebarBox[];
  /** Boxes of the sidebar collapsed to their title. */
  sidebarCollapsed: SidebarBox[];
  /** Hides the pledge ids (also those of applied CCUs). */
  hidePledgeIds: boolean;
  /** Shows a selection of the pledges with made-up ids instead of all (see `src/demo`). */
  demoMode: boolean;
  /**
   * Hides how many days are left to refund purchases paid with money, and the refund request
   * (see `orders/refund.ts`).
   */
  hideRefund: boolean;
  /** Keeps hangar, buy back and orders current by checking a few of their pages now and then. */
  smartUpdates: boolean;
  /** The kinds of notifications turned off (#197, see `notifications/kinds.ts`); all on by default. */
  notificationsOff: NotificationKind[];
  /**
   * Smart updates read the warbond CCUs of the Pledge Store again after this many minutes, except
   * around the full hour (`PLEDGE_STORE.fastWindow`).
   */
  storeRefreshMinutes: number;
  /** Minimum minutes between two smart updates of hangar, buy back and orders. */
  smartUpdateMinutes: number;
  /** Hangar pages a smart update checks besides the first and the last one. */
  spotCheckPages: number;
  buybackLinkMode: BuybackLinkMode;
  /** Days ahead the filter "Price Increase Expected" and its notification look (#192). */
  priceIncreaseDays: number;
  /**
   * The Price Increase Advisor's hint in the sidebar that a CCU to a rising ship can still be
   * bought at the old price, while the hangar has no CCU losing value by it (#254).
   */
  priceAdvisorSecureHint: boolean;
  theme: Theme;
  /** Text size of the manager and its dialogs, the same for both themes. */
  fontSize: FontSize;
  /**
   * Rows without gaps, in every theme: "Modern Hangar" as one grouped list with separators (off:
   * each row as a card of its own), "Classic RSI" with a 1 px border between them.
   */
  compactView: boolean;
  /** Order and selection of the filter buttons of both lists (presets: `FILTERS` in config). */
  filters: {
    hangar: FilterGroups<PledgeFilter>;
    buyback: FilterGroups<BuybackFilter>;
  };
  /** Order of both lists (see `hangar/sorting.ts`). */
  sort: {
    hangar: HangarSort;
    buyback: BuybackSort;
  };
  /** Order and period of the Pledge Store tab's Warbond CCU History (#297). */
  warbondHistory: HistoryChoice;
  /** The Paint Discount Consultant (see `store/paint-consultant`); it only uses store credit. */
  paintConsultant: {
    /** The cart may also be paid with the current store credit, not only with the melt values. */
    useStoreCredit: boolean;
    /** Cheap filler paints may be bought to reach a higher volume discount. */
    useFillers: boolean;
    /** Own paints that can be gifted are left out: bought again with store credit, they couldn't. */
    skipGiftable: boolean;
    /** How paints bought again are told (#139). */
    reboughtDetection: ReboughtDetection;
    /** How the plan is shown. */
    layout: ConsultantLayout;
  };
  /** Links shown next to ships. */
  shipLinks: {
    erkul: boolean;
    fleetyards: boolean;
  };
  /** The demo mode's own settings (#178, see `demo/demo-settings.ts`). */
  demo: DemoSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  hideMeltValue: false,
  themedActionDialogs: false,
  translateRsiTexts: false,
  bulkMelting: false,
  hideSupersededInsurances: true,
  summaryTypes: false,
  sidebar: true,
  sidebarHidden: [],
  sidebarOrder: [...SIDEBAR_BOXES],
  sidebarCollapsed: [],
  hidePledgeIds: false,
  demoMode: false,
  hideRefund: false,
  smartUpdates: true,
  notificationsOff: [],
  storeRefreshMinutes: PLEDGE_STORE.refreshMinutes.default,
  smartUpdateMinutes: SMART_UPDATE.checkMinutes.default,
  spotCheckPages: SMART_UPDATE.spotCheckPages.default,
  buybackLinkMode: 'single',
  priceIncreaseDays: PRICE_INCREASES.periodDays.default,
  priceAdvisorSecureHint: true,
  theme: 'modern',
  fontSize: 'medium',
  compactView: false,
  filters: {
    hangar: normalizeFilterGroups(FILTERS.hangar, PLEDGE_FILTER_CATEGORIES, FILTERS.hangar),
    buyback: normalizeFilterGroups(FILTERS.buyback, BUYBACK_FILTER_CATEGORIES, FILTERS.buyback),
  },
  sort: { hangar: 'newest', buyback: 'newest' },
  warbondHistory: { sort: 'date', period: DEFAULT_HISTORY_PERIOD },
  paintConsultant: {
    useStoreCredit: true,
    useFillers: true,
    skipGiftable: true,
    reboughtDetection: 'plan',
    layout: 'choose',
  },
  shipLinks: { erkul: true, fleetyards: true },
  demo: DEFAULT_DEMO_SETTINGS,
};

/**
 * Stored in `storage.sync`, so the settings follow the browser profile to other devices.
 * Only changed values need to be stored; `withDefaults` fills in the rest.
 */
export const settingsItem = storage.defineItem<Partial<Settings> | null>('sync:settings', {
  fallback: null,
});

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** A check for whole numbers in a range, e.g. minutes of an interval. */
export const isWholeNumberIn =
  ({ min, max }: { min: number; max: number }) =>
  (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Whole minutes in the range of the store's refresh interval. */
export const isRefreshMinutes = isWholeNumberIn(PLEDGE_STORE.refreshMinutes);
/** Whole minutes in the range of the smart update interval. */
export const isSmartUpdateMinutes = isWholeNumberIn(SMART_UPDATE.checkMinutes);
/** A number of spot check pages in its range. */
export const isSpotCheckPages = isWholeNumberIn(SMART_UPDATE.spotCheckPages);
/** Whole days in the range of the period of expected price increases. */
export const isPriceIncreaseDays = isWholeNumberIn(PRICE_INCREASES.periodDays);

/** A check that accepts only the given values, e.g. the themes. */
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.includes(value as T);

/** `value` if `isValid` accepts it, `fallback` otherwise. */
const valid = <T>(value: unknown, isValid: (value: unknown) => value is T, fallback: T): T =>
  isValid(value) ? value : fallback;

/** Complete settings from stored values, falling back to the defaults for missing or invalid ones. */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  /** The stored value of `key` if `isValid` accepts it, the default otherwise. */
  const pick = <K extends keyof Settings>(
    key: K,
    isValid: (value: unknown) => value is Settings[K],
  ): Settings[K] => {
    const value = stored?.[key];
    return isValid(value) ? value : DEFAULT_SETTINGS[key];
  };

  return {
    language: pick('language', isLocale),
    hideMeltValue: pick('hideMeltValue', isBoolean),
    themedActionDialogs: pick('themedActionDialogs', isBoolean),
    translateRsiTexts: pick('translateRsiTexts', isBoolean),
    bulkMelting: pick('bulkMelting', isBoolean),
    hideSupersededInsurances: pick('hideSupersededInsurances', isBoolean),
    summaryTypes: pick('summaryTypes', isBoolean),
    sidebar: pick('sidebar', isBoolean),
    sidebarHidden: sidebarBoxesOf(stored?.sidebarHidden),
    sidebarOrder: normalizeSidebarOrder(stored?.sidebarOrder),
    sidebarCollapsed: sidebarBoxesOf(stored?.sidebarCollapsed),
    hidePledgeIds: pick('hidePledgeIds', isBoolean),
    demoMode: pick('demoMode', isBoolean),
    hideRefund: pick('hideRefund', isBoolean),
    smartUpdates: pick('smartUpdates', isBoolean),
    notificationsOff: notificationKindsOf(stored?.notificationsOff),
    storeRefreshMinutes: pick('storeRefreshMinutes', isRefreshMinutes),
    smartUpdateMinutes: pick('smartUpdateMinutes', isSmartUpdateMinutes),
    spotCheckPages: pick('spotCheckPages', isSpotCheckPages),
    buybackLinkMode: pick('buybackLinkMode', oneOf(BUYBACK_LINK_MODES)),
    priceIncreaseDays: pick('priceIncreaseDays', isPriceIncreaseDays),
    priceAdvisorSecureHint: pick('priceAdvisorSecureHint', isBoolean),
    theme: pick('theme', oneOf(THEMES)),
    fontSize: pick('fontSize', oneOf(FONT_SIZES)),
    compactView: pick('compactView', isBoolean),
    filters: {
      hangar: normalizeFilterGroups(
        stored?.filters?.hangar,
        PLEDGE_FILTER_CATEGORIES,
        FILTERS.hangar,
      ),
      buyback: normalizeFilterGroups(
        stored?.filters?.buyback,
        BUYBACK_FILTER_CATEGORIES,
        FILTERS.buyback,
      ),
    },
    sort: {
      hangar: valid(stored?.sort?.hangar, oneOf(HANGAR_SORTS), DEFAULT_SETTINGS.sort.hangar),
      buyback: valid(stored?.sort?.buyback, oneOf(BUYBACK_SORTS), DEFAULT_SETTINGS.sort.buyback),
    },
    warbondHistory: warbondHistoryOf(stored?.warbondHistory),
    paintConsultant: {
      useStoreCredit: valid(
        stored?.paintConsultant?.useStoreCredit,
        isBoolean,
        DEFAULT_SETTINGS.paintConsultant.useStoreCredit,
      ),
      useFillers: valid(
        stored?.paintConsultant?.useFillers,
        isBoolean,
        DEFAULT_SETTINGS.paintConsultant.useFillers,
      ),
      skipGiftable: valid(
        stored?.paintConsultant?.skipGiftable,
        isBoolean,
        DEFAULT_SETTINGS.paintConsultant.skipGiftable,
      ),
      reboughtDetection: valid(
        stored?.paintConsultant?.reboughtDetection,
        oneOf(REBOUGHT_DETECTIONS),
        DEFAULT_SETTINGS.paintConsultant.reboughtDetection,
      ),
      layout: valid(
        stored?.paintConsultant?.layout,
        oneOf(CONSULTANT_LAYOUTS),
        DEFAULT_SETTINGS.paintConsultant.layout,
      ),
    },
    shipLinks: {
      erkul: stored?.shipLinks?.erkul ?? DEFAULT_SETTINGS.shipLinks.erkul,
      fleetyards: stored?.shipLinks?.fleetyards ?? DEFAULT_SETTINGS.shipLinks.fleetyards,
    },
    demo: demoSettingsOf(stored?.demo),
  };
}

/** Back to the defaults: the stored settings are removed, `withDefaults` then gives the defaults. */
export async function resetSettings(): Promise<void> {
  await settingsItem.removeValue();
}

/** The stored order and period of the Warbond CCU History, the defaults for invalid parts. */
function warbondHistoryOf(stored: Partial<HistoryChoice> | undefined): HistoryChoice {
  const defaults = DEFAULT_SETTINGS.warbondHistory;
  const eventId = stored?.eventId;
  return {
    sort: valid(stored?.sort, oneOf(HISTORY_SORTS), defaults.sort),
    period: valid(stored?.period, oneOf(HISTORY_PERIODS), defaults.period),
    ...(typeof eventId === 'string' && eventId.length <= 100 && { eventId }),
  };
}
