import { describe, expect, it } from 'vitest';
import { exchangeWarnings } from './exchange';
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

describe('exchangeWarnings', () => {
  it('has none for a plain pledge', () => {
    expect(exchangeWarnings(pledge(), '2026-11-03')).toEqual([]);
  });

  it('lists the losses, most severe first', () => {
    const discount = { original: 300, paid: 250, amount: 50, percent: 16.7, ships: [] };
    const warnings = exchangeWarnings(
      pledge({
        isLastAlpha: true,
        isBuybackable: false,
        isUpgraded: true,
        discount,
        isGiftable: true,
        order: { id: 'X', amount: '$250.00 USD', placedAt: '2026-10-30' } as PledgeView['order'],
      }),
      '2026-11-03',
    );
    expect(warnings.map((warning) => warning.kind)).toEqual([
      'lastGameAccess',
      'notBuybackable',
      'upgraded',
      'discount',
      'giftable',
      'refundable',
    ]);
    expect(warnings.filter((warning) => warning.danger)).toHaveLength(4);
  });

  it('ignores surcharges and refund periods that are over', () => {
    const surcharge = { original: 200, paid: 250, amount: -50, percent: -25, ships: [] };
    const old = { id: 'X', amount: '$1', placedAt: '2026-01-01' } as PledgeView['order'];
    expect(exchangeWarnings(pledge({ discount: surcharge, order: old }), '2026-11-03')).toEqual([]);
  });
});
