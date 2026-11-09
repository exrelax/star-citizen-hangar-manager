import { describe, expect, it } from 'vitest';
import { planPaintRebuy, type PaintPledge } from './calculation';
import type { StoreItem } from '../items/store-items';
import { cartCardsOf, waysOf } from './ways';

let nextId = 1;
const storeItem = (name: string, price: number): StoreItem => ({
  id: nextId++,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
});
const paintPledge = (name: string, valueUsd: number): PaintPledge => ({
  id: nextId++,
  title: `Paints - ${name}`,
  valueUsd,
  isMeltable: true,
  isGiftable: false,
  items: [{ title: name, kind: 'Skin' }],
});

/** The layout's example: $22 + $5 + $5 own paints without discount, filler paints at $3. */
function example(storeCredit: number) {
  const storeItems = [
    storeItem('Polaris - Quasar Paint', 22),
    storeItem('Lynx - Moonrise Paint', 5),
    storeItem('C8 Pisces - Code Blue Paint', 5),
    storeItem('Cheap A Paint', 3),
    storeItem('Cheap B Paint', 3),
  ];
  const pledges = [
    paintPledge('Polaris - Quasar Paint', 22),
    paintPledge('Lynx - Moonrise Paint', 5),
    paintPledge('C8 Pisces - Code Blue Paint', 5),
  ];
  const { plan, buyFirst } = planPaintRebuy({
    pledges,
    storeItems,
    storeCredit,
    useFillers: true,
    skipGiftable: false,
  });
  return waysOf(plan!, buyFirst, storeCredit);
}

const balances = (steps: { kind: string; balance: number }[]) =>
  steps.map((step) => [step.kind, step.balance]);

describe('waysOf', () => {
  it('gives both ways the same cart when the store credit pays it', () => {
    const ways = example(40);
    expect(ways.comparison).toBe('same');
    expect(ways.buy.upfront).toBe(34.45);
    expect(ways.melt.upfront).toBe(2.45);
    expect(balances(ways.buy.steps)).toEqual([
      ['cart', 40],
      ['pay', 5.55],
      ['melt', 37.55],
      ['fillers', 51.2],
    ]);
    // Both end with the store credit freed: $11.20.
    expect(balances(ways.melt.steps)).toEqual([
      ['cart', 40],
      ['melt', 72],
      ['pay', 37.55],
      ['fillers', 51.2],
    ]);
    expect(ways.melt.fillerMelt).toBe(13.65);
  });

  it('buys first at a lower tier with less store credit', () => {
    const ways = example(30);
    expect(ways.comparison).toBe('lowerTier');
    expect(ways.buy.plan!.tier.percent).toBe(25);
    expect(balances(ways.buy.steps)).toEqual([
      ['cart', 30],
      ['pay', 1.5],
      ['melt', 33.5],
      ['fillers', 38],
    ]);
    expect(balances(ways.melt.steps).at(-1)).toEqual(['fillers', 41.2]);
  });

  it('blocks buying first when the store credit pays no cart', () => {
    const ways = example(5);
    expect(ways.comparison).toBe('impossible');
    expect(ways.buy.plan).toBeUndefined();
    expect(ways.buy.missing).toBe(29.45);
    const [cart, pay, melt, fillers] = ways.buy.steps;
    expect(cart!.balance).toBe(5);
    expect(pay).toMatchObject({ kind: 'pay', blocked: true, amount: -34.45 });
    expect(melt).toMatchObject({ faded: true });
    expect(fillers).toMatchObject({ faded: true });
    expect(balances(ways.melt.steps)).toEqual([
      ['cart', 5],
      ['melt', 37],
      ['pay', 2.55],
      ['fillers', 16.2],
    ]);
  });
});

describe('cartCardsOf', () => {
  it('shows one cart when both ways buy the same', () => {
    const cards = cartCardsOf(example(40));
    expect(cards).toHaveLength(10);
    expect(cards.filter((card) => !card.filler)).toHaveLength(3);
    expect(cards[0]!.prices).toEqual({ melt: { price: 22, inCart: 14.3 } });
  });

  it('shows the paints of both carts with their prices in each', () => {
    const cards = cartCardsOf(example(30));
    expect(cards).toHaveLength(10);
    expect(cards[0]!.prices).toEqual({
      buy: { price: 22, inCart: 16.5 },
      melt: { price: 22, inCart: 14.3 },
    });
    // 2 fillers in the cart of buying first, 7 in the other.
    const fillers = cards.filter((card) => card.filler);
    expect(fillers.filter((card) => card.prices.buy)).toHaveLength(2);
    expect(fillers.filter((card) => card.prices.melt)).toHaveLength(7);
  });
});
