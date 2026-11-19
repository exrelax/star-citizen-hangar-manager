import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import type { Ship } from '@/ships/ships';
import { coverageCard } from './coverage-card';
import type { CoverageMatch } from './coverage';

const ships: Ship[] = [
  { id: 1, name: 'Aurora MR', msrp: 25, image: 'aurora.jpg' },
  { id: 3, name: 'Avenger Titan', msrp: 55, image: 'titan.jpg' },
];
const match = (source: 'hangar' | 'buyback', kind: 'ship' | 'ccu'): CoverageMatch => ({
  source,
  kind,
  id: 7,
  title: 'Pledge',
});

describe('coverageCard (#426)', () => {
  it('shows a hangar CCU with both ships, its value, discount and giftable', () => {
    const pledge = {
      title: 'Upgrade - Aurora MR to Avenger Titan Standard Edition',
      upgrade: {
        matchItems: [{ id: 1, name: 'Aurora MR' }],
        targetItems: [{ id: 2, name: 'Avenger Titan' }],
        type: 'R',
      },
      items: [],
      valueUsd: 20,
      discount: { original: 30, paid: 20, amount: 10, percent: 33.33, ships: [] },
      isGiftable: true,
    } as unknown as PledgeView;
    expect(coverageCard(match('hangar', 'ccu'), { source: 'hangar', pledge }, ships)).toEqual({
      from: { name: 'Aurora MR', image: 'aurora.jpg', price: 25 },
      to: { name: 'Avenger Titan', image: 'titan.jpg', price: 55 },
      ships: [],
      value: 20,
      discount: { amount: 10, percent: 33.33 },
      giftable: true,
    });
  });

  it('shows a hangar ship pledge with its ship once', () => {
    const pledge = {
      title: 'Package',
      items: [
        { title: 'Avenger Titan', kind: 'Ship' },
        { title: 'Avenger Titan', kind: 'Ship' },
        { title: 'Poster', kind: 'Hangar decoration' },
      ],
      valueUsd: 60,
      isGiftable: false,
    } as unknown as PledgeView;
    const card = coverageCard(match('hangar', 'ship'), { source: 'hangar', pledge }, ships);
    expect(card.ships).toEqual([{ name: 'Avenger Titan', image: 'titan.jpg', price: 55 }]);
    expect(card).toMatchObject({ value: 60, giftable: false });
    expect(card.discount).toBeUndefined();
  });

  it('works out the discount of a buy back CCU from its buy back price', () => {
    const pledge = {
      title: 'Upgrade - Aurora to Titan',
      upgrade: { fromShipId: 1, toShipId: 3, toSkuId: 1 },
      price: { amount: 35, source: 'store' },
      isProbablyGiftable: false,
    } as unknown as BuybackView;
    expect(coverageCard(match('buyback', 'ccu'), { source: 'buyback', pledge }, ships)).toEqual({
      from: { name: 'Aurora MR', image: 'aurora.jpg', price: 25 },
      to: { name: 'Avenger Titan', image: 'titan.jpg', price: 55 },
      ships: [],
      value: 35,
      // $30 of ships for $35: a surcharge.
      discount: { amount: -5, percent: -16.67 },
      giftable: false,
    });
  });

  it('compares a standalone buy back ship with its price, and knows unknown ships by name', () => {
    const standalone = {
      title: 'Avenger Titan',
      ships: [{ name: 'Avenger Titan' }],
      isStandaloneShip: true,
      price: { amount: 50, source: 'ships' },
      isProbablyGiftable: true,
    } as unknown as BuybackView;
    expect(
      coverageCard(match('buyback', 'ship'), { source: 'buyback', pledge: standalone }, ships),
    ).toMatchObject({ value: 50, discount: { amount: 5, percent: 9.09 }, giftable: true });

    const unknown = {
      title: 'Hull X',
      ships: [{ name: 'Hull X' }],
      isStandaloneShip: true,
      isProbablyGiftable: false,
    } as unknown as BuybackView;
    const card = coverageCard(
      match('buyback', 'ship'),
      { source: 'buyback', pledge: unknown },
      ships,
    );
    expect(card.ships).toEqual([{ name: 'Hull X' }]);
    expect(card.value).toBeUndefined();
  });
});
