import type { RefinementOption } from '@/hangar/filters';
import { i18n } from '@/i18n';
import type { Ship } from '@/ships/ships';
import type { AlwaysAvailableList } from './always-available';
import type { CcuCoverage, CoverageMatch } from './coverage';
import type { ShipRemoval } from '@/ship-removals/ship-removals';

/*
 * The CCU Consultant's list (#113): every CCU of the hangar by how its base ship is covered (#108),
 * grouped by base ship. A CCU stands where its best cover is:
 * - `hangar`: the hangar gives the base ship;
 * - `buyback`: only the buy back does – buying it back costs its price or a token;
 * - `always`: nothing does, but the ship is always available in the Pledge Store (#110, by the
 *   list the settings choose; never while "Consider always available ships" is off);
 * - `missing`: nothing does, and the ship probably can't be bought whenever needed.
 *
 * Among the `missing` ones, those whose base ship leaves the Pledge Store but can still be had now
 * (#454, on sale or always available until its date) stand apart as "Soon without base ship": the
 * list of always available ships passed here leaves these ships out (`withoutLeaving`).
 */

export type CcuStanding = 'hangar' | 'buyback' | 'always' | 'missing';
/** The groups the consultant lists; CCUs covered by the hangar need nothing. */
export type BaseShipGroup = Exclude<CcuStanding, 'hangar'>;
export const BASE_SHIP_GROUPS: readonly BaseShipGroup[] = ['missing', 'buyback', 'always'];

/** A base ship with the CCUs from it of one group. */
export interface BaseShipRow {
  key: string;
  /** None if the CCU's title doesn't tell it. */
  name?: string;
  shipId?: number;
  /** The CCUs from it (their pledge ids in My Hangar). */
  ccus: number[];
  /** Its standard price from the upgrade tool. */
  price?: number;
  /** Its page in the Pledge Store, from the upgrade tool. */
  link?: string;
  /** In the group `buyback`: what the buy back has of it, ships first. */
  matches: CoverageMatch[];
  /** In the section "Soon without base ship" (#454): when it leaves the Pledge Store. */
  removal?: ShipRemoval;
}

export interface BaseShipList {
  /** CCUs per standing; all of them add up to `total`. Those of `soon` count as `missing`. */
  counts: Record<CcuStanding, number>;
  total: number;
  /** Without those of `soon`. */
  groups: Record<BaseShipGroup, BaseShipRow[]>;
  /**
   * CCUs without base ship whose base ship leaves the Pledge Store but can still be had now (#454),
   * by base ship: the next date first.
   */
  soon: BaseShipRow[];
  /** How many CCUs `soon` has. */
  soonCount: number;
}

/** Where a CCU stands by its coverage and the list of always available ships (if considered). */
export function standingOf(
  coverage: CcuCoverage,
  always: AlwaysAvailableList | undefined,
): CcuStanding {
  if (coverage.hangar.ships.length || coverage.hangar.ccus.length) return 'hangar';
  if (coverage.covered) return 'buyback';
  const id = coverage.baseShip?.id;
  return id !== undefined && always?.has(id) ? 'always' : 'missing';
}

/** The CCUs by standing, each group by base ship – most CCUs first, then by name. */
export function baseShipList(
  coverages: Iterable<CcuCoverage>,
  always: AlwaysAvailableList | undefined,
  ships: readonly Ship[],
  /** The ships leaving the Pledge Store that can still be had now (#454), by ship id. */
  leaving: ReadonlyMap<number, ShipRemoval> = new Map(),
): BaseShipList {
  const byId = new Map(ships.map((ship) => [ship.id, ship]));
  const counts: Record<CcuStanding, number> = { hangar: 0, buyback: 0, always: 0, missing: 0 };
  const rows: Record<BaseShipGroup, Map<string, BaseShipRow>> = {
    missing: new Map(),
    buyback: new Map(),
    always: new Map(),
  };
  const soon = new Map<string, BaseShipRow>();
  let soonCount = 0;
  let total = 0;
  for (const coverage of coverages) {
    total++;
    const standing = standingOf(coverage, always);
    counts[standing]++;
    if (standing === 'hangar') continue;
    const base = coverage.baseShip;
    const key = base?.id !== undefined ? `id:${base.id}` : `name:${base?.name.toLowerCase() ?? ''}`;
    const removal =
      standing === 'missing' && base?.id !== undefined ? leaving.get(base.id) : undefined;
    if (removal) soonCount++;
    const target = removal ? soon : rows[standing];
    let row = target.get(key);
    if (!row) {
      const ship = base?.id !== undefined ? byId.get(base.id) : undefined;
      row = {
        key,
        ...(base && { name: ship?.name ?? base.name }),
        ...(base?.id !== undefined && { shipId: base.id }),
        ccus: [],
        ...(ship && { price: ship.msrp }),
        ...(ship?.link && { link: ship.link }),
        matches: [],
        ...(removal && { removal }),
      };
      target.set(key, row);
    }
    row.ccus.push(coverage.id);
    if (standing === 'buyback') {
      for (const match of [...coverage.buyback.ships, ...coverage.buyback.ccus]) {
        if (!row.matches.some((known) => known.id === match.id)) row.matches.push(match);
      }
    }
  }
  const sorted = (group: BaseShipGroup) =>
    [...rows[group].values()].sort(
      (a, b) =>
        b.ccus.length - a.ccus.length ||
        // A base ship without a name comes last.
        Number(a.name === undefined) - Number(b.name === undefined) ||
        (a.name ?? '').localeCompare(b.name ?? '', 'en'),
    );
  const at = (row: BaseShipRow) => row.removal?.removedAt.at ?? 0;
  return {
    counts,
    total,
    groups: { missing: sorted('missing'), buyback: sorted('buyback'), always: sorted('always') },
    soon: [...soon.values()].sort(
      (a, b) =>
        at(a) - at(b) ||
        b.ccus.length - a.ccus.length ||
        (a.name ?? '').localeCompare(b.name ?? '', 'en'),
    ),
    soonCount,
  };
}

/**
 * The refinement of the filter "CCUs" (#461, #419): all CCUs; those without base ship, by the same
 * rule as the list above and the note on the rows (#114); and – while always available ships are
 * considered – those whose base ship is always available, like the label (#112), and their
 * opposite, those whose base ship is limited: not always available. Covered or not; a CCU whose
 * base ship isn't known is in neither of the two.
 */
export function ccuRefinement<T extends { id: number }>(
  coverages: ReadonlyMap<number, CcuCoverage>,
  always: AlwaysAvailableList | undefined,
): RefinementOption<T>[] {
  const coverageOf = (entry: T) => coverages.get(entry.id);
  const standing = (entry: T) => {
    const coverage = coverageOf(entry);
    return coverage ? standingOf(coverage, always) : undefined;
  };
  /** Whether the base ship is always available; unknown without a list or a base ship. */
  const baseAlways = (entry: T) => {
    const id = coverageOf(entry)?.baseShip?.id;
    return always && id !== undefined ? always.has(id) : undefined;
  };
  return [
    { id: 'all', label: i18n.t('filter.ccuCoverage.all') },
    {
      id: 'missing',
      label: i18n.t('ccuConsultant.standing.missing'),
      matches: (entry) => standing(entry) === 'missing',
    },
    ...(always
      ? [
          {
            id: 'always',
            label: i18n.t('ccuConsultant.standing.always'),
            matches: (entry: T) => baseAlways(entry) === true,
          },
          {
            id: 'limited',
            label: i18n.t('filter.ccuCoverage.limited'),
            matches: (entry: T) => baseAlways(entry) === false,
          },
        ]
      : []),
  ];
}
