import { BUYBACK_FILTER_CATEGORIES, type BuybackFilter } from '@/buyback/buyback-view';
import { FILTERS } from '@/config';
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

/** Look of the manager: `rsi` like RSI's account pages, `modern` after Apple's HIG (src/themes). */
export const THEMES = ['rsi', 'modern'] as const;
export type Theme = (typeof THEMES)[number];

export interface Settings {
  language: LanguageSetting;
  /** Hides the $ values (pledge values, discounts, upgrade costs). */
  hideMeltValue: boolean;
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
  /** Shows how many days are left to refund purchases paid with money (see `orders/refund.ts`). */
  showRefund: boolean;
  /** Keeps the stored hangar current by checking a few hangar pages now and then. */
  smartUpdates: boolean;
  buybackLinkMode: BuybackLinkMode;
  theme: Theme;
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
  translateRsiTexts: false,
  hideSupersededInsurances: true,
  hidePledgeIds: false,
  demoMode: false,
  showRefund: true,
  smartUpdates: true,
  buybackLinkMode: 'single',
  theme: 'rsi',
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

/** Complete settings from stored values, falling back to the defaults for missing or invalid ones. */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  return {
    language: isLocale(stored?.language) ? stored.language : DEFAULT_SETTINGS.language,
    hideMeltValue:
      typeof stored?.hideMeltValue === 'boolean'
        ? stored.hideMeltValue
        : DEFAULT_SETTINGS.hideMeltValue,
    translateRsiTexts:
      typeof stored?.translateRsiTexts === 'boolean'
        ? stored.translateRsiTexts
        : DEFAULT_SETTINGS.translateRsiTexts,
    hideSupersededInsurances:
      typeof stored?.hideSupersededInsurances === 'boolean'
        ? stored.hideSupersededInsurances
        : DEFAULT_SETTINGS.hideSupersededInsurances,
    hidePledgeIds:
      typeof stored?.hidePledgeIds === 'boolean'
        ? stored.hidePledgeIds
        : DEFAULT_SETTINGS.hidePledgeIds,
    demoMode: typeof stored?.demoMode === 'boolean' ? stored.demoMode : DEFAULT_SETTINGS.demoMode,
    showRefund:
      typeof stored?.showRefund === 'boolean' ? stored.showRefund : DEFAULT_SETTINGS.showRefund,
    smartUpdates:
      typeof stored?.smartUpdates === 'boolean'
        ? stored.smartUpdates
        : DEFAULT_SETTINGS.smartUpdates,
    buybackLinkMode: BUYBACK_LINK_MODES.includes(stored?.buybackLinkMode as BuybackLinkMode)
      ? stored!.buybackLinkMode!
      : DEFAULT_SETTINGS.buybackLinkMode,
    theme: THEMES.includes(stored?.theme as Theme) ? stored!.theme! : DEFAULT_SETTINGS.theme,
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
