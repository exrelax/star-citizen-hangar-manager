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
        sidebar: false,
        sidebarHidden: ['selection', 'events' as never],
        sort: { hangar: 'valueDesc', buyback: 'valueDesc' as never },
        shipLinks: { erkul: false, fleetyards: true },
        paintConsultant: { useStoreCredit: false } as never,
      }),
    ).toEqual({
      language: 'de',
      hideMeltValue: true,
      themedActionDialogs: false,
      translateRsiTexts: false,
      hideSupersededInsurances: true,
      summaryTypes: false,
      sidebar: false,
      sidebarHidden: ['selection'],
      sidebarOrder: ['storeCredit', 'summary', 'selection'],
      sidebarCollapsed: [],
      hidePledgeIds: true,
      demoMode: true,
      hideRefund: true,
      smartUpdates: true,
      storeRefreshMinutes: 5,
      storeItemsMinutes: 5,
      smartUpdateMinutes: 5,
      spotCheckPages: 2,
      buybackLinkMode: 'single',
      theme: 'modern',
      fontSize: 'medium',
      compactView: false,
      filters: DEFAULT_SETTINGS.filters,
      // The buy back can't sort by value: back to the default.
      sort: { hangar: 'valueDesc', buyback: 'newest' },
      paintConsultant: { useStoreCredit: false, useFillers: true, skipGiftable: true },
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
        paintConsultant: { useStoreCredit: 'yes', useFillers: 0 },
        sidebarOrder: 'summary',
        sidebarCollapsed: ['events'],
        sidebar: 'no',
        sidebarHidden: 'summary',
      } as never),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts whole minutes in range for the store refresh only', () => {
    expect(withDefaults({ storeRefreshMinutes: 30 }).storeRefreshMinutes).toBe(30);
    expect(withDefaults({ smartUpdateMinutes: 15 }).smartUpdateMinutes).toBe(15);
    expect(withDefaults({ storeItemsMinutes: 60 }).storeItemsMinutes).toBe(60);
    for (const storeItemsMinutes of [0, 1441, 2.5]) {
      expect(withDefaults({ storeItemsMinutes }).storeItemsMinutes).toBe(5);
    }
    expect(withDefaults({ spotCheckPages: 10 }).spotCheckPages).toBe(10);
    for (const spotCheckPages of [0, 11, 1.5, '3']) {
      expect(withDefaults({ spotCheckPages } as never).spotCheckPages).toBe(2);
    }
    for (const smartUpdateMinutes of [0, 1441, 2.5]) {
      expect(withDefaults({ smartUpdateMinutes }).smartUpdateMinutes).toBe(5);
    }
    for (const storeRefreshMinutes of [0, -5, 1441, 2.5, '10']) {
      expect(withDefaults({ storeRefreshMinutes } as never).storeRefreshMinutes).toBe(5);
    }
  });
});
