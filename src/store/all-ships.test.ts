import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView } from '@/hangar/pledge-view';
import { createShipFactsLookup, type ShipFacts } from '@/ships/ship-facts';
import type { Ship } from '@/ships/ships';
import { allShips } from './all-ships';

/* The table of all ships by value (#385). */

const ship = (id: number, name: string, msrp: number): Ship => ({ id, name, msrp });
const SHIPS = [
  ship(1, 'Aurora Mk I ES', 20),
  ship(11, 'F7C Hornet Mk I', 125),
  ship(45, 'Constellation Mk IV Andromeda', 260),
  ship(9, 'Mercury', 260),
  ship(109, 'Prospector', 155),
];

const ccu = (id: number, from: string, to: string) =>
  toPledgeView({
    id,
    name: `Upgrade - ${from} to ${to}`,
    title: `Upgrade - ${from} to ${to}`,
    value: '$10.00 USD',
    valueUsd: 10,
    items: [],
    isUpgraded: false,
    upgrade: { matchItems: [{ id: 1, name: from }], targetItems: [{ id: 2, name: to }], type: 'R' },
  } as unknown as Pledge);
const standaloneShip = (id: number, name: string, category = 'standalone_ship') =>
  toPledgeView({
    id,
    name: `Standalone Ships - ${name}`,
    title: `Standalone Ships - ${name}`,
    value: '$100.00 USD',
    valueUsd: 100,
    isUpgraded: false,
    category,
    items: [{ title: name, kind: 'Ship' }],
  } as unknown as Pledge);
const buyback = (overrides: Partial<BuybackView>) =>
  ({
    id: 1,
    title: '',
    ships: [],
    isCcu: false,
    isStandaloneShip: false,
    ...overrides,
  }) as BuybackView;

const facts = createShipFactsLookup({
  changedAt: '',
  generatedAt: '',
  revision: 1,
  sources: [
    { id: 'wiki', name: 'Wiki', url: 'https://example.org', facts: ['alwaysAvailable', 'retired'] },
  ],
  ships: [
    {
      id: 1,
      name: 'Aurora Mk I ES',
      manufacturer: 'Roberts Space Industries',
      wikiName: 'Aurora Mk I ES',
      status: [],
      alwaysAvailable: [],
      msrp: [],
      retired: [{ from: '2026-11-18' }],
    },
    {
      id: 109,
      name: 'Prospector',
      manufacturer: 'MISC',
      wikiName: 'Prospector',
      status: [],
      alwaysAvailable: [{ from: '2026-11-12' }],
      msrp: [],
      retired: [],
    },
  ],
} as ShipFacts);

const rows = (input: Partial<Parameters<typeof allShips>[0]> = {}) =>
  allShips({ ships: SHIPS, buyable: [], warbonds: [], hangar: [], buyback: [], ...input });

describe('allShips', () => {
  it('sorts by value, highest first, ships of equal value by name', () => {
    expect(rows().map((row) => row.ship.name)).toEqual([
      'Constellation Mk IV Andromeda',
      'Mercury',
      'Prospector',
      'F7C Hornet Mk I',
      'Aurora Mk I ES',
    ]);
  });

  it('counts the CCUs from and to each ship in the hangar and the buy back', () => {
    const list = rows({
      hangar: [
        ccu(1, 'Prospector', 'Mercury'),
        ccu(2, 'Prospector', 'Constellation Mk IV Andromeda'),
        ccu(3, 'Aurora Mk I ES', 'Prospector'),
      ],
      buyback: [
        buyback({ id: 4, title: 'Upgrade - Prospector to Mercury', isCcu: true }),
        buyback({ id: 5, title: 'Upgrade - Aurora Mk I ES to Prospector', isCcu: true }),
        // RSI can't sell it again (#207): not counted.
        buyback({
          id: 6,
          title: 'Upgrade - Mercury to Prospector',
          isCcu: true,
          unavailable: {
            from: { name: 'Mercury', msrp: 260 },
            to: { name: 'Prospector', msrp: 155 },
          },
        }),
      ],
    });
    const prospector = list.find((row) => row.ship.id === 109)!;
    expect(prospector).toMatchObject({ hangarFrom: 2, hangarTo: 1, buybackFrom: 1, buybackTo: 1 });
    const mercury = list.find((row) => row.ship.id === 9)!;
    expect(mercury).toMatchObject({ hangarFrom: 0, hangarTo: 1, buybackFrom: 0, buybackTo: 1 });
  });

  it('counts standalone ship pledges only, in the hangar and the buy back', () => {
    const list = rows({
      hangar: [
        standaloneShip(10, 'Prospector'),
        standaloneShip(11, 'Prospector'),
        standaloneShip(12, 'Prospector', 'game_package'),
      ],
      buyback: [
        buyback({ id: 13, isStandaloneShip: true, ships: [{ name: 'Mercury' }] }),
        buyback({ id: 14, isStandaloneShip: false, ships: [{ name: 'Mercury' }] }),
      ],
    });
    expect(list.find((row) => row.ship.id === 109)).toMatchObject({
      hangarShips: 2,
      buybackShips: 0,
    });
    expect(list.find((row) => row.ship.id === 9)).toMatchObject({
      hangarShips: 0,
      buybackShips: 1,
    });
  });

  it('names the warbond price, the facts and the SKUs of a ship on sale', () => {
    const list = rows({
      facts,
      buyable: [
        { shipId: 109, skuId: 900, title: 'Standard Edition', price: 155 },
        { shipId: 109, skuId: 901, title: 'Warbond Edition', price: 140 },
      ],
      warbonds: [{ shipId: 109, skuId: 901, price: 140 }],
    });
    const prospector = list.find((row) => row.ship.id === 109)!;
    expect(prospector).toMatchObject({
      manufacturer: 'MISC',
      warbondPrice: 140,
      alwaysAvailable: true,
      purchasable: true,
      skuId: 900,
      warbondSkuId: 901,
    });
    const aurora = list.find((row) => row.ship.id === 1)!;
    expect(aurora).toMatchObject({ alwaysAvailable: false, purchasable: false });
    expect(aurora.skuId).toBeUndefined();
    // Not in the facts: nothing claimed.
    const mercury = list.find((row) => row.ship.id === 9)!;
    expect(mercury.alwaysAvailable).toBeUndefined();
    expect(mercury.purchasable).toBeUndefined();
    expect(mercury.warbondPrice).toBeUndefined();
  });

  it('claims nothing about being sold without the fact in the file', () => {
    const old = createShipFactsLookup({
      ...facts.facts,
      sources: [
        { id: 'wiki', name: 'Wiki', url: 'https://example.org', facts: ['alwaysAvailable'] },
      ],
    });
    expect(rows({ facts: old }).find((row) => row.ship.id === 1)?.purchasable).toBeUndefined();
  });

  it('shows the next price increase and the removal of a ship, matched by its id (#410)', () => {
    const at = (day: number) => ({ at: Date.UTC(2026, 10, day, 16) });
    const later = { ship: { id: 109, name: 'Prospector' }, priceIncreaseAt: at(25) };
    const next = {
      ship: { id: 109, name: 'Prospector' },
      priceIncreaseAt: at(19),
      price: { from: 155, to: 175 },
      confirmed: true as const,
    };
    const removal = {
      ship: { id: 45, name: 'Constellation Mk IV Andromeda' },
      removedAt: { at: Date.UTC(2027, 0, 27), dayOnly: true as const },
      source: 'https://example.org',
    };
    // The lists come with the next first.
    const list = rows({ increases: [next, later], removals: [removal] });
    expect(list.find((row) => row.ship.id === 109)?.priceIncrease).toBe(next);
    expect(list.find((row) => row.ship.id === 45)?.removal).toBe(removal);
    expect(list.find((row) => row.ship.id === 9)).not.toHaveProperty('priceIncrease');
    expect(list.find((row) => row.ship.id === 9)).not.toHaveProperty('removal');
  });
});
