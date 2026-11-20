import { isForOwnedShip, ownedShips, paintShipWords } from '@/hangar/paint-ships';
import type { StoreItem } from '@/store/items/store-items';
import type { DemoCatalog } from './catalog';
import type { DemoPledge } from './generate-hangar';

/*
 * The paints of the demo for the filter "Paints" by owned ships (#336, #337): paints of the
 * Pledge Store chosen so that each case shows, in the demo hangar and the demo buy back alike.
 * Only store items and the ship catalog: the demo's own ships decide which paint fits.
 */

/** The cases, in the order the demo's paint pledges take them. */
export const PAINT_CASES = [
  /** For a standalone ship of the hangar. */
  'standalone',
  /** For the ship of a game package. */
  'package',
  /** For the current ship of a pledge with applied upgrades. */
  'upgraded',
  /** For a series of ships, one of them in the hangar. */
  'series',
  /** For a ship that is only the base of a CCU, not in the hangar. */
  'ccuBase',
  /** For a ship not in the hangar. */
  'notOwned',
  /** Without a ship to match: counts as one for ships not owned. */
  'unmatched',
] as const;
export type PaintCase = (typeof PAINT_CASES)[number];

/** The demo's ships the cases depend on, by their names. */
export interface PaintCaseShips {
  standalone: readonly string[];
  package: readonly string[];
  upgraded: readonly string[];
  /** The ships of the hangar's other pledges, e.g. packs: owned, but no case of their own. */
  other: readonly string[];
  /** The base ships of the hangar's CCUs. */
  ccuBases: readonly string[];
  /** Every ship of the catalog, for paints fitting several ships. */
  catalog: readonly string[];
}

/**
 * One paint of the store per case, each a different one; a case without a fitting paint is left
 * out. All ships of `ships` but the catalog's count as owned.
 */
export function demoPaintCases(
  paints: readonly StoreItem[],
  ships: PaintCaseShips,
): Map<PaintCase, StoreItem> {
  const owned = ownedShips([
    ...ships.standalone,
    ...ships.package,
    ...ships.upgraded,
    ...ships.other,
  ]);
  const fits = (paint: StoreItem, names: readonly string[]) =>
    isForOwnedShip([paint.name], ownedShips(names));
  const isOwned = (paint: StoreItem) => isForOwnedShip([paint.name], owned);
  const readable = (paint: StoreItem) => paintShipWords(paint.name) !== undefined;
  const fitsOne = (names: readonly string[]) => (paint: StoreItem) =>
    names.some((name) => fits(paint, [name]));
  const tests: Record<PaintCase, (paint: StoreItem) => boolean> = {
    standalone: fitsOne(ships.standalone),
    package: fitsOne(ships.package),
    upgraded: fitsOne(ships.upgraded),
    series: (paint) =>
      readable(paint) &&
      isOwned(paint) &&
      ships.catalog.filter((name) => fits(paint, [name])).length > 1,
    ccuBase: (paint) => !isOwned(paint) && fitsOne(ships.ccuBases)(paint),
    notOwned: (paint) => readable(paint) && !isOwned(paint),
    unmatched: (paint) => !readable(paint) && !isOwned(paint),
  };
  const chosen = new Map<PaintCase, StoreItem>();
  const used = new Set<number>();
  for (const name of PAINT_CASES) {
    const paint = paints.find((entry) => !used.has(entry.id) && tests[name](entry));
    if (!paint) continue;
    chosen.set(name, paint);
    used.add(paint.id);
  }
  return chosen;
}

/** The ships of the generated hangar the cases depend on. */
export function paintCaseShips(
  pledges: readonly DemoPledge[],
  catalog: DemoCatalog,
): PaintCaseShips {
  const shipsOf = (list: readonly DemoPledge[]) =>
    list.flatMap((pledge) =>
      pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title),
    );
  return {
    standalone: shipsOf(pledges.filter((p) => p.demoKind === 'ships' && !p.isUpgraded)),
    package: shipsOf(pledges.filter((p) => p.demoKind === 'packages')),
    upgraded: shipsOf(pledges.filter((p) => p.isUpgraded)),
    other: shipsOf(
      pledges.filter((p) => !p.isUpgraded && p.demoKind !== 'ships' && p.demoKind !== 'packages'),
    ),
    ccuBases: pledges.flatMap((p) =>
      p.demoKind === 'ccus' ? (p.upgrade?.matchItems[0]?.name ?? []) : [],
    ),
    catalog: catalog.ships.map((ship) => ship.name),
  };
}

/** The store's paints the cases choose from. */
export const storePaints = (catalog: DemoCatalog) =>
  catalog.items.filter((entry) => entry.category === 'Paints' && entry.price > 0);
