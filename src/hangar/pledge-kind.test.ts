import { describe, expect, it } from 'vitest';
import { kindIcon, pledgeKind } from './pledge-kind';
import type { PledgeView } from './pledge-view';

const pledge = (overrides: Partial<PledgeView> = {}) =>
  ({
    id: 1,
    title: 'Test',
    ships: [],
    isCcu: false,
    isUpgraded: false,
    hasGameAccess: false,
    isPaint: false,
    isGiftable: false,
    isLastAlpha: false,
    isBuybackable: true,
    ...overrides,
  }) as PledgeView;

describe('pledgeKind', () => {
  it('tells CCUs, upgraded ships, game packages and paints apart', () => {
    expect(pledgeKind(pledge({ isCcu: true }))).toBe('ccu');
    expect(pledgeKind(pledge({ isUpgraded: true, titleShip: { name: 'Polaris' } }))).toBe(
      'upgradedShip',
    );
    expect(pledgeKind(pledge({ hasGameAccess: true, ships: [{ name: 'Aurora' }] }))).toBe(
      'gamePackage',
    );
    expect(pledgeKind(pledge({ isPaint: true }))).toBe('paint');
  });

  it('counts the ships of other pledges', () => {
    expect(pledgeKind(pledge({ ships: [{ name: 'Fury' }] }))).toBe('ship');
    expect(pledgeKind(pledge({ ships: [{ name: 'Fury' }, { name: 'Pisces' }] }))).toBe('ships');
    expect(pledgeKind(pledge({ reward: 'event' as PledgeView['reward'] }))).toBe('reward');
    expect(pledgeKind(pledge())).toBe('other');
  });
});

describe('kindIcon', () => {
  it('marks CCUs, paints and pledges with ships', () => {
    const base = {
      isCcu: false,
      isPaint: false,
      isGamePackage: false,
      isReward: false,
      hasGameAccess: false,
      ships: [],
    };
    expect(kindIcon({ ...base, isCcu: true })).toBe('square-up-right');
    expect(kindIcon({ ...base, isPaint: true })).toBe('palette');
    expect(kindIcon({ ...base, ships: [{ name: 'Fury' }] })).toBe('shuttle-space');
    expect(kindIcon({ ...base, titleShip: { name: 'Polaris' } })).toBe('shuttle-space');
    expect(kindIcon({ ...base, isReward: true })).toBe('award');
    // The primary kind wins: a game package with a ship, a ship with the game in it.
    const ship = { ships: [{ name: 'Nomad' }], hasGameAccess: true };
    expect(kindIcon({ ...base, ...ship, isGamePackage: true })).toBe('lock-open');
    expect(kindIcon({ ...base, ...ship, isReward: true })).toBe('shuttle-space');
    expect(kindIcon({ ...base, hasGameAccess: true })).toBe('lock-open');
    expect(kindIcon(base)).toBeUndefined();
  });
});
