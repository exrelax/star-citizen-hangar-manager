import { describe, expect, it } from 'vitest';
import type { AlwaysAvailableList } from './always-available';
import { chainCoverage } from './chain-coverage';
import type { CcuCoverage, CoverageMatch } from './coverage';

/*
 * The deep view's chain rule (#563): a CCU to a base ship only counts if its own base ship has a
 * way too, and each way serves one CCU.
 */

const SHIPS: Record<string, number> = {
  Aurora: 1,
  Arrow: 2,
  Cutlass: 3,
  Hull: 4,
  Razor: 5,
  Black: 6,
  R350: 7,
  Red: 8,
  Z: 9,
  C1: 10,
};
type Name = keyof typeof SHIPS;

const ship = (id: number, source: 'hangar' | 'buyback' = 'hangar'): CoverageMatch => ({
  source,
  kind: 'ship',
  id,
  title: `Ship ${id}`,
});
const ccuMatch = (id: number, source: 'hangar' | 'buyback' = 'hangar'): CoverageMatch => ({
  source,
  kind: 'ccu',
  id,
  title: `CCU ${id}`,
});

/** Builds the coverages of hangar CCUs from a few lines, as `ccuCoverage` would. */
function hangar(
  ccus: { id: number; from: Name; to: Name }[],
  owned: { ships?: Partial<Record<Name, number[]>>; buyback?: Partial<Record<Name, number[]>> },
): CcuCoverage[] {
  return ccus.map((ccu) => {
    const ships = (owned.ships?.[ccu.from] ?? []).map((id) => ship(id));
    const incoming = ccus
      .filter((other) => other.to === ccu.from && other.id !== ccu.id)
      .map((other) => ccuMatch(other.id));
    const buyback = (owned.buyback?.[ccu.from] ?? []).map((id) => ship(id, 'buyback'));
    return {
      id: ccu.id,
      baseShip: { id: SHIPS[ccu.from]!, name: ccu.from },
      hangar: { ships, ccus: incoming },
      buyback: { ships: buyback, ccus: [] },
      covered: ships.length + incoming.length + buyback.length > 0,
    };
  });
}

const alwaysList = (...names: Name[]): AlwaysAvailableList => ({
  source: { id: 'wiki', name: 'Wiki', url: 'https://w', facts: [] },
  changedAt: '',
  has: (id) => names.some((name) => SHIPS[name] === id),
});

const key = (name: Name) => `id:${SHIPS[name]}`;

describe('chainCoverage (#563)', () => {
  it('counts each ship of the hangar for one CCU from it', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Arrow', to: 'Z' },
          { id: 11, from: 'Arrow', to: 'Z' },
        ],
        { ships: { Arrow: [100] } },
      ),
      undefined,
    );
    const arrow = result.ships.get(key('Arrow'))!;
    expect(arrow.ways).toEqual({ ship: 1, chain: 0, buyback: 0 });
    expect([arrow.total, arrow.short, arrow.deepOnly]).toEqual([1, 1, false]);
    expect(result.tooFew.map((entry) => entry.name)).toEqual(['Arrow']);
    expect(result.tooFewCount).toBe(1);
  });

  it('follows a chain that starts at a ship of the hangar', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Arrow', to: 'Cutlass' },
          { id: 12, from: 'Cutlass', to: 'Z' },
        ],
        { ships: { Aurora: [100] } },
      ),
      undefined,
    );
    const cutlass = result.ships.get(key('Cutlass'))!;
    expect(cutlass.ways).toEqual({ ship: 0, chain: 1, buyback: 0 });
    expect(cutlass.short).toBe(0);
    expect(cutlass.routes).toEqual([
      { path: [key('Aurora'), key('Arrow')], root: 'ship', count: 1 },
    ]);
    expect(result.tooFew).toEqual([]);
  });

  it('doesn’t count a CCU whose own base ship has no way: found by the deep view', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Arrow', to: 'Z' },
        ],
        {},
      ),
      undefined,
    );
    const arrow = result.ships.get(key('Arrow'))!;
    // The simple view counts the CCU to it as its way.
    expect(arrow.simpleWays).toBe(1);
    expect([arrow.total, arrow.short, arrow.deepOnly]).toEqual([0, 1, true]);
    expect(arrow.blocked).toEqual([{ from: key('Aurora'), count: 1 }]);
    const aurora = result.ships.get(key('Aurora'))!;
    // Nothing gives it at all: short, but the simple view knows that already.
    expect([aurora.short, aurora.deepOnly]).toEqual([1, false]);
    expect(result.tooFew.map((entry) => entry.name)).toEqual(['Arrow', 'Aurora']);
    expect(result.tooFewCount).toBe(2);
  });

  it('gives every CCU its own way: one ship serves one chain', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Aurora', to: 'Arrow' },
          { id: 12, from: 'Arrow', to: 'Z' },
          { id: 13, from: 'Arrow', to: 'Z' },
        ],
        { ships: { Aurora: [100] } },
      ),
      undefined,
    );
    expect(result.ships.get(key('Aurora'))!.short).toBe(1);
    const arrow = result.ships.get(key('Arrow'))!;
    expect([arrow.ways.chain, arrow.short, arrow.deepOnly]).toEqual([1, 1, true]);
    expect(arrow.blocked).toEqual([{ from: key('Aurora'), count: 1 }]);
  });

  it('starts chains at always available ships, never short of ways themselves', () => {
    const coverages = hangar(
      [
        { id: 10, from: 'Aurora', to: 'Arrow' },
        { id: 11, from: 'Aurora', to: 'Arrow' },
        { id: 12, from: 'Arrow', to: 'Z' },
        { id: 13, from: 'Arrow', to: 'Z' },
      ],
      {},
    );
    const result = chainCoverage(coverages, alwaysList('Aurora'));
    const aurora = result.ships.get(key('Aurora'))!;
    expect([aurora.always, aurora.short]).toEqual([true, 0]);
    const arrow = result.ships.get(key('Arrow'))!;
    expect([arrow.ways.chain, arrow.short]).toEqual([2, 0]);
    expect(arrow.routes).toEqual([{ path: [key('Aurora')], root: 'always', count: 2 }]);
    // Not considered: nothing gives Aurora.
    expect(chainCoverage(coverages, undefined).tooFewCount).toBe(4);
  });

  it('counts the buy back and chains starting in it as buy back', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Arrow', to: 'Z' },
          { id: 12, from: 'Arrow', to: 'Z' },
        ],
        { buyback: { Aurora: [200], Arrow: [201] } },
      ),
      undefined,
    );
    const arrow = result.ships.get(key('Arrow'))!;
    expect(arrow.ways).toEqual({ ship: 0, chain: 0, buyback: 2 });
    expect(arrow.short).toBe(0);
    expect(arrow.routes).toEqual([{ path: [key('Aurora')], root: 'buyback', count: 1 }]);
    expect(arrow.buyback.map((match) => match.id)).toEqual([201]);
  });

  it('hands the hangar’s ways on before the buy back’s', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Aurora', to: 'Z' },
          { id: 12, from: 'Arrow', to: 'Z' },
        ],
        { ships: { Aurora: [100] }, buyback: { Aurora: [200] } },
      ),
      undefined,
    );
    expect(result.ships.get(key('Arrow'))!.ways).toEqual({ ship: 0, chain: 1, buyback: 0 });
  });

  it('gives a way first to a CCU whose target lacks ways', () => {
    const result = chainCoverage(
      hangar(
        [
          // The first CCU leads to a ship the hangar has already.
          { id: 10, from: 'Aurora', to: 'Arrow' },
          { id: 11, from: 'Aurora', to: 'Cutlass' },
          { id: 12, from: 'Arrow', to: 'Z' },
          { id: 13, from: 'Cutlass', to: 'Z' },
        ],
        { ships: { Aurora: [100], Arrow: [101] } },
      ),
      undefined,
    );
    expect(result.ships.get(key('Cutlass'))!.short).toBe(0);
    expect(result.ships.get(key('Arrow'))!.short).toBe(0);
    // Aurora's second CCU has no way: Aurora is short, not Cutlass.
    expect(result.tooFew.map((entry) => entry.name)).toEqual(['Aurora']);
  });

  it('gives a cycle of CCUs no way without a ship', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Arrow', to: 'Cutlass' },
          { id: 11, from: 'Cutlass', to: 'Arrow' },
        ],
        {},
      ),
      undefined,
    );
    expect(result.tooFewCount).toBe(2);
    expect(result.tooFew.every((entry) => entry.deepOnly)).toBe(true);
  });

  it('sorts the base ships short of ways by the most short, then by CCUs and name', () => {
    const result = chainCoverage(
      hangar(
        [
          { id: 10, from: 'Razor', to: 'Z' },
          { id: 11, from: 'Hull', to: 'Z' },
          { id: 12, from: 'Hull', to: 'Z' },
          { id: 13, from: 'Cutlass', to: 'Z' },
          { id: 14, from: 'Cutlass', to: 'Z' },
          { id: 15, from: 'Cutlass', to: 'Z' },
        ],
        { ships: { Cutlass: [100] } },
      ),
      undefined,
    );
    expect(result.tooFew.map((entry) => [entry.name, entry.short])).toEqual([
      ['Cutlass', 2],
      ['Hull', 2],
      ['Razor', 1],
    ]);
  });
});

describe('chainCoverage with the buy back’s CCUs followed (#651)', () => {
  type Ccu = { id: number; from: Name; to: Name };

  /**
   * The coverages of the hangar's and the buy back's CCUs, as `ccuCoverage` would: each gets the
   * hangar's ships and CCUs to its base ship and the buy back's CCUs to it (never itself).
   */
  function both(
    hangarCcus: Ccu[],
    buybackCcus: Ccu[],
    ships: Partial<Record<Name, number[]>> = {},
  ): { hangar: CcuCoverage[]; buyback: Map<number, CcuCoverage> } {
    const coverageOf = (ccu: Ccu, self: 'hangar' | 'buyback'): CcuCoverage => {
      const own = (ships[ccu.from] ?? []).map((id) => ship(id));
      const toIt = (list: Ccu[], source: 'hangar' | 'buyback') =>
        list
          .filter((other) => other.to === ccu.from && !(source === self && other.id === ccu.id))
          .map((other) => ccuMatch(other.id, source));
      const hangarCcus_ = toIt(hangarCcus, 'hangar');
      const buybackCcus_ = toIt(buybackCcus, 'buyback');
      return {
        id: ccu.id,
        baseShip: { id: SHIPS[ccu.from]!, name: ccu.from },
        hangar: { ships: own, ccus: hangarCcus_ },
        buyback: { ships: [], ccus: buybackCcus_ },
        covered: own.length + hangarCcus_.length + buybackCcus_.length > 0,
      };
    };
    return {
      hangar: hangarCcus.map((ccu) => coverageOf(ccu, 'hangar')),
      buyback: new Map(buybackCcus.map((ccu) => [ccu.id, coverageOf(ccu, 'buyback')])),
    };
  }
  const many = (count: number, first: number, from: Name, to: Name): Ccu[] =>
    Array.from({ length: count }, (_, index) => ({ id: first + index, from, to }));

  // The example of the issue: 10 CCUs 350r → Red in the buy back, but only 5 ways to the 350r.
  const example = () =>
    both(
      [
        ...many(5, 100, 'Black', 'R350'),
        ...many(3, 200, 'C1', 'Red'),
        ...many(28, 300, 'Red', 'Z'),
      ],
      many(10, 900, 'R350', 'Red'),
      { C1: [50, 51, 52] },
    );

  it('counts a CCU in the buy back only if its base ship has a way', () => {
    const { hangar: coverages, buyback } = example();
    const result = chainCoverage(coverages, alwaysList('Black'), buyback);
    const red = result.ships.get(key('Red'))!;
    expect(red.ways).toEqual({ ship: 0, chain: 3, buyback: 5 });
    expect([red.total, red.short]).toEqual([8, 20]);
    expect(red.blockedBuyback).toEqual([{ from: key('R350'), count: 5, total: 10 }]);
    expect(red.routes).toEqual([
      { path: [key('Black'), key('R350')], root: 'always', buyback: true, count: 5 },
      { path: [key('C1')], root: 'ship', count: 3 },
    ]);
    // The simple view counts every CCU to it: 13 of 28.
    expect(red.simpleWays).toBe(13);
    // The 350r is a link of the chains, without a row.
    expect(result.ships.has(key('R350'))).toBe(false);
    expect(result.nodes.get(key('R350'))).toEqual({
      key: key('R350'),
      name: 'R350',
      shipId: SHIPS.R350,
      always: false,
      // Its 5 ways: none for CCUs from it in the hangar, all 5 to the Red along the buy back's.
      use: { ways: 5, hangar: 0, buyback: [{ to: key('Red'), count: 5 }], idle: [] },
    });
    expect(result.tooFewCount).toBe(20);
  });

  it('counts every CCU in the buy back without its coverages, as before', () => {
    const { hangar: coverages } = example();
    const red = chainCoverage(coverages, alwaysList('Black')).ships.get(key('Red'))!;
    expect([red.ways.buyback, red.short, red.blockedBuyback]).toEqual([10, 15, []]);
  });

  it('follows a chain through several CCUs in the buy back', () => {
    const { hangar: coverages, buyback } = both(
      many(3, 300, 'Red', 'Z'),
      [...many(2, 900, 'Aurora', 'R350'), ...many(3, 910, 'R350', 'Red')],
      { Aurora: [50] },
    );
    const red = chainCoverage(coverages, undefined, buyback).ships.get(key('Red'))!;
    expect(red.ways).toEqual({ ship: 0, chain: 0, buyback: 1 });
    expect(red.short).toBe(2);
    expect(red.routes).toEqual([
      { path: [key('Aurora'), key('R350')], root: 'ship', buyback: true, count: 1 },
    ]);
    expect(red.blockedBuyback).toEqual([{ from: key('R350'), count: 2, total: 3 }]);
  });

  it('counts every CCU in the buy back from an always available ship', () => {
    const { hangar: coverages, buyback } = both(
      many(4, 300, 'Red', 'Z'),
      many(3, 900, 'Black', 'Red'),
    );
    const red = chainCoverage(coverages, alwaysList('Black'), buyback).ships.get(key('Red'))!;
    expect([red.ways.buyback, red.short, red.blockedBuyback]).toEqual([3, 1, []]);
    expect(red.routes).toEqual([{ path: [key('Black')], root: 'always', buyback: true, count: 3 }]);
  });

  it('serves the hangar’s CCUs from a ship before the buy back’s', () => {
    // Two ways to the Arrow: both go to its own CCUs, none to the one in the buy back.
    const { hangar: coverages, buyback } = both(
      [...many(2, 100, 'Arrow', 'Z'), ...many(2, 300, 'Red', 'Z')],
      many(1, 900, 'Arrow', 'Red'),
      { Arrow: [50, 51] },
    );
    const result = chainCoverage(coverages, undefined, buyback);
    expect(result.ships.get(key('Arrow'))!.short).toBe(0);
    // Both of the Arrow's ways serve its own CCUs in the hangar.
    expect(result.nodes.get(key('Arrow'))!.use).toEqual({
      ways: 2,
      hangar: 2,
      buyback: [],
      idle: [],
    });
    const red = result.ships.get(key('Red'))!;
    expect([red.total, red.short]).toEqual([0, 2]);
    expect(red.blockedBuyback).toEqual([{ from: key('Arrow'), count: 1, total: 1 }]);
    // A simple-view-covered base ship short only by the new rule is found by the deep view.
    expect(red.deepOnly).toBe(false);
  });

  it('finds a base ship the simple view counts covered by CCUs in the buy back', () => {
    const { hangar: coverages, buyback } = both(
      many(2, 300, 'Red', 'Z'),
      many(2, 900, 'R350', 'Red'),
    );
    const red = chainCoverage(coverages, undefined, buyback).ships.get(key('Red'))!;
    expect([red.simpleWays, red.short, red.deepOnly]).toEqual([2, 2, true]);
  });

  it('needs a way only for CCUs with a discount: the others are optional links', () => {
    const { hangar: coverages, buyback } = both(
      [...many(2, 100, 'Aurora', 'Arrow'), ...many(3, 300, 'Arrow', 'Z')],
      [],
      { Aurora: [50] },
    );
    // The CCUs from the Aurora have no discount: optional links, never short.
    for (const coverage of coverages) coverage.discount = coverage.id >= 300;
    const result = chainCoverage(coverages, undefined, buyback);
    const aurora = result.ships.get(key('Aurora'))!;
    expect([aurora.ccus, aurora.others.length, aurora.short]).toEqual([[], 2, 0]);
    // The Aurora's one ship goes on to the Arrow along one of them.
    const arrow = result.ships.get(key('Arrow'))!;
    expect([arrow.ccus.length, arrow.ways.chain, arrow.short]).toEqual([3, 1, 2]);
    expect(arrow.blocked).toEqual([{ from: key('Aurora'), count: 1 }]);
    expect(result.tooFewCount).toBe(2);
  });

  it('hands the ways out so that as many CCUs with a discount as possible get one', () => {
    // One way to the Arrow, CCUs in the buy back from it to the Razor and the Hull: the Hull has a
    // ship of its own, so the way goes to the Razor.
    const { hangar: coverages, buyback } = both(
      [...many(1, 300, 'Razor', 'Z'), ...many(1, 310, 'Hull', 'Z')],
      [...many(1, 900, 'Arrow', 'Razor'), ...many(2, 910, 'Arrow', 'Hull')],
      { Arrow: [50], Hull: [60] },
    );
    const result = chainCoverage(coverages, undefined, buyback);
    expect(result.ships.get(key('Razor'))!.short).toBe(0);
    expect(result.ships.get(key('Hull'))!.short).toBe(0);
    expect(result.nodes.get(key('Arrow'))!.use).toEqual({
      ways: 1,
      hangar: 0,
      buyback: [{ to: key('Razor'), count: 1 }],
      idle: [],
    });
  });

  it('lists the CCUs that carry no way only while the base ship is short', () => {
    const { hangar: coverages, buyback } = both(
      many(1, 300, 'Red', 'Z'),
      many(3, 900, 'Black', 'Red'),
    );
    const red = chainCoverage(coverages, alwaysList('Black'), buyback).ships.get(key('Red'))!;
    // One of the three CCUs in the buy back is enough: the others aren't missing.
    expect([red.short, red.ways.buyback, red.blockedBuyback]).toEqual([0, 1, []]);
  });

  it('names the hangar’s CCUs to a link that carry no way: their base ship’s ways are taken', () => {
    // As in the example, plus 5 CCUs Arrow → 350r: the Arrow's one ship goes to the Red directly
    // along a CCU in the buy back, so they carry no way to the 350r.
    const { hangar: coverages, buyback } = both(
      [
        ...many(5, 100, 'Black', 'R350'),
        ...many(5, 150, 'Arrow', 'R350'),
        ...many(28, 300, 'Red', 'Z'),
      ],
      [...many(10, 900, 'R350', 'Red'), ...many(1, 950, 'Arrow', 'Red')],
      { Arrow: [60] },
    );
    for (const coverage of coverages) coverage.discount = coverage.id >= 300;
    const result = chainCoverage(coverages, alwaysList('Black'), buyback);
    expect(result.nodes.get(key('R350'))!.use!.idle).toEqual([{ from: key('Arrow'), count: 5 }]);
    expect(result.nodes.get(key('Arrow'))!.use).toEqual({
      ways: 1,
      hangar: 0,
      buyback: [{ to: key('Red'), count: 1 }],
      idle: [],
    });
    expect(result.ships.get(key('Red'))!.total).toBe(6);
  });
});
