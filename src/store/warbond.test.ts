import { describe, expect, it } from 'vitest';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView } from '@/hangar/pledge-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import {
  buildWarbondOffers,
  cheapestBases,
  ownedCcusInRange,
  type StoreShip,
  type WarbondTarget,
} from './warbond';

const ship = (id: number, name: string, msrp: number): StoreShip => ({ id, name, msrp });

const SHIPS = [
  ship(1, 'Aurora Mk I ES', 20),
  ship(2, 'Gladiator', 165),
  ship(3, 'Prospector', 155),
  ship(4, 'Cutlass Black', 155),
  ship(5, 'Freelancer', 110),
  ship(6, 'Vulture', 175),
  ship(7, 'Vanguard Warden', 260),
  ship(8, 'Eclipse', 300),
];

const vulture: WarbondTarget = { ship: SHIPS[5]!, skuId: 16688, price: 165 };

/** A CCU of the hangar, as the sync stores it. */
const ccu = (id: number, from: string, to: string, valueUsd: number) =>
  toPledgeView({
    id,
    name: `Upgrade - ${from} to ${to}`,
    title: `Upgrade - ${from} to ${to}`,
    value: `${valueUsd} USD`,
    valueUsd,
    items: [],
    isUpgraded: false,
    upgrade: { matchItems: [{ id: 1, name: from }], targetItems: [{ id: 2, name: to }], type: 'R' },
  } as unknown as Pledge);

describe('cheapestBases', () => {
  it('groups the ships below the warbond price by price, the cheapest CCU first', () => {
    expect(cheapestBases(SHIPS, vulture, 2)).toEqual([
      // The Gladiator costs exactly the warbond price: RSI offers no CCU from it.
      { ccuPrice: 10, msrp: 155, ships: [SHIPS[3], SHIPS[2]] },
      { ccuPrice: 55, msrp: 110, ships: [SHIPS[4]] },
    ]);
  });

  it('is empty if no ship is cheaper than the warbond', () => {
    expect(cheapestBases([SHIPS[1]!, SHIPS[5]!], vulture)).toEqual([]);
  });
});

describe('ownedCcusInRange', () => {
  const priceOf = createPriceLookup(SHIPS.map(({ name, msrp }) => ({ name, price: msrp })));

  it('finds the CCUs overlapping the range and groups equal ones', () => {
    const pledges = [
      ccu(10, 'Prospector', 'Gladiator', 10),
      ccu(11, 'Freelancer', 'Prospector', 40),
      ccu(12, 'Prospector', 'Gladiator', 10),
      // Ends where the range starts, and starts where it ends: no overlap.
      ccu(13, 'Aurora Mk I ES', 'Freelancer', 80),
      ccu(14, 'Vulture', 'Vanguard Warden', 85),
    ];
    const owned = ownedCcusInRange(pledges, priceOf, { low: 110, high: 175 });
    expect(owned.map((entry) => [entry.from.name, entry.to.name, entry.ids])).toEqual([
      ['Freelancer', 'Prospector', [11]],
      ['Prospector', 'Gladiator', [10, 12]],
    ]);
  });

  it('leaves out CCUs whose ships have no known price', () => {
    const owned = ownedCcusInRange([ccu(1, 'Unknown', 'Gladiator', 5)], priceOf, {
      low: 0,
      high: 999,
    });
    expect(owned).toEqual([]);
  });
});

describe('buildWarbondOffers', () => {
  it('computes the discount, the cheapest CCUs and the CCUs in their range', () => {
    const eclipse: WarbondTarget = { ship: SHIPS[7]!, skuId: 19395, price: 270 };
    const offers = buildWarbondOffers({ ships: SHIPS, warbonds: [vulture, eclipse] }, [
      ccu(20, 'Vanguard Warden', 'Eclipse', 30),
    ]);

    // The biggest discount first.
    expect(offers.map((offer) => offer.target.ship.name)).toEqual(['Eclipse', 'Vulture']);
    const [first, second] = offers;
    expect(first).toMatchObject({ discount: 30, percent: 10 });
    expect(first!.bases.map((level) => level.ccuPrice)).toEqual([10, 95, 105]);
    expect(first!.range).toEqual({ low: 165, high: 300 });
    expect(first!.owned.map((entry) => entry.ids)).toEqual([[20]]);
    expect(second!.owned).toEqual([]);
  });
});
