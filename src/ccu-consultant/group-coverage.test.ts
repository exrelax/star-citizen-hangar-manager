import { describe, expect, it } from 'vitest';
import type { CcuCoverage, CoverageMatch } from './coverage';
import { groupCoverage } from './group-coverage';

/* The base ship coverage of a group of CCUs (#574). */

const match = (id: number, source: 'hangar' | 'buyback', kind: 'ship' | 'ccu'): CoverageMatch => ({
  source,
  kind,
  id,
  title: `Pledge ${id}`,
});
const coverage = (id: number, hangar: CoverageMatch[], buyback: CoverageMatch[] = []) => ({
  id,
  baseShip: { id: 7, name: 'Cutlass Black' },
  hangar: {
    ships: hangar.filter((entry) => entry.kind === 'ship'),
    ccus: hangar.filter((entry) => entry.kind === 'ccu'),
  },
  buyback: {
    ships: buyback.filter((entry) => entry.kind === 'ship'),
    ccus: buyback.filter((entry) => entry.kind === 'ccu'),
  },
  covered: hangar.length + buyback.length > 0,
});
const of = (ids: number[], make: (id: number) => CcuCoverage) =>
  groupCoverage(ids, new Map(ids.map((id) => [id, make(id)])));

describe('groupCoverage', () => {
  it('gives the base ship to one CCU per ship or CCU to it: 2 of 5', () => {
    const result = of([1, 2, 3, 4, 5], (id) =>
      coverage(id, [match(90, 'hangar', 'ship')], [match(80, 'buyback', 'ccu')]),
    )!;
    expect([result.covered, result.total]).toEqual([2, 5]);
    expect(result.coverage.id).toBe(1);
  });

  it('covers all with enough, none without any', () => {
    const ways = [90, 91, 92].map((id) => match(id, 'hangar', 'ship'));
    expect(of([1, 2], (id) => coverage(id, ways))).toMatchObject({ covered: 2, total: 2 });
    expect(of([1, 2], (id) => coverage(id, []))).toMatchObject({ covered: 0, total: 2 });
  });

  it('has none without a coverage of its CCUs', () => {
    expect(groupCoverage([1, 2], new Map())).toBeUndefined();
  });
});
