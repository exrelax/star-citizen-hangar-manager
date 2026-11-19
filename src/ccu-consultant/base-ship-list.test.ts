import { describe, expect, it } from 'vitest';
import type { Ship } from '@/ships/ships';
import type { AlwaysAvailableList } from './always-available';
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
