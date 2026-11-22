import { hasSeveralItems, mainItem, type BuybackPledge } from '@/buyback/buyback';
import { i18n } from '@/i18n';
import { nameKey } from '@/price-increases/price-increase-match';
import type { RefinementOption } from './filters';
import type { Ship } from '@/ships/ships';
import type { Pledge, PledgeItem } from './pledge';

/*
 * Ship pledges by what they hold besides the ship (#514), for the refinement of the filter "Ships"
 * (#419):
 *
 * - `solo`: one ship and nothing else but insurance and a hangar (e.g. "Self-Land Hangar");
 * - `extras`: one ship and more, e.g. gear, paints, components or game access (a starter package);
 * - `pack`: two ships or more, with extras or without.
 *
 * It goes by the items a pledge holds today, so an upgraded pledge counts by its current ships. In
 * My Hangar a ship is an item of kind "Ship". The buy back lists only the names of the items, so a
 * ship there is the one named in "Contained" and every other item named like a ship of the catalog
 * or of the hangar; a buy back pledge whose items weren't read (#334) has no kind.
 */

export const SHIP_KINDS = ['solo', 'extras', 'pack'] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

/** Insurance and a hangar come with a ship: they don't make it one with extras. */
export const isShipBaseItem = (title: string): boolean =>
  /\binsurance\b/i.test(title) || /\bhangar$/i.test(title.trim());

/** The kind by the number of ships and whether there is more than insurance and a hangar. */
export function shipKindOf(ships: number, extras: boolean): ShipKind | undefined {
  if (ships >= 2) return 'pack';
  if (ships === 1) return extras ? 'extras' : 'solo';
  return undefined;
}

/** The kind of a pledge of My Hangar by its items; none without a ship. */
export function pledgeShipKind(items: readonly PledgeItem[]): ShipKind | undefined {
  let ships = 0;
  let extras = false;
  for (const item of items) {
    if (item.kind === 'Ship') ships++;
    else if (item.kind !== 'Insurance' && item.kind !== 'Hangar' && !isShipBaseItem(item.title))
      extras = true;
  }
  return shipKindOf(ships, extras);
}

/** Where the buy back learns which item names are ships. */
export interface ShipNameSources {
  /** The ships of the catalog (upgrade tool). */
  ships?: readonly Pick<Ship, 'name'>[];
  /** The pledges of the stored hangar, whose ship items are named as RSI names them. */
  hangarPledges?: readonly Pick<Pledge, 'items'>[];
}

export type BuybackShipKind = ReturnType<typeof createBuybackShipKind>;

/**
 * The kind of a buy back pledge with a ship (`shipNames`: `buybackShipNames`), by the names of
 * ships known elsewhere: those of the catalog and of the hangar.
 */
export function createBuybackShipKind({ ships = [], hangarPledges = [] }: ShipNameSources) {
  const known = new Set(ships.map((ship) => nameKey(ship.name)));
  for (const pledge of hangarPledges) {
    for (const item of pledge.items) if (item.kind === 'Ship') known.add(nameKey(item.title));
  }
  return (
    pledge: Pick<BuybackPledge, 'contained' | 'items'>,
    shipNames: readonly string[],
  ): ShipKind | undefined => {
    if (!shipNames.length) return undefined;
    if (!hasSeveralItems(pledge)) return 'solo';
    if (!pledge.items?.length) return undefined;
    const main = mainItem(pledge);
    let ships = 1;
    let extras = false;
    for (const item of pledge.items) {
      if (item === main || isShipBaseItem(item)) continue;
      if (known.has(nameKey(item))) ships++;
      else extras = true;
    }
    return shipKindOf(ships, extras);
  };
}

/** The refinement of the filter "Ships" (#514): all ships, solo ships, with extras, ship packs. */
export function shipKindRefinement<T>(
  kindOf: (entry: T) => ShipKind | undefined,
): RefinementOption<T>[] {
  return [
    { id: 'all', label: i18n.t('filter.shipKind.all') },
    {
      id: 'solo',
      label: i18n.t('filter.shipKind.solo'),
      short: i18n.t('filter.shipKind.soloShort'),
      matches: (entry) => kindOf(entry) === 'solo',
    },
    {
      id: 'extras',
      label: i18n.t('filter.shipKind.extras'),
      short: i18n.t('filter.shipKind.extrasShort'),
      matches: (entry) => kindOf(entry) === 'extras',
    },
    {
      id: 'pack',
      label: i18n.t('filter.shipKind.pack'),
      short: i18n.t('filter.shipKind.packShort'),
      matches: (entry) => kindOf(entry) === 'pack',
    },
  ];
}
