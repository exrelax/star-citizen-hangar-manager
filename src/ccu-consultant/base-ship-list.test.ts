import { describe, expect, it } from 'vitest';
import type { Ship } from '@/ships/ships';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import { withoutLeaving, type AlwaysAvailableList } from './always-available';
import { baseMissingOf } from './ccu-labels';
import { missingCounts } from './use-base-ship-list';
import { baseShipList, standingOf } from './base-ship-list';
import type { CcuCoverage, CoverageMatch } from './coverage';

const match = (source: 'hangar' | 'buyback', id: number, kind: 'ship' | 'ccu' = 'ccu') =>
  ({ source, kind, id, title: `Pledge ${id}` }) as CoverageMatch;

function coverage(
  id: number,
  base: { id?: number; name: string } | undefined,
  hangar: CoverageMatch[] = [],
  buyback: CoverageMatch[] = [],
): CcuCoverage {
  return {
    id,
    ...(base && { baseShip: base }),
    hangar: {
      ships: hangar.filter((m) => m.kind === 'ship'),
      ccus: hangar.filter((m) => m.kind === 'ccu'),
    },
    buyback: {
      ships: buyback.filter((m) => m.kind === 'ship'),
      ccus: buyback.filter((m) => m.kind === 'ccu'),
    },
    covered: hangar.length + buyback.length > 0,
  };
}

const always = (...ids: number[]): AlwaysAvailableList => ({
  source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
  changedAt: '2026-11-18T00:00:00Z',
  has: (id) => ids.includes(id),
});

const ships: Ship[] = [
  { id: 1, name: 'Arrow', msrp: 75 },
  { id: 2, name: 'Cutlass Red', msrp: 135, link: '/pledge/ships/drake-cutlass/cutlass-red' },
  { id: 3, name: 'Razor', msrp: 145 },
];

describe('the CCU Consultant’s list (#113)', () => {
  it('puts a CCU where its best cover is', () => {
    const arrow = { id: 1, name: 'Arrow' };
    expect(
      standingOf(coverage(1, arrow, [match('hangar', 9)], [match('buyback', 8)]), always(1)),
    ).toBe('hangar');
    expect(standingOf(coverage(1, arrow, [], [match('buyback', 8)]), always(1))).toBe('buyback');
    expect(standingOf(coverage(1, arrow), always(1))).toBe('always');
    expect(standingOf(coverage(1, arrow), always())).toBe('missing');
    // Not considered (the setting is off): no list.
    expect(standingOf(coverage(1, arrow), undefined)).toBe('missing');
    expect(standingOf(coverage(1, { name: 'Arrow' }), always(1))).toBe('missing');
  });

  it('counts every CCU and groups the others by base ship, most CCUs first', () => {
    const list = baseShipList(
      [
        coverage(10, { id: 1, name: 'Arrow' }, [match('hangar', 90, 'ship')]),
        coverage(11, { id: 1, name: 'Arrow' }),
        coverage(12, { id: 3, name: 'Razor' }, [], [match('buyback', 80)]),
        coverage(
          13,
          { id: 2, name: 'Cutlass Red' },
          [],
          [match('buyback', 81, 'ship'), match('buyback', 82)],
        ),
        coverage(14, { id: 2, name: 'Cutlass Red' }, [], [match('buyback', 82)]),
        coverage(15, { id: 2, name: 'Cutlass Red' }),
        coverage(16, { name: 'Nox' }),
        coverage(17, undefined),
      ],
      always(1),
      ships,
    );
    expect(list.total).toBe(8);
    expect(list.counts).toEqual({ hangar: 1, buyback: 3, always: 1, missing: 3 });
    expect(list.groups.buyback.map((row) => [row.name, row.ccus])).toEqual([
      ['Cutlass Red', [13, 14]],
      ['Razor', [12]],
    ]);
    // What the buy back has of it, each pledge once.
    expect(list.groups.buyback[0]!.matches.map((m) => m.id)).toEqual([81, 82]);
    expect(list.groups.always).toEqual([
      { key: 'id:1', name: 'Arrow', shipId: 1, ccus: [11], price: 75, matches: [] },
    ]);
    expect(list.groups.missing).toEqual([
      {
        key: 'id:2',
        name: 'Cutlass Red',
        shipId: 2,
        ccus: [15],
        price: 135,
        link: '/pledge/ships/drake-cutlass/cutlass-red',
        matches: [],
      },
      { key: 'name:nox', name: 'Nox', ccus: [16], matches: [] },
      // A CCU whose title doesn't tell its base ship comes last.
      { key: 'name:', ccus: [17], matches: [] },
    ]);
  });
});

describe('CCUs soon without base ship (#454)', () => {
  const removal = (id: number, name: string, at: string): ShipRemoval => ({
    ship: { id, name },
    removedAt: { at: Date.parse(at), dayOnly: true },
    source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
  });
  const razor = removal(3, 'Razor', '2027-01-27T00:00:00Z');
  const arrow = removal(1, 'Arrow', '2026-12-20T00:00:00Z');
  const leaving = new Map([
    [3, razor],
    [1, arrow],
  ]);

  it('lists leaving ships with fewer ways to them than CCUs from them, the next date first', () => {
    const list = baseShipList(
      [
        coverage(10, { id: 3, name: 'Razor' }, [], [match('buyback', 80)]),
        coverage(11, { id: 3, name: 'Razor' }, [], [match('buyback', 80)]),
        // A CCU to the Razor in the buy back gives it to one CCU only: one is short.
        coverage(14, { id: 3, name: 'Razor' }, [], [match('buyback', 80)]),
        // Always available today, but leaving: the list passed leaves it out (`withoutLeaving`).
        coverage(12, { id: 1, name: 'Arrow' }),
        coverage(13, { id: 2, name: 'Cutlass Red' }),
      ],
      withoutLeaving(always(1), leaving),
      ships,
      leaving,
    );
    expect(
      list.soon.map((row) => [row.name, row.ccus, row.removal?.ship.id, row.ways, row.short]),
    ).toEqual([
      ['Arrow', [12], 1, { hangar: 0, buyback: 0 }, 1],
      ['Razor', [10, 11, 14], 3, { hangar: 0, buyback: 1 }, 2],
    ]);
    expect(list.soonCount).toBe(3);
    // Without any way only here; with too few also where their cover puts them.
    expect(list.groups.missing.map((row) => row.name)).toEqual(['Cutlass Red']);
    expect(list.groups.buyback.map((row) => [row.name, row.ccus])).toEqual([
      ['Razor', [10, 11, 14]],
    ]);
    expect(list.groups.always).toEqual([]);
    expect(list.counts).toEqual({ hangar: 0, buyback: 3, always: 0, missing: 2 });
  });

  it('leaves out a leaving ship with a way for each CCU from it', () => {
    const list = baseShipList(
      [
        coverage(
          10,
          { id: 3, name: 'Razor' },
          [match('hangar', 90, 'ship')],
          [match('buyback', 80)],
        ),
        coverage(
          11,
          { id: 3, name: 'Razor' },
          [match('hangar', 90, 'ship')],
          [match('buyback', 80)],
        ),
      ],
      always(),
      ships,
      leaving,
    );
    expect(list.soon).toEqual([]);
    expect(list.soonCount).toBe(0);
  });

  it('has none without leaving ships', () => {
    const list = baseShipList([coverage(10, { id: 3, name: 'Razor' })], always(), ships);
    expect(list.soon).toEqual([]);
    expect(list.soonCount).toBe(0);
  });

  it('no longer counts a leaving ship as always available, nor labels it "Base ship missing"', () => {
    const list = withoutLeaving(always(1, 2), leaving)!;
    expect([1, 2].map(list.has)).toEqual([false, true]);
    expect(withoutLeaving(undefined, leaving)).toBeUndefined();
    const cover = coverage(12, { id: 1, name: 'Arrow' });
    expect(baseMissingOf(cover, list, ships, leaving)).toBeUndefined();
    expect(baseMissingOf(cover, list, ships)?.note).toContain('Arrow');
  });
});

describe('base ships with too few ways (#454)', () => {
  const viaBuyback = (id: number, base: { id: number; name: string }, ways: number[]) =>
    coverage(
      id,
      base,
      [],
      ways.map((way) => match('buyback', way)),
    );

  it('lists base ships not always available with fewer ways than CCUs, the most short first', () => {
    const cutlass = { id: 2, name: 'Cutlass Red' };
    const razor = { id: 3, name: 'Razor' };
    const list = baseShipList(
      [
        // Three CCUs from the Cutlass Red, one CCU to it in the buy back: two are short.
        viaBuyback(10, cutlass, [80]),
        viaBuyback(11, cutlass, [80]),
        viaBuyback(12, cutlass, [80]),
        // Two from the Razor, a ship and a CCU to it: enough.
        coverage(13, razor, [match('hangar', 90, 'ship')], [match('buyback', 81)]),
        coverage(14, razor, [match('hangar', 90, 'ship')], [match('buyback', 81)]),
        // Always available: never short.
        coverage(15, { id: 1, name: 'Arrow' }),
        coverage(16, { id: 1, name: 'Arrow' }),
      ],
      always(1),
      ships,
    );
    expect(list.tooFew.map((row) => [row.name, row.ccus, row.ways, row.short])).toEqual([
      ['Cutlass Red', [10, 11, 12], { hangar: 0, buyback: 1 }, 2],
    ]);
    expect(list.tooFewCount).toBe(2);
    expect(list.soon).toEqual([]);
    // Where their cover puts them, as before.
    expect(list.groups.buyback.map((row) => row.name)).toEqual(['Cutlass Red']);
  });

  it('leaves the CCUs without any way to "Without base ship"', () => {
    const list = baseShipList([coverage(10, { id: 2, name: 'Cutlass Red' })], always(), ships);
    expect(list.tooFew).toEqual([]);
    expect(list.groups.missing.map((row) => row.name)).toEqual(['Cutlass Red']);
  });
});

describe('the counts of the sidebar box and the tab "Without base ship" (#115)', () => {
  it('adds the CCUs without base ship, soon without one and with too few ways', () => {
    const razor = {
      ship: { id: 3, name: 'Razor' },
      removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
      source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
    } as ShipRemoval;
    const list = baseShipList(
      [
        coverage(10, { id: 2, name: 'Cutlass Red' }),
        // Leaving, without any way: only in "soon".
        coverage(11, { id: 3, name: 'Razor' }),
        // Not always available, one way for two CCUs: one too few.
        coverage(12, { id: 1, name: 'Arrow' }, [], [match('buyback', 80)]),
        coverage(13, { id: 1, name: 'Arrow' }, [], [match('buyback', 80)]),
      ],
      always(),
      ships,
      new Map([[3, razor]]),
    );
    expect(missingCounts(list)).toEqual({ missing: 1, soon: 1, tooFew: 1, total: 3 });
  });
});
