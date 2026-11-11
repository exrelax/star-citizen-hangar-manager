import { describe, expect, it } from 'vitest';
import { hasPriceChange, hasPriceChangeWithin } from './price-change-filter';
import type { ExpectedPriceIncrease } from './price-increases';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-10T12:00:00Z');

const increase = (inDays: number): ExpectedPriceIncrease => ({
  ship: { id: 109, name: 'Prospector' },
  priceIncreaseAt: { at: NOW + inDays * DAY },
  price: { from: 155, to: 175 },
});

describe('hasPriceChangeWithin (#256)', () => {
  it('matches the ship itself and a CCU to it', () => {
    expect(
      hasPriceChangeWithin({ priceIncrease: { increase: increase(9), reason: 'ship' } }, NOW, 14),
    ).toBe(true);
    expect(
      hasPriceChangeWithin({ priceIncrease: { increase: increase(9), reason: 'ccu' } }, NOW, 14),
    ).toBe(true);
  });

  it('matches a CCU whose base or target ship rises', () => {
    expect(
      hasPriceChangeWithin({ ccuPriceChange: { base: increase(9), direction: 'loses' } }, NOW, 14),
    ).toBe(true);
    expect(
      hasPriceChangeWithin(
        { ccuPriceChange: { target: increase(9), direction: 'gains' } },
        NOW,
        14,
      ),
    ).toBe(true);
  });

  it('only within the period, and not once the date has passed', () => {
    const later = { ccuPriceChange: { base: increase(20), direction: 'loses' as const } };
    expect(hasPriceChangeWithin(later, NOW, 14)).toBe(false);
    expect(hasPriceChangeWithin(later, NOW, 30)).toBe(true);
    const past = { priceIncrease: { increase: increase(-1), reason: 'ship' as const } };
    expect(hasPriceChangeWithin(past, NOW, 14)).toBe(false);
  });

  it('matches nothing without a price change', () => {
    expect(hasPriceChangeWithin({}, NOW, 14)).toBe(false);
    expect(hasPriceChange({})).toBe(false);
    expect(hasPriceChange({ ccuPriceChange: { base: increase(20), direction: 'loses' } })).toBe(
      true,
    );
  });
});
