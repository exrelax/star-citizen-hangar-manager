import { describe, expect, it } from 'vitest';
import type { CcuAdviceGroup } from '@/price-increases/ccu-advice';
import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import { discountAtRisk } from './discount-at-risk';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const increase = (id: number, inDays: number, confirmed = false): ExpectedPriceIncrease =>
  ({
    ship: { id, name: `Ship ${id}` },
    priceIncreaseAt: { at: NOW + inDays * DAY },
    ...(confirmed && { confirmed: true }),
  }) as ExpectedPriceIncrease;
const group = (
  id: number,
  inDays: number,
  ccus: number,
  keep?: { now: number; after: number },
  confirmed = false,
): CcuAdviceGroup =>
  ({
    increase: increase(id, inDays, confirmed),
    target: { id: id + 100, name: `Target ${id}`, msrp: 500 },
    ccus: Array.from({ length: ccus }, (_, index) => ({ id: id * 10 + index })),
    meltValue: 5 * ccus,
    giftable: 0,
    targetInConcept: false,
    ...(keep && {
      keep: {
        upgradeValueNow: 0,
        upgradeValueAfter: 0,
        discountNow: keep.now,
        discountAfter: keep.after,
      },
    }),
  }) as CcuAdviceGroup;

describe('discountAtRisk (#455)', () => {
  it('lists the pairs within the period, confirmed apart, the most lost first', () => {
    const result = discountAtRisk(
      [
        group(1, 3, 2, { now: 30, after: 10 }),
        group(2, 5, 8, { now: 120, after: -40 }),
        // Without the new price: the loss isn't known, it comes last.
        group(3, 1, 1),
        group(4, 2, 3, { now: 50, after: 20 }, true),
        // After the period of 14 days, and over already.
        group(5, 20, 4, { now: 90, after: 0 }),
        group(6, -2, 4, { now: 90, after: 0 }),
      ],
      NOW,
      14,
    );
    expect(result.expected.map((row) => [row.group.increase.ship.id, row.loss])).toEqual([
      [2, 160],
      [1, 20],
      [3, undefined],
    ]);
    expect(result.confirmed.map((row) => [row.group.increase.ship.id, row.loss])).toEqual([
      [4, 30],
    ]);
    expect(result.count).toBe(2 + 8 + 1 + 3);
  });

  it('has nothing without groups', () => {
    expect(discountAtRisk([], NOW, 14)).toEqual({ confirmed: [], expected: [], count: 0 });
  });
});
