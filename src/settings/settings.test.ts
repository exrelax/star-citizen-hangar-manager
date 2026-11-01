import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from './settings';

describe('withDefaults', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values and fills in missing ones', () => {
    expect(
      withDefaults({ hideMeltValue: true, shipLinks: { erkul: false, fleetyards: true } }),
    ).toEqual({
      hideMeltValue: true,
      rewardVisibility: 'showAll',
      shipLinks: { erkul: false, fleetyards: true },
    });
  });

  it('ignores invalid values', () => {
    expect(withDefaults({ hideMeltValue: 'yes', rewardVisibility: 'sometimes' } as never)).toEqual(
      DEFAULT_SETTINGS,
    );
  });
});
