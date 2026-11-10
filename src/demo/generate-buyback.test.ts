import { describe, expect, it } from 'vitest';
import { DEMO } from '@/config';
import { BUYBACK_FILTER_PREDICATES } from '@/buyback/buyback-view';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { generateBuyback } from './generate-buyback';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('generateBuyback (#177)', () => {
  it('is the same for a key, newest melted first, with made-up ids', () => {
    const first = generateBuyback(FALLBACK_CATALOG, 'key-a', TODAY);
    expect(generateBuyback(FALLBACK_CATALOG, 'key-a', TODAY)).toEqual(first);
    const dates = first.pledges.map((pledge) => pledge.reclaimedAt!);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const pledge of first.pledges) expect(pledge.id).toBeLessThan(DEMO.idBase - 100_000);
    expect(first.tokens).toBeGreaterThanOrEqual(0);
    expect(first.tokens).toBeLessThanOrEqual(2);
  });
});

describe.each(['key-a', 'key-b', 'key-c'])('the generated buy back of %s', (key) => {
  const { buyback } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);

  it('has no rewards that can’t be melted', () => {
    expect(buyback.some((pledge) => /referral/i.test(pledge.title))).toBe(false);
  });

  it('has pledges of each kind', () => {
    for (const filter of ['ships', 'ccus', 'paints', 'gameAccess', 'lti', 'rewards'] as const) {
      expect(buyback.some(BUYBACK_FILTER_PREDICATES[filter])).toBe(true);
    }
  });

  it('has prices of every source, and a pledge without one (#185)', () => {
    const sources = new Set(buyback.map((pledge) => pledge.price?.source ?? 'none'));
    expect([...sources].sort()).toEqual(['none', 'rsi', 'ships', 'store']);
  });

  it('has orders paid with money, and shows only made-up ids', () => {
    expect(buyback.some((pledge) => pledge.order)).toBe(true);
    for (const pledge of buyback) {
      expect(pledge.displayId).toMatch(/[A-Z]/);
      expect(pledge.searchText).not.toContain(String(pledge.id));
      if (pledge.order) expect(pledge.order.id).not.toMatch(/^DEMO/);
    }
  });
});

describe.each(['key-a', 'key-b'])(
  '"probably giftable" in the generated buy back of %s (#205)',
  (key) => {
    const { buyback, generatedBuyback } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);
    const { orders, pledgeOrders } = generatedBuyback.orders;
    const giftable = (id: number) => buyback.find((pledge) => pledge.id === id)!.isProbablyGiftable;
    const cases = generatedBuyback.pledges.filter(
      (pledge) =>
        !pledge.isUpgrade && !/^(IAE|Luminalia) /.test(pledge.title) && pledge.price !== null,
    );
    const [money, back, credit, mixed, late, unknown, yes, no, sameA, sameB] = cases.map(
      (pledge) => pledge.id,
    ) as number[];

    it('marks money only before the cutoff, also a buy back paid with money', () => {
      expect(giftable(money!)).toBe(true);
      expect(pledgeOrders[back!]!.buyback).toBe(true);
      expect(giftable(back!)).toBe(true);
    });

    it('doesn’t mark store credit, money and store credit, a late order or no order', () => {
      expect(giftable(credit!)).toBe(false);
      expect(giftable(mixed!)).toBe(false);
      expect(orders[pledgeOrders[late!]!.orderId]!.placedAt! >= '2026-10-30').toBe(true);
      expect(giftable(late!)).toBe(false);
      expect(pledgeOrders[unknown!]).toBeUndefined();
      expect(giftable(unknown!)).toBe(false);
    });

    it('follows the remembered gift flag over the order', () => {
      expect(giftable(yes!)).toBe(true);
      expect(giftable(no!)).toBe(false);
    });

    it('answers the same for two pledges of one order', () => {
      expect(pledgeOrders[sameA!]!.orderId).toBe(pledgeOrders[sameB!]!.orderId);
      expect(giftable(sameA!)).toBe(giftable(sameB!));
      expect(giftable(sameA!)).toBe(true);
    });
  },
);

describe.each(['key-a', 'key-b'])(
  'CCUs RSI can’t sell again in the buy back of %s (#208)',
  (key) => {
    const { buyback } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);
    const unavailable = buyback.filter((pledge) => pledge.unavailable);

    it('has one whose base ship costs more and one where both cost the same', () => {
      expect(
        unavailable.some((pledge) => pledge.unavailable!.from.msrp > pledge.unavailable!.to.msrp),
      ).toBe(true);
      expect(
        unavailable.some((pledge) => pledge.unavailable!.from.msrp === pledge.unavailable!.to.msrp),
      ).toBe(true);
    });

    it('keeps them apart in the filter "Available", next to CCUs that can be bought back', () => {
      const available = buyback.filter(BUYBACK_FILTER_PREDICATES.available);
      expect(available.some((pledge) => pledge.isCcu)).toBe(true);
      expect(available).not.toEqual(expect.arrayContaining(unavailable));
      for (const pledge of unavailable) expect(pledge.isProbablyGiftable).toBe(false);
    });
  },
);
