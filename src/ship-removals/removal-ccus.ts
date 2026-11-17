import type { BuybackView } from '@/buyback/buyback-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import type { PledgeView } from '@/hangar/pledge-view';
import { ccuShips } from '@/hangar/upgrade-log';
import type { Ship } from '@/ships/ships';
import { createShipLookup } from '@/store/warbond';
import { upcomingShipRemovals, type ShipRemoval } from './ship-removals';

/*
 * What a ship removal (#285) means for the CCUs of the hangar and the buy back (#287). A CCU with
 * the removed ship as its base ship can only be applied to a pledge with that ship: once the ship
 * can't be bought any more, it stays usable only with a ship already owned, or with a CCU to the
 * ship. So per removed ship:
 * - the CCUs **from** it (base ship), and
 * - the CCUs **to** it (target ship), which give a ship to apply a CCU from it to. Pledges with
 *   the ship itself don't count here.
 * The level: **warning** while there are at least as many CCUs to the ship as from it, else
 * **critical**; none without CCUs from it.
 *
 * Ships are matched by the upgrade tool's id: a buy back CCU names it on its "Buy Back" button
 * (`fromShipId`, `toShipId`); otherwise, and in My Hangar, the name is looked up in the upgrade
 * tool's ships, which knows RSI's other names ("Constellation Andromeda" is the "Constellation
 * Mk IV Andromeda"). Without the upgrade tool's ships, the names are compared with the removals'
 * own names the same way. Buy back CCUs RSI can't sell again (#207) are left out: they can't be
 * bought back.
 */

export type RemovalLevel = 'warning' | 'critical';

/** A CCU of the hangar or the buy back, by its pledge. */
export interface RemovalCcu {
  source: 'hangar' | 'buyback';
  /** The pledge's id in My Hangar or the buy back. */
  id: number;
  title: string;
}

export interface RemovalCcus {
  removal: ShipRemoval;
  /** CCUs with the removed ship as base ship. */
  from: RemovalCcu[];
  /** CCUs with the removed ship as target ship. */
  to: RemovalCcu[];
  /** None while there are no CCUs from the ship. */
  level?: RemovalLevel;
}

export interface RemovalCcusInput {
  removals: readonly ShipRemoval[];
  /** The upgrade tool's ships, for their ids; may be empty. */
  ships: readonly Ship[];
  hangar: readonly Pick<PledgeView, 'id' | 'title' | 'isCcu' | 'upgrade'>[];
  buyback: readonly Pick<BuybackView, 'id' | 'title' | 'isCcu' | 'upgrade' | 'unavailable'>[];
  now: number;
}

/** The level of a removed ship by its CCUs from and to it. */
export const removalLevel = (from: number, to: number): RemovalLevel | undefined =>
  from === 0 ? undefined : to >= from ? 'warning' : 'critical';

/**
 * The upcoming ship removals with the CCUs from and to each ship, the next removal first; every
 * removal is listed, also without CCUs.
 */
export function removalCcus(input: RemovalCcusInput): RemovalCcus[] {
  const upcoming = upcomingShipRemovals(input.removals, input.now);
  const byId = new Map(upcoming.map((removal) => [removal.ship.id, removal]));
  const shipLookup = createShipLookup(input.ships);
  // The lookup hands back the entry it found, so the entry carries its removal.
  type NamedRemoval = { name: string; price: number; removal: ShipRemoval };
  const ownNames = createPriceLookup(
    upcoming.map((removal): NamedRemoval => ({ name: removal.ship.name, price: 0, removal })),
  );

  /** The removal of a CCU's ship, by the upgrade tool's id, else by name. */
  const removalOf = (id: number | undefined, name: string | undefined) => {
    if (id !== undefined) return byId.get(id);
    if (!name) return undefined;
    const shipId = shipLookup.shipOf(name)?.id;
    if (shipId !== undefined) return byId.get(shipId);
    return (ownNames(name) as NamedRemoval | undefined)?.removal;
  };

  const result = new Map(
    upcoming.map((removal) => [removal, { removal, from: [], to: [] } as RemovalCcus]),
  );
  const add = (ccu: RemovalCcu, from: ShipRemoval | undefined, to: ShipRemoval | undefined) => {
    if (from) result.get(from)!.from.push(ccu);
    if (to) result.get(to)!.to.push(ccu);
  };

  if (upcoming.length) {
    for (const pledge of input.hangar) {
      if (!pledge.isCcu) continue;
      const names = ccuShips(pledge.title);
      const from = pledge.upgrade?.matchItems[0]?.name ?? names?.from;
      const to = pledge.upgrade?.targetItems[0]?.name ?? names?.to;
      const ccu = { source: 'hangar' as const, id: pledge.id, title: pledge.title };
      add(ccu, removalOf(undefined, from), removalOf(undefined, to));
    }
    for (const pledge of input.buyback) {
      if (!pledge.isCcu || pledge.unavailable) continue;
      const names = ccuShips(pledge.title);
      const ccu = { source: 'buyback' as const, id: pledge.id, title: pledge.title };
      add(
        ccu,
        removalOf(pledge.upgrade?.fromShipId, names?.from),
        removalOf(pledge.upgrade?.toShipId, names?.to),
      );
    }
  }

  return [...result.values()].map((entry) => {
    const level = removalLevel(entry.from.length, entry.to.length);
    return level ? { ...entry, level } : entry;
  });
}
