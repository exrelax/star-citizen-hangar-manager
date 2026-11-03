import { describe, expect, it } from 'vitest';
import { pledgeKind } from './pledge-kind';
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
