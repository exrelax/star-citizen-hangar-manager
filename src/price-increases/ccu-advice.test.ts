import { describe, expect, it } from 'vitest';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView, type PledgeView } from '@/hangar/pledge-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import type { Ship, ShipSku, WarbondSku } from '@/ships/ships';
import { ccuAdvice } from './ccu-advice';
import { createPriceIncreaseMatcher } from './price-increase-match';
import type { ExpectedPriceIncrease } from './price-increases';

const NOW = Date.parse('2026-11-10T12:00:00Z');

/** The example of #248: the Prospector rises from $155 to $175. */
const prospector: ExpectedPriceIncrease = {
  ship: { id: 1, name: 'Prospector' },
  priceIncreaseAt: { at: Date.parse('2026-11-19T16:00:00Z') },
  price: { from: 155, to: 175 },
};

const ships: Ship[] = [
  { id: 1, name: 'Prospector', msrp: 155 },
  { id: 2, name: 'Vulture', msrp: 175 },
  { id: 3, name: 'Freelancer MAX', msrp: 170 },
  { id: 4, name: 'Cutlass Black', msrp: 135 },
  { id: 5, name: 'Sabre', msrp: 170 },
  { id: 6, name: 'Arrow', msrp: 75 },
];
const buyable: ShipSku[] = [
  { shipId: 2, skuId: 20, title: 'Standard Edition', price: 175 },
  { shipId: 5, skuId: 50, title: 'Standard Edition', price: 170 },
];
const priceOf = createPriceLookup(ships.map(({ name, msrp }) => ({ name, price: msrp })));
const matcher = createPriceIncreaseMatcher([prospector], NOW);

let nextId = 1;
const ccu = (from: string, to: string, valueUsd: number, isGiftable = false): PledgeView => {
  const pledge: Pledge = {
    id: nextId++,
    name: `Upgrade - ${from} to ${to}`,
    title: `Upgrade - ${from} to ${to}`,
    value: `$${valueUsd}.00 USD`,
    valueUsd,
    configurationValue: '',
    currency: 'Store Credit',
    availability: 'Attributed',
    contains: '',
    isLastAlpha: false,
    isBuybackable: true,
    isGiftable,
    isExchangeable: true,
    isUpgradeable: false,
    isUpgraded: false,
    upgrade: {
      matchItems: [{ id: 1, name: from }],
      targetItems: [{ id: 2, name: to }],
      type: 'R',
    },
    nameReservations: null,
    nameableShips: null,
    items: [{ title: `Upgrade - ${from} to ${to}` }],
  };
  const change = matcher.hangarCcu(pledge, priceOf);
  return { ...toPledgeView(pledge), ...(change && { ccuPriceChange: change }) };
};

const eight = Array.from({ length: 8 }, () => ccu('Prospector', 'Vulture', 5));

describe('ccuAdvice (#252)', () => {
  it('suggests CCUs from another base ship for the melt value, as in the example', () => {
    const [group] = ccuAdvice({ pledges: eight, ships, buyable, warbonds: [], storeCredit: 0 });
    expect(group?.target.name).toBe('Vulture');
    expect(group?.increase).toBe(prospector);
    expect(group?.ccus).toHaveLength(8);
    expect(group?.meltValue).toBe(40);
    expect(group?.keep).toEqual({
      upgradeValueNow: 160,
      upgradeValueAfter: 0,
      discountNow: 120,
      discountAfter: -40,
    });
    expect(group?.options).toEqual([
      {
        kind: 'standard',
        base: ships[2],
        price: 5,
        upgradeValue: 5,
        discount: 0,
        total: 40,
        storeCreditNeeded: 0,
        enoughStoreCredit: true,
        gain: 40,
      },
    ]);
  });

  it('takes the cheapest CCU when every one costs more than the melt value', () => {
    const cheap = Array.from({ length: 2 }, () => ccu('Prospector', 'Vulture', 2));
    const [group] = ccuAdvice({ pledges: cheap, ships, buyable, warbonds: [], storeCredit: 4 });
    expect(group?.options[0]).toMatchObject({
      base: { name: 'Freelancer MAX' },
      price: 5,
      total: 10,
      storeCreditNeeded: 6,
      enoughStoreCredit: false,
    });
  });

  it('offers a warbond CCU, paid with money, with its discount', () => {
    const warbonds: WarbondSku[] = [{ shipId: 2, skuId: 21, price: 160 }];
    const [group] = ccuAdvice({
      pledges: eight,
      ships,
      buyable: [...buyable, { shipId: 2, skuId: 21, title: 'Warbond Edition', price: 160 }],
      warbonds,
    });
    const warbond = group?.options.find((option) => option.kind === 'warbond');
    // From the Cutlass Black ($135): $25 for an upgrade value of $40.
    expect(warbond).toEqual({
      kind: 'warbond',
      base: ships[3],
      price: 25,
      upgradeValue: 40,
      discount: 15,
      total: 200,
      gain: 160,
    });
    expect(warbond?.storeCreditNeeded).toBeUndefined();
  });

  it('leaves out base ships about to rise and targets RSI doesn’t sell', () => {
    const rising = new Set([3]);
    const [group] = ccuAdvice({
      pledges: eight,
      ships,
      buyable,
      warbonds: [],
      risingShipIds: rising,
    });
    // Without the Freelancer MAX the Sabre ($170) is next.
    expect(group?.options[0]?.base.name).toBe('Sabre');
    const [notSold] = ccuAdvice({ pledges: eight, ships, buyable: [], warbonds: [] });
    expect(notSold?.options).toEqual([]);
  });

  it('counts the giftable CCUs and ignores CCUs that don’t lose value', () => {
    const pledges = [
      ccu('Prospector', 'Vulture', 5, true),
      ccu('Prospector', 'Vulture', 5),
      ccu('Cutlass Black', 'Prospector', 15),
      ccu('Arrow', 'Sabre', 90),
    ];
    const groups = ccuAdvice({ pledges, ships, buyable, warbonds: [] });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.giftable).toBe(1);
  });

  it('groups by target ship', () => {
    const pledges = [...eight, ccu('Prospector', 'Sabre', 5)];
    const groups = ccuAdvice({ pledges, ships, buyable, warbonds: [] });
    expect(groups.map((group) => [group.target.name, group.ccus.length])).toEqual([
      ['Sabre', 1],
      ['Vulture', 8],
    ]);
  });
});
