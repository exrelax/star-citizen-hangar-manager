import { describe, expect, it } from 'vitest';
import { giftWarnings, isEmail } from './gift';
import type { PledgeView } from './pledge-view';

describe('giftWarnings', () => {
  it('warns about the last pledge with game access and applied upgrades', () => {
    const pledge = { isLastAlpha: true, isUpgraded: true } as PledgeView;
    expect(giftWarnings(pledge).map((warning) => warning.kind)).toEqual([
      'lastGameAccess',
      'upgraded',
    ]);
    expect(giftWarnings({ isLastAlpha: false, isUpgraded: false } as PledgeView)).toEqual([]);
  });
});

describe('isEmail', () => {
  it('accepts plausible addresses only', () => {
    expect(isEmail('citizen@example.com')).toBe(true);
    expect(isEmail(' citizen@example.com ')).toBe(true);
    expect(isEmail('citizen@example')).toBe(false);
    expect(isEmail('citizen example@test.com')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});
