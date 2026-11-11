import { describe, expect, it } from 'vitest';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView, type PledgeView } from '@/hangar/pledge-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import type { Ship, ShipSku } from '@/ships/ships';
import { ccuAdvice, type CcuAdviceInput } from './ccu-advice';
import { createPriceIncreaseMatcher } from './price-increase-match';
import type { ExpectedPriceIncrease } from './price-increases';

const NOW = Date.parse('2026-11-10T12:00:00Z');

/** The example of #248: the Prospector rises from $155 to $175. */
const prospector: ExpectedPriceIncrease = {
  ship: { id: 1, name: 'Prospector' },
  priceIncreaseAt: { at: Date.parse('2026-11-19T16:00:00Z') },
  price: { from: 155, to: 175 },
};
/** Becomes flight ready: rises by an unknown amount. */
const liberator: ExpectedPriceIncrease = {
  ship: { id: 8, name: 'Liberator' },
  priceIncreaseAt: { at: Date.parse('2026-11-15T16:00:00Z') },
};

const ships: Ship[] = [
  { id: 1, name: 'Prospector', msrp: 155 },
  { id: 2, name: 'Vulture', msrp: 175 },
  { id: 3, name: 'Freelancer MAX', msrp: 150 },
  { id: 4, name: 'Cutlass Black', msrp: 135 },
  { id: 5, name: 'Sabre', msrp: 170 },
  { id: 6, name: 'F7C-M Super Hornet Mk I', msrp: 180 },
  { id: 7, name: 'Merchantman', msrp: 650 },
  { id: 8, name: 'Liberator', msrp: 575 },
  { id: 9, name: 'Polaris', msrp: 750 },
];
const buyable: ShipSku[] = [{ shipId: 1, skuId: 10, title: 'Standard Edition', price: 155 }];
const priceOf = createPriceLookup(ships.map(({ name, msrp }) => ({ name, price: msrp })));
const matcher = createPriceIncreaseMatcher([prospector, liberator], NOW);

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

const advice = (pledges: PledgeView[], extra: Partial<CcuAdviceInput> = {}) =>
  ccuAdvice({ pledges, ships, buyable, warbonds: [], storeCredit: 0, ...extra });
const eight = Array.from({ length: 8 }, () => ccu('Prospector', 'Vulture', 5, true));

describe('ccuAdvice (#252)', () => {
  it('recommends CCUs to the rising ship for the melt value, as in the example', () => {
    const [group] = advice(eight);
    expect(group?.base?.name).toBe('Prospector');
    expect(group?.target.name).toBe('Vulture');
    expect(group?.meltValue).toBe(40);
    expect(group?.giftable).toBe(8);
    expect(group?.keep).toEqual({
      upgradeValueNow: 160,
      upgradeValueAfter: 0,
      discountNow: 120,
      discountAfter: -40,
    });
    // 8 × Freelancer MAX → Prospector for $5: $25 upgrade value, $20 discount each after.
    expect(group?.switch).toEqual({
      from: ships[2],
      to: ships[0],
      price: 5,
      total: 40,
      upgradeValueAfter: 25,
      discountAfter: 20,
      storeCreditNeeded: 0,
      enoughStoreCredit: true,
      gain: 200,
    });
  });

  it('also recommends it where the old CCUs keep some value, if the new ones have more discount', () => {
    // $25 upgrade value for $3: $22 discount today, $5 upgrade value and $2 discount after.
    const hornets = Array.from({ length: 5 }, () =>
      ccu('Prospector', 'F7C-M Super Hornet Mk I', 3),
    );
    const [group] = advice(hornets);
    expect(group?.keep?.discountAfter).toBe(10);
    // Every CCU to the Prospector costs more than $3: the cheapest one, $5 from the Freelancer MAX.
    expect(group?.switch).toMatchObject({
      from: { name: 'Freelancer MAX' },
      price: 5,
      total: 25,
      storeCreditNeeded: 10,
      enoughStoreCredit: false,
      gain: 90,
    });
  });

  it('keeps the CCUs when they still have more discount after the increase', () => {
    // A $1 Prospector → Polaris CCU keeps a huge discount.
    const [group] = advice([ccu('Prospector', 'Polaris', 1)]);
    expect(group?.switch).toBeUndefined();
    expect(group?.noSwitch).toBe('keepIsBetter');
  });

  it('recommends nothing while RSI sells no CCU to the rising ship', () => {
    const [group] = advice(eight, { buyable: [] });
    expect(group?.switch).toBeUndefined();
    expect(group?.noSwitch).toBe('notSold');
  });

  it('leaves out base ships about to rise themselves', () => {
    const [group] = advice(eight, { risingShipIds: new Set([3]) });
    expect(group?.switch?.from.name).toBe('Cutlass Black');
  });

  it('only informs and warns without the new price', () => {
    const [group] = advice([ccu('Liberator', 'Merchantman', 50)], {
      inConceptShipIds: new Set([7, 8]),
    });
    expect(group?.increase).toBe(liberator);
    expect(group?.keep).toBeUndefined();
    expect(group?.switch).toBeUndefined();
    expect(group?.noSwitch).toBeUndefined();
    // $75 upgrade value for $50 today: a discount that may be lost.
    expect(group?.discountNow).toBe(25);
    expect(group?.targetInConcept).toBe(true);
  });

  it('ignores CCUs that don’t lose value and groups by target', () => {
    const pledges = [
      ...eight,
      ccu('Cutlass Black', 'Prospector', 15),
      ccu('Arrow', 'Sabre', 90),
      ccu('Prospector', 'Sabre', 5),
    ];
    expect(advice(pledges).map((group) => [group.target.name, group.ccus.length])).toEqual([
      ['Sabre', 1],
      ['Vulture', 8],
    ]);
  });
});
