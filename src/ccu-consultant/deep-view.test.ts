import { describe, expect, it } from 'vitest';
import type { Ship } from '@/ships/ships';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { BaseShipList } from './base-ship-list';
import type { ChainCoverage, ChainShip } from './chain-coverage';
import {
  deepCcuIds,
  deepRows,
  deepShips,
  secureOptions,
  secureSummary,
  segmentsOf,
} from './deep-view';

const ships: Ship[] = [
  { id: 1, name: 'Aurora', msrp: 25 },
  { id: 2, name: 'Arrow', msrp: 75 },
  { id: 3, name: 'Avenger', msrp: 75 },
  { id: 4, name: 'Cutlass Red', msrp: 135 },
  { id: 5, name: 'C1 Spirit', msrp: 125 },
  { id: 6, name: 'Free', msrp: 0 },
];
const isAlways = (id: number) => id === 1 || id === 3;

const chainShip = (overrides: Partial<ChainShip> & Pick<ChainShip, 'key'>): ChainShip => ({
  ccus: [],
  others: [],
  always: false,
  ways: { ship: 0, chain: 0, buyback: 0 },
  total: 0,
  short: 0,
  simpleWays: 0,
  deepOnly: false,
  routes: [],
  blocked: [],
  blockedBuyback: [],
  buyback: [],
  hangarShips: [],
  ...overrides,
});

describe('the deep view of the CCU Consultant (#563)', () => {
  it('splits a bar into its ways and the CCUs short of one, one segment per CCU', () => {
    const ship = chainShip({
      key: 'id:4',
      ccus: [1, 2, 3, 4, 5, 6],
      ways: { ship: 1, chain: 2, buyback: 1 },
      total: 4,
      short: 2,
    });
    expect(segmentsOf(ship)).toEqual([
      { kind: 'ship', count: 1 },
      { kind: 'chain', count: 2 },
      { kind: 'buyback', count: 1 },
      { kind: 'short', count: 2 },
    ]);
    // More ways than CCUs: only as many segments as CCUs.
    expect(segmentsOf({ ...ship, ccus: [1, 2], ways: { ship: 3, chain: 0, buyback: 1 } })).toEqual([
      { kind: 'ship', count: 2 },
    ]);
    // An always available ship serves the rest.
    expect(segmentsOf({ ...ship, always: true, short: 0 })).toEqual([
      { kind: 'ship', count: 1 },
      { kind: 'chain', count: 2 },
      { kind: 'buyback', count: 1 },
      { kind: 'always', count: 2 },
    ]);
  });

  it('finds the next cheaper always available ship and the next cheaper ship', () => {
    const cutlass = ships[3]!;
    expect(secureOptions(cutlass, ships, isAlways)).toEqual({
      considered: true,
      always: { from: ships[2], each: 60, always: true },
      cheapest: { from: ships[4], each: 10, always: false },
    });
    // On equal prices the always available ship wins: one option, also the cheapest.
    expect(secureOptions({ id: 9, msrp: 90 }, ships, isAlways)).toEqual({
      considered: true,
      always: { from: ships[2], each: 15, always: true },
    });
    // Not considered: only the cheapest.
    expect(secureOptions(cutlass, ships, undefined)).toEqual({
      considered: false,
      cheapest: { from: ships[4], each: 10, always: false },
    });
    // Nothing cheaper (a ship without a price doesn't count), no price at all.
    expect(secureOptions({ id: 1, msrp: 25 }, ships, isAlways)).toEqual({ considered: true });
    expect(secureOptions(undefined, ships, isAlways)).toEqual({ considered: true });
  });

  it('makes the rows of "Too few ways", those on sale first, and their totals', () => {
    const tooFew = [
      chainShip({ key: 'id:2', shipId: 2, ccus: [1, 2, 3], short: 3 }),
      chainShip({
        key: 'id:4',
        shipId: 4,
        ccus: [4, 5],
        ways: { ship: 1, chain: 0, buyback: 0 },
        total: 1,
        short: 1,
      }),
      chainShip({ key: 'name:x', name: 'X', ccus: [6], short: 1 }),
    ];
    const chains: ChainCoverage = {
      ships: new Map(tooFew.map((ship) => [ship.key, ship])),
      nodes: new Map(),
      tooFew,
      tooFewCount: 5,
    };
    const removal = { ship: { id: 2, name: 'Arrow' } } as ShipRemoval;
    const rows = deepRows(deepShips(chains, {} as BaseShipList, 'missing'), 'missing', {
      ships,
      skuOf: (id) => (id === 4 || id === 2 ? 100 + id : undefined),
      isAlways,
      leaving: new Map([[2, removal]]),
    });
    expect(rows.map((row) => [row.ship.key, row.onSale, row.need])).toEqual([
      ['id:2', true, 3],
      ['id:4', true, 1],
      ['name:x', false, 1],
    ]);
    expect(rows[0]!.removal).toBe(removal);
    expect(rows[0]!.info?.name).toBe('Arrow');
    expect(rows[0]!.options.always?.from.name).toBe('Aurora');
    expect(rows[2]!.options).toEqual({ considered: true });

    // Arrow: 3 × $50 from Aurora, 3 × $50 cheapest (Aurora as well); Cutlass Red: $60 and $10.
    expect(secureSummary(rows)).toEqual({
      ccus: 4,
      ships: 2,
      always: { total: 210, ships: 2 },
      cheapest: { total: 160, ships: 2 },
    });
    expect(deepCcuIds(tooFew)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('counts the CCUs that rely on the buy back as the ones to secure there', () => {
    const ship = chainShip({
      key: 'id:4',
      shipId: 4,
      ccus: [1, 2, 3],
      ways: { ship: 0, chain: 1, buyback: 4 },
      total: 5,
    });
    const list = { groups: { buyback: [{ key: 'id:4' }] } } as unknown as BaseShipList;
    const chains = {
      ships: new Map([[ship.key, ship]]),
      nodes: new Map(),
      tooFew: [],
      tooFewCount: 0,
    };
    const [row] = deepRows(deepShips(chains, list, 'buyback'), 'buyback', {
      ships,
      skuOf: () => undefined,
      leaving: new Map(),
    });
    expect(row!.need).toBe(2);
    expect(row!.options.considered).toBe(false);
    expect(secureSummary([row!])).toEqual({ ccus: 0, ships: 0 });
  });

  it('offers CCUs to a link of the buy back’s CCUs short of ways (#651)', () => {
    const ship = chainShip({
      key: 'id:4',
      shipId: 4,
      ccus: [1, 2, 3, 4, 5, 6],
      ways: { ship: 0, chain: 1, buyback: 2 },
      total: 3,
      short: 3,
      blockedBuyback: [
        { from: 'id:2', count: 5, total: 7 },
        { from: 'id:5', count: 1, total: 1 },
        { from: 'id:3', count: 2, total: 2 },
      ],
    });
    const nodes = new Map([
      ['id:2', { key: 'id:2', name: 'Arrow', shipId: 2, always: false }],
      ['id:5', { key: 'id:5', name: 'C1 Spirit', shipId: 5, always: false }],
      // An always available link is never short: nothing to offer.
      ['id:3', { key: 'id:3', name: 'Avenger', shipId: 3, always: true }],
    ]);
    const chains = { ships: new Map([[ship.key, ship]]), nodes, tooFew: [ship], tooFewCount: 3 };
    const [row] = deepRows(deepShips(chains, {} as BaseShipList, 'missing'), 'missing', {
      ships,
      skuOf: (id) => (id === 2 ? 102 : undefined),
      isAlways,
      leaving: new Map(),
      nodes,
    });
    expect(
      row!.links.map((link) => [link.name, link.onSale, link.need, link.option?.from.name]),
    ).toEqual([
      // No more than the base ship is short of; from the next cheaper always available ship.
      ['Arrow', true, 3, 'Aurora'],
      ['C1 Spirit', false, 1, 'Avenger'],
    ]);
    expect(row!.links[0]!.option?.each).toBe(50);
    // The base ship's own options are unchanged.
    expect(row!.need).toBe(3);
    // While RSI sells the base ship, a CCU to it is cheaper: no links then.
    const [onSale] = deepRows(deepShips(chains, {} as BaseShipList, 'missing'), 'missing', {
      ships,
      skuOf: (id) => (id === 2 || id === 4 ? 100 + id : undefined),
      isAlways,
      leaving: new Map(),
      nodes,
    });
    expect(onSale!.links).toEqual([]);
  });
});
