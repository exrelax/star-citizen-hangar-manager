import { BUYBACK_FILTER_CATEGORIES, type BuybackFilter } from '@/buyback/buyback-view';
import { FILTERS, FONT_SIZE_SCALES, PLEDGE_STORE } from '@/config';
import {
  normalizeFilterGroups,
  PLEDGE_FILTER_CATEGORIES,
  type FilterGroups,
  type PledgeFilter,
} from '@/hangar/filters';
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
  /** Lists only the best insurance in the items of upgraded ships, the one that counts. */
  hideSupersededInsurances: boolean;
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
  /** Smart updates read the warbond CCUs of the Pledge Store again after this many minutes. */
  storeRefreshMinutes: number;
  buybackLinkMode: BuybackLinkMode;
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
  /** Links shown next to ships. */
  shipLinks: {
    erkul: boolean;
    fleetyards: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  hideMeltValue: false,
  themedActionDialogs: false,
  translateRsiTexts: false,
  hideSupersededInsurances: true,
  hidePledgeIds: false,
  demoMode: false,
  hideRefund: false,
  smartUpdates: true,
  storeRefreshMinutes: PLEDGE_STORE.refreshMinutes.default,
  buybackLinkMode: 'single',
  theme: 'modern',
  fontSize: 'medium',
  compactView: false,
  filters: {
    hangar: normalizeFilterGroups(FILTERS.hangar, PLEDGE_FILTER_CATEGORIES, FILTERS.hangar),
    buyback: normalizeFilterGroups(FILTERS.buyback, BUYBACK_FILTER_CATEGORIES, FILTERS.buyback),
  },
  shipLinks: { erkul: true, fleetyards: true },
};

/**
 * Stored in `storage.sync`, so the settings follow the browser profile to other devices.
 * Only changed values need to be stored; `withDefaults` fills in the rest.
 */
export const settingsItem = storage.defineItem<Partial<Settings> | null>('sync:settings', {
  fallback: null,
});

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** Whole minutes in the range of the store's refresh interval. */
export const isRefreshMinutes = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= PLEDGE_STORE.refreshMinutes.min &&
  (value as number) <= PLEDGE_STORE.refreshMinutes.max;

/** A check that accepts only the given values, e.g. the themes. */
const oneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    values.includes(value as T);

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
    hideSupersededInsurances: pick('hideSupersededInsurances', isBoolean),
    hidePledgeIds: pick('hidePledgeIds', isBoolean),
    demoMode: pick('demoMode', isBoolean),
    hideRefund: pick('hideRefund', isBoolean),
    smartUpdates: pick('smartUpdates', isBoolean),
    storeRefreshMinutes: pick('storeRefreshMinutes', isRefreshMinutes),
    buybackLinkMode: pick('buybackLinkMode', oneOf(BUYBACK_LINK_MODES)),
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
    shipLinks: {
      erkul: stored?.shipLinks?.erkul ?? DEFAULT_SETTINGS.shipLinks.erkul,
      fleetyards: stored?.shipLinks?.fleetyards ?? DEFAULT_SETTINGS.shipLinks.fleetyards,
    },
  };
}

/** Back to the defaults: the stored settings are removed, `withDefaults` then gives the defaults. */
export async function resetSettings(): Promise<void> {
  await settingsItem.removeValue();
}
