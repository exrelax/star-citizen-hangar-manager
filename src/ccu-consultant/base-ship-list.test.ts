import { describe, expect, it } from 'vitest';
import type { Ship } from '@/ships/ships';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import { withoutLeaving, type AlwaysAvailableList } from './always-available';
import { baseMissingOf } from './ccu-labels';
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

  it('lists the CCUs without other cover from a leaving ship apart, the next date first', () => {
    const list = baseShipList(
      [
        coverage(10, { id: 3, name: 'Razor' }),
        coverage(11, { id: 3, name: 'Razor' }),
        // Always available today, but leaving: the list passed leaves it out (`withoutLeaving`).
        coverage(12, { id: 1, name: 'Arrow' }),
        coverage(13, { id: 2, name: 'Cutlass Red' }),
        // Covered by the buy back: not soon without base ship.
        coverage(14, { id: 3, name: 'Razor' }, [], [match('buyback', 80)]),
      ],
      withoutLeaving(always(1), leaving),
      ships,
      leaving,
    );
    expect(list.soon.map((row) => [row.name, row.ccus, row.removal?.ship.id])).toEqual([
      ['Arrow', [12], 1],
      ['Razor', [10, 11], 3],
    ]);
    expect(list.soonCount).toBe(3);
    expect(list.groups.missing.map((row) => row.name)).toEqual(['Cutlass Red']);
    expect(list.groups.always).toEqual([]);
    // They count as without base ship, the tab's count included.
    expect(list.counts).toEqual({ hangar: 0, buyback: 1, always: 0, missing: 4 });
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
