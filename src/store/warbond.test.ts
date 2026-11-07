import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView } from '@/hangar/pledge-view';
import {
  buildWarbondOffers,
  cheapestBases,
  createShipLookup,
  holdingsByShip,
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
  ship(7, 'Apollo Triage', 260),
  ship(8, 'Eclipse', 300),
  ship(9, 'Mercury', 260),
];

const vulture: WarbondTarget = { ship: SHIPS[5]!, skuId: 16688, price: 165 };
const eclipse: WarbondTarget = { ship: SHIPS[7]!, skuId: 19395, price: 270 };

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

/** A ship pledge of the hangar. */
const shipPledge = (id: number, name: string) =>
  toPledgeView({
    id,
    name: `Standalone Ships - ${name}`,
    title: `Standalone Ships - ${name}`,
    value: '$100.00 USD',
    valueUsd: 100,
    isUpgraded: false,
    items: [{ title: name, kind: 'Ship' }],
  } as unknown as Pledge);

const buybackPledge = (overrides: Partial<BuybackView>) =>
  ({ id: 1, title: '', ships: [], isCcu: false, ...overrides }) as BuybackView;

describe('cheapestBases', () => {
  it('lists the ships below the warbond price, the cheapest CCU first', () => {
    expect(cheapestBases(SHIPS, vulture, new Map(), 3).map((base) => base.ship.name)).toEqual([
      // The Gladiator costs exactly the warbond price: RSI offers no CCU from it.
      'Cutlass Black',
      'Prospector',
      'Freelancer',
    ]);
    expect(cheapestBases(SHIPS, vulture, new Map(), 3).map((base) => base.ccuPrice)).toEqual([
      10, 10, 55,
    ]);
  });

  it('is empty if no ship is cheaper than the warbond', () => {
    expect(cheapestBases([SHIPS[1]!, SHIPS[5]!], vulture)).toEqual([]);
  });
});

describe('holdingsByShip', () => {
  it('counts ships and CCU targets in the hangar and the buy back, matched by name or id', () => {
    const lookup = createShipLookup(SHIPS);
    const holdings = holdingsByShip(
      lookup,
      [
        shipPledge(1, 'Mercury Star Runner'),
        shipPledge(2, 'Prospector'),
        ccu(3, 'Freelancer', 'Mercury Star Runner', 20),
        ccu(4, 'Aurora Mk I ES', 'Prospector', 30),
      ],
      [
        buybackPledge({ id: 5, ships: [{ name: 'Mercury Star Runner' }] }),
        // A CCU with RSI's ids from its buy back button, and one known only by its title.
        buybackPledge({
          id: 6,
          isCcu: true,
          title: 'Upgrade - Freelancer to Mercury Star Runner',
          upgrade: { fromShipId: 5, toShipId: 9, toSkuId: 1 },
        }),
        buybackPledge({
          id: 7,
          isCcu: true,
          title: 'Upgrade - Aurora to Prospector Warbond Edition',
        }),
      ],
    );

    expect(holdings.get(9)).toEqual({
      hangarShips: 1,
      hangarCcus: 1,
      buybackShips: 1,
      buybackCcus: 1,
    });
    expect(holdings.get(3)).toEqual({
      hangarShips: 1,
      hangarCcus: 1,
      buybackShips: 0,
      buybackCcus: 1,
    });
    expect(holdings.has(1)).toBe(false);
  });
});

describe('ownedCcusInRange', () => {
  const { priceOf } = createShipLookup(SHIPS);

  it('finds the CCUs overlapping the range and groups those with the same value', () => {
    const pledges = [
      ccu(10, 'Prospector', 'Gladiator', 10),
      ccu(11, 'Freelancer', 'Prospector', 40),
      ccu(12, 'Prospector', 'Gladiator', 10),
      ccu(13, 'Prospector', 'Gladiator', 5),
      // Ends where the range starts, and starts where it ends: no overlap.
      ccu(14, 'Aurora Mk I ES', 'Freelancer', 80),
      ccu(15, 'Vulture', 'Apollo Triage', 85),
    ];
    const owned = ownedCcusInRange(pledges, priceOf, { low: 110, high: 175 });
    expect(owned.map((entry) => [entry.to.name, entry.valueUsd, entry.ids])).toEqual([
      ['Prospector', 40, [11]],
      ['Gladiator', 5, [13]],
      ['Gladiator', 10, [10, 12]],
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
  it('computes the discount, the cheapest CCUs and the CCUs colliding with the warbond', () => {
    const offers = buildWarbondOffers(
      { ships: SHIPS, warbonds: [vulture, eclipse] },
      [
        // Chainable: it ends at a ship the warbond CCU can start from.
        ccu(20, 'Freelancer', 'Apollo Triage', 30),
        // Colliding: it covers prices between the warbond price and the msrp.
        ccu(21, 'Mercury Star Runner', 'Eclipse', 15),
        shipPledge(22, 'Apollo Triage'),
      ],
      [],
    );

    // The biggest discount first.
    expect(offers.map((offer) => offer.target.ship.name)).toEqual(['Eclipse', 'Vulture']);
    const [first, second] = offers;
    expect(first).toMatchObject({ discount: 30, percent: 10 });
    expect(first!.bases.slice(0, 3).map((base) => [base.ship.name, base.ccuPrice])).toEqual([
      ['Apollo Triage', 10],
      ['Mercury', 10],
      ['Vulture', 95],
    ]);
    expect(first!.bases[0]!.holdings).toMatchObject({ hangarShips: 1, hangarCcus: 1 });
    expect(first!.owned.map((entry) => entry.ids)).toEqual([[21]]);
    // From $110 to $260, it overlaps the Vulture's span from $165 to $175.
    expect(second!.owned.map((entry) => entry.ids)).toEqual([[20]]);
  });
});
