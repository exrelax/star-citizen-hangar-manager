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
        shipLinks: { erkul: false, fleetyards: true },
      }),
    ).toEqual({
      language: 'de',
      hideMeltValue: true,
      rewardVisibility: 'showAll',
      smartUpdates: true,
      buybackLinkMode: 'single',
      shipLinks: { erkul: false, fleetyards: true },
    });
  });

  it('ignores invalid values', () => {
    expect(
      withDefaults({
        language: 'fr',
        hideMeltValue: 'yes',
        rewardVisibility: 'sometimes',
        buybackLinkMode: 'popup',
      } as never),
    ).toEqual(DEFAULT_SETTINGS);
  });
});
