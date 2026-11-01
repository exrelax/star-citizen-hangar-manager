/** Which reward pledges the hangar list hides. */
export const REWARD_VISIBILITIES = ['showAll', 'hideAll', 'hideConcierge', 'hideEvent'] as const;
export type RewardVisibility = (typeof REWARD_VISIBILITIES)[number];

export interface Settings {
  /** Hides the $ values in the hangar list. */
  hideMeltValue: boolean;
  rewardVisibility: RewardVisibility;
  /** Keeps the stored hangar current by checking a few hangar pages now and then. */
  smartUpdates: boolean;
  /** Links shown next to ships. */
  shipLinks: {
    erkul: boolean;
    fleetyards: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  hideMeltValue: false,
  rewardVisibility: 'showAll',
  smartUpdates: true,
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
    hideMeltValue:
      typeof stored?.hideMeltValue === 'boolean'
        ? stored.hideMeltValue
        : DEFAULT_SETTINGS.hideMeltValue,
    rewardVisibility: REWARD_VISIBILITIES.includes(stored?.rewardVisibility as RewardVisibility)
      ? stored!.rewardVisibility!
      : DEFAULT_SETTINGS.rewardVisibility,
    smartUpdates:
      typeof stored?.smartUpdates === 'boolean'
        ? stored.smartUpdates
        : DEFAULT_SETTINGS.smartUpdates,
    shipLinks: {
      erkul: stored?.shipLinks?.erkul ?? DEFAULT_SETTINGS.shipLinks.erkul,
      fleetyards: stored?.shipLinks?.fleetyards ?? DEFAULT_SETTINGS.shipLinks.fleetyards,
    },
  };
}
