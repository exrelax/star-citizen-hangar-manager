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
        showRefund: false,
        shipLinks: { erkul: false, fleetyards: true },
      }),
    ).toEqual({
      language: 'de',
      hideMeltValue: true,
      hidePledgeIds: true,
      demoMode: true,
      showRefund: false,
      smartUpdates: true,
      buybackLinkMode: 'single',
      theme: 'rsi',
      filters: DEFAULT_SETTINGS.filters,
      shipLinks: { erkul: false, fleetyards: true },
    });
  });

  it('ignores invalid values', () => {
    expect(
      withDefaults({
        language: 'fr',
        hideMeltValue: 'yes',
        hidePledgeIds: 1,
        buybackLinkMode: 'popup',
        theme: 'neon',
        filters: { hangar: 'all', buyback: { order: 5 } },
      } as never),
    ).toEqual(DEFAULT_SETTINGS);
  });
});
