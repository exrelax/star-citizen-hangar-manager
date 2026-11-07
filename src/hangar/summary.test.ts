import { describe, expect, it } from 'vitest';
import type { PledgeView } from './pledge-view';
import { summarize } from './summary';

const pledge = (overrides: Partial<PledgeView>) =>
  ({
    id: 1,
    valueUsd: 0,
    items: [],
    isCcu: false,
    isPaint: false,
    hasGameAccess: false,
    ...overrides,
  }) as PledgeView;

const discount = (amount: number) => ({ original: 0, paid: 0, amount, percent: 0, ships: [] });

describe('summarize', () => {
  it('sums values and only real discounts, and counts per type', () => {
    const summary = summarize([
      pledge({ id: 1, valueUsd: 15, isCcu: true, discount: discount(25) }),
      pledge({ id: 2, valueUsd: 7.5, isPaint: true }),
      // Cost more than the original price: doesn't reduce the discounts.
      pledge({
        id: 3,
        valueUsd: 120.1,
        items: [{ title: 'Nomad', kind: 'Ship' }],
        discount: discount(-5),
      }),
    ]);
    expect(summary).toEqual({
      count: 3,
      value: 142.6,
      discount: 25,
      types: [
        { type: 'ships', count: 1 },
        { type: 'ccus', count: 1 },
        { type: 'paints', count: 1 },
      ],
    });
  });

  it('is empty without pledges', () => {
    expect(summarize([])).toEqual({ count: 0, value: 0, discount: 0, types: [] });
  });
});
