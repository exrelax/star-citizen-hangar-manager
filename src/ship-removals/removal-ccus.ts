import { ccusByShip, ccusIn, type CcusByShipInput, type ShipCcu } from '@/hangar/ccus-by-ship';
import { upcomingShipRemovals, type ShipRemoval } from './ship-removals';

/*
 * What a ship removal (#285) means for the CCUs of the hangar and the buy back (#287). A CCU with
 * the removed ship as its base ship can only be applied to a pledge with that ship: once the ship
 * can't be bought any more, it stays usable only with a ship already owned, or with a CCU to the
 * ship. So per removed ship:
 * - the CCUs **from** it (base ship), and
 * - the CCUs **to** it (target ship), which give a ship to apply a CCU from it to. Pledges with
 *   the ship itself don't count here.
 * The level counts the CCUs from the ship in the hangar only: those of the buy back aren't owned
 * and become a problem only when bought back (they are listed, though). **Warning** while there are
 * at least as many CCUs to the ship – hangar and buy back together – as from it in the hangar,
 * else **critical**; none without CCUs from it in the hangar.
 *
 * The CCUs are matched as everywhere in the manager (`ccusByShip`).
 */

export type RemovalLevel = 'warning' | 'critical';

/** A CCU of the hangar or the buy back, by its pledge. */
export type RemovalCcu = ShipCcu;

export interface RemovalCcus {
  removal: ShipRemoval;
  /** CCUs with the removed ship as base ship. */
  from: RemovalCcu[];
  /** CCUs with the removed ship as target ship. */
  to: RemovalCcu[];
  /** None while there are no CCUs from the ship. */
  level?: RemovalLevel;
}

export interface RemovalCcusInput extends Omit<CcusByShipInput, 'targets'> {
  removals: readonly ShipRemoval[];
  now: number;
}

/** How many CCUs of a list are in the hangar. */
export const hangarCcus = (list: readonly RemovalCcu[]): number => ccusIn(list, 'hangar');

/** The level of a removed ship by its CCUs from it in the hangar and to it. */
export const removalLevel = (from: number, to: number): RemovalLevel | undefined =>
  from === 0 ? undefined : to >= from ? 'warning' : 'critical';

/**
 * The upcoming ship removals with the CCUs from and to each ship, the next removal first; every
 * removal is listed, also without CCUs.
 */
export function removalCcus(input: RemovalCcusInput): RemovalCcus[] {
  const upcoming = upcomingShipRemovals(input.removals, input.now);
  const byShip = ccusByShip({ ...input, targets: upcoming.map((removal) => removal.ship) });
  return upcoming.map((removal) => {
    const { from, to } = byShip.get(removal.ship.id)!;
    const level = removalLevel(hangarCcus(from), to.length);
    return { removal, from, to, ...(level && { level }) };
  });
}
