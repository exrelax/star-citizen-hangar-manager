import { describe, expect, it } from 'vitest';
import { BUYBACK_FILTER_PREDICATES } from '@/buyback/buyback-view';
import { pledgesWithinDays } from '@/price-increases/price-increase-notes';
import { isWithinDays } from '@/price-increases/price-increases';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe.each(['key-a', 'key-b', 'key-c'])('the Buy Back Reminder of the demo %s (#194)', (key) => {
  const { pledges, buyback, priceIncreases } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);

  it('has every case of the data, with dates relative to now', () => {
    expect(
      priceIncreases.some((entry) => entry.flightReadyAt && entry.flightReadyAt.at > NOW),
    ).toBe(true);
    expect(priceIncreases.some((entry) => !entry.flightReadyAt)).toBe(true);
    expect(priceIncreases.some((entry) => entry.priceIncreaseAt.dayOnly)).toBe(true);
    expect(priceIncreases.some((entry) => !entry.priceIncreaseAt.dayOnly)).toBe(true);
    expect(priceIncreases.some((entry) => isWithinDays(entry, NOW, 14))).toBe(true);
    expect(priceIncreases.some((entry) => !isWithinDays(entry, NOW, 14))).toBe(true);
    expect(priceIncreases.some((entry) => entry.priceIncreaseAt.at - NOW < HOUR)).toBe(true);
  });

  it('labels a ship, a CCU and a module in the buy back, and items in My Hangar', () => {
    const labelled = buyback.filter((pledge) => pledge.priceIncrease);
    expect(labelled.some((pledge) => pledge.priceIncrease!.reason === 'ship')).toBe(true);
    expect(labelled.some((pledge) => pledge.priceIncrease!.reason === 'ccu')).toBe(true);
    expect(labelled.some((pledge) => pledge.priceIncrease!.reason === 'related')).toBe(true);
    expect(pledges.some((pledge) => pledge.priceIncrease)).toBe(true);
  });

  it('gives the filter and the sidebar notification pledges inside the period, not outside', () => {
    expect(buyback.some(BUYBACK_FILTER_PREDICATES.priceIncrease)).toBe(true);
    const inside = pledgesWithinDays(buyback, NOW, 14);
    const labelled = buyback.filter((pledge) => pledge.priceIncrease).map((pledge) => pledge.id);
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.length).toBeLessThan(new Set(labelled).size);
  });
});
