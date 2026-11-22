import type { CcuCoverage } from './coverage';

/*
 * The base ship coverage of a group of CCUs (#574): all of them share base and target ship, so
 * they share what gives the base ship. By the CCU Consultant's rule (#425, `base-ship-list.ts`)
 * each ship or CCU to the base ship gives it to one CCU: of 5 CCUs with 2 such pledges, 2 are
 * covered.
 */

export interface GroupCoverage {
  /** What gives the base ship: the first CCU's coverage, the same for all. */
  coverage: CcuCoverage;
  /** How many of the group's CCUs get the base ship. */
  covered: number;
  total: number;
}

/** The coverage of a group of CCUs by their pledge ids; none if none of them has one. */
export function groupCoverage(
  ids: readonly number[],
  coverages: ReadonlyMap<number, CcuCoverage>,
): GroupCoverage | undefined {
  const coverage = ids.map((id) => coverages.get(id)).find((entry) => entry !== undefined);
  if (!coverage) return undefined;
  const ways =
    coverage.hangar.ships.length +
    coverage.hangar.ccus.length +
    coverage.buyback.ships.length +
    coverage.buyback.ccus.length;
  return { coverage, covered: Math.min(ids.length, ways), total: ids.length };
}
