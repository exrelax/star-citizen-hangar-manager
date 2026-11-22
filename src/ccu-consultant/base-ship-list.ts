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
 * A base ship leaving the Pledge Store that can still be had now (#454, on sale or always available
 * until its date) is counted: each ship or CCU to it gives it to one CCU. With fewer of them than
 * CCUs from it, it stands apart as "Soon without base ship"; its CCUs without any stay out of
 * `missing`. A base ship that isn't always available is counted the same way: with ways to it,
 * but fewer than CCUs from it, it is listed under "Too few ways" – only as long as the ship is
 * sold can the rest get it. The list of always available ships passed here leaves these ships out
 * (`withoutLeaving`).
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
  /**
   * In the group `buyback`: what the buy back has of it, ships first. In `soon` and `tooFew`: the
   * ways to it (#563, the cards of the simple view) – the hangar's, then the buy back's.
   */
  matches: CoverageMatch[];
  /** In the section "Soon without base ship" (#454): when it leaves the Pledge Store. */
  removal?: ShipRemoval;
  /**
   * There: the pledges that give the ship – ships and CCUs to it –, in the hangar and the buy back
   * (only CCUs RSI can sell again); each gives it to one CCU.
   */
  ways?: { hangar: number; buyback: number };
  /** There: how many CCUs from it have no way to the ship once it is gone. */
  short?: number;
}

export interface BaseShipList {
  /** CCUs per standing; all of them add up to `total`. Those of `soon` count as `missing`. */
  counts: Record<CcuStanding, number>;
  total: number;
  /** Without those of `soon`. */
  groups: Record<BaseShipGroup, BaseShipRow[]>;
  /**
   * Base ships leaving the Pledge Store that can still be had now (#454), with fewer ways to them
   * – ships and CCUs to them – than CCUs from them: the next date first. Their CCUs without any
   * way are not in `groups`; those with too few ways are also where their cover puts them.
   */
  soon: BaseShipRow[];
  /** How many CCUs of `soon` have no way to their base ship once it is gone. */
  soonCount: number;
  /**
   * Base ships not always available, with ways to them but fewer than CCUs from them: once the
   * ship isn't sold any more, the rest have no base ship. The most short first.
   */
  tooFew: BaseShipRow[];
  /** How many CCUs of `tooFew` have no way to their base ship. */
  tooFewCount: number;
}

/** The key of a CCU's base ship: the upgrade tool's id where known, else its name. */
export const baseKeyOf = (coverage: Pick<CcuCoverage, 'baseShip'>): string => {
  const base = coverage.baseShip;
  return base?.id !== undefined ? `id:${base.id}` : `name:${base?.name.toLowerCase() ?? ''}`;
};

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
  /**
   * Every base ship that isn't always available – also one leaving the Pledge Store (#454) –, with
   * all CCUs from it, covered or not, and the ways to it.
   */
  const countedRows = new Map<string, BaseShipRow>();
  let total = 0;
  const rowOf = (target: Map<string, BaseShipRow>, key: string, coverage: CcuCoverage) => {
    let row = target.get(key);
    if (!row) {
      const base = coverage.baseShip;
      const ship = base?.id !== undefined ? byId.get(base.id) : undefined;
      row = {
        key,
        ...(base && { name: ship?.name ?? base.name }),
        ...(base?.id !== undefined && { shipId: base.id }),
        ccus: [],
        ...(ship && { price: ship.msrp }),
        ...(ship?.link && { link: ship.link }),
        matches: [],
      };
      target.set(key, row);
    }
    return row;
  };
  for (const coverage of coverages) {
    total++;
    const standing = standingOf(coverage, always);
    counts[standing]++;
    const base = coverage.baseShip;
    const key = baseKeyOf(coverage);
    const removal = base?.id !== undefined ? leaving.get(base.id) : undefined;
    if (removal || (base?.id !== undefined && !always?.has(base.id))) {
      // Each pledge gives the ship to one CCU: the ways to it are counted, not just found.
      const row = rowOf(countedRows, key, coverage);
      if (removal) row.removal = removal;
      row.ccus.push(coverage.id);
      row.ways = {
        hangar: coverage.hangar.ships.length + coverage.hangar.ccus.length,
        buyback: coverage.buyback.ships.length + coverage.buyback.ccus.length,
      };
      row.matches = [
        ...coverage.hangar.ships,
        ...coverage.hangar.ccus,
        ...coverage.buyback.ships,
        ...coverage.buyback.ccus,
      ];
      // A leaving ship without any way is only in `soon`; with too few, also where its cover
      // puts it.
      if (removal && standing === 'missing') continue;
    }
    if (standing === 'hangar') continue;
    const row = rowOf(rows[standing], key, coverage);
    row.ccus.push(coverage.id);
    if (standing === 'buyback') {
      for (const match of [...coverage.buyback.ships, ...coverage.buyback.ccus]) {
        if (!row.matches.some((known) => known.id === match.id)) row.matches.push(match);
      }
    }
  }
  const waysOf = (row: BaseShipRow) => (row.ways ? row.ways.hangar + row.ways.buyback : 0);
  const short = [...countedRows.values()]
    .filter((row) => waysOf(row) < row.ccus.length)
    .map((row) => ({ ...row, short: row.ccus.length - waysOf(row) }));
  const soon = short.filter((row) => row.removal);
  // Without any way the CCUs are already without base ship.
  const tooFew = short.filter((row) => !row.removal && waysOf(row) > 0);
  const shortOf = (list: readonly BaseShipRow[]) =>
    list.reduce((sum, row) => sum + (row.short ?? 0), 0);
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
    soon: soon.sort(
      (a, b) =>
        at(a) - at(b) ||
        (b.short ?? 0) - (a.short ?? 0) ||
        (a.name ?? '').localeCompare(b.name ?? '', 'en'),
    ),
    soonCount: shortOf(soon),
    tooFew: tooFew.sort(
      (a, b) =>
        (b.short ?? 0) - (a.short ?? 0) ||
        b.ccus.length - a.ccus.length ||
        (a.name ?? '').localeCompare(b.name ?? '', 'en'),
    ),
    tooFewCount: shortOf(tooFew),
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
