import { describe, expect, it } from 'vitest';
import { futureDiscount } from './future-discount';
import type { ExpectedPriceIncrease } from './price-increases';

const prospector: ExpectedPriceIncrease = {
  ship: { id: 109, name: 'Prospector' },
  priceIncreaseAt: { at: 2000 },
  price: { from: 155, to: 175 },
};
const fortune: ExpectedPriceIncrease = {
  ship: { id: 200, name: 'Fortune' },
  priceIncreaseAt: { at: 1000 },
  price: { from: 175, to: 190 },
};
const shipDiscount = {
  original: 155,
  paid: 140,
  amount: 15,
  percent: 9.68,
  ships: [{ name: 'Prospector', price: 155 }],
};

describe('futureDiscount (#274)', () => {
  it('grows the original price of a rising ship by the increase', () => {
    expect(
      futureDiscount({
        valueUsd: 140,
        discount: shipDiscount,
        priceIncrease: { increase: prospector, reason: 'ship' },
      }),
    ).toMatchObject({ original: 175, amount: 35, increase: prospector });
  });

  it('takes the upgrade value of a CCU after the increase, also a loss', () => {
    const loses = futureDiscount({
      valueUsd: 15,
      ccuPriceChange: {
        base: prospector,
        direction: 'loses',
        amounts: { before: 20, after: 0, change: -20 },
      },
    });
    expect(loses).toMatchObject({ original: 0, amount: -15, increase: prospector });
    expect(loses).not.toHaveProperty('percent');
    // Both ships rise: the next increase.
    const both = futureDiscount({
      valueUsd: 15,
      ccuPriceChange: {
        base: prospector,
        target: fortune,
        direction: 'loses',
        amounts: { before: 20, after: 15, change: -5 },
      },
    });
    expect(both).toMatchObject({ amount: 0, percent: 0, increase: fortune });
  });

  it('knows nothing without the change in USD or for a free pledge', () => {
    const unknown = { ...prospector, price: undefined };
    expect(
      futureDiscount({
        valueUsd: 140,
        discount: shipDiscount,
        priceIncrease: { increase: unknown, reason: 'ship' },
      }),
    ).toBeUndefined();
    expect(
      futureDiscount({ valueUsd: 15, ccuPriceChange: { base: prospector, direction: 'loses' } }),
    ).toBeUndefined();
    expect(
      futureDiscount({ valueUsd: 0, priceIncrease: { increase: prospector, reason: 'ship' } }),
    ).toBeUndefined();
  });
});
