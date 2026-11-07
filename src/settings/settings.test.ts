import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from './settings';

describe('withDefaults', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values and fills in missing ones', () => {
    expect(
      withDefaults({
        language: 'de',
        hideMeltValue: true,
        hidePledgeIds: true,
        demoMode: true,
        hideRefund: true,
        shipLinks: { erkul: false, fleetyards: true },
      }),
    ).toEqual({
      language: 'de',
      hideMeltValue: true,
      themedActionDialogs: false,
      translateRsiTexts: false,
      hideSupersededInsurances: true,
      hidePledgeIds: true,
      demoMode: true,
      hideRefund: true,
      smartUpdates: true,
      storeRefreshMinutes: 5,
      buybackLinkMode: 'single',
      theme: 'modern',
      fontSize: 'medium',
      compactView: false,
      filters: DEFAULT_SETTINGS.filters,
      shipLinks: { erkul: false, fleetyards: true },
    });
  });

  it('ignores invalid values', () => {
    expect(
      withDefaults({
        language: 'it',
        hideMeltValue: 'yes',
        hidePledgeIds: 1,
        buybackLinkMode: 'popup',
        theme: 'neon',
        fontSize: 'huge',
        compactView: 'no',
        storeRefreshMinutes: 2.5,
        filters: { hangar: 'all', buyback: { order: 5 } },
      } as never),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts whole minutes in range for the store refresh only', () => {
    expect(withDefaults({ storeRefreshMinutes: 30 }).storeRefreshMinutes).toBe(30);
    for (const storeRefreshMinutes of [0, -5, 1441, 2.5, '10']) {
      expect(withDefaults({ storeRefreshMinutes } as never).storeRefreshMinutes).toBe(5);
    }
  });
});
