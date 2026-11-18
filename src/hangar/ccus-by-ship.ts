import type { BuybackView } from '@/buyback/buyback-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import type { PledgeView } from '@/hangar/pledge-view';
import { ccuShips } from '@/hangar/upgrade-log';
import type { Ship } from '@/ships/ships';
import { createShipLookup } from '@/store/warbond';

/*
 * The CCUs of the hangar and the buy back from and to each of some ships (#287), shared by the
 * ship removals (#285) and the table of all ships (#385):
 * - **from**: the ship is the CCU's base ship; **to**: its target ship.
 *
 * Ships are matched by the upgrade tool's id: a buy back CCU names it on its "Buy Back" button
 * (`fromShipId`, `toShipId`); otherwise, and in My Hangar, the name is looked up in the upgrade
 * tool's ships, which knows RSI's other names ("Constellation Andromeda" is the "Constellation
 * Mk IV Andromeda"). Without the upgrade tool's ships, the names are compared with the ships'
 * own names the same way. Buy back CCUs RSI can't sell again (#207) are left out: they can't be
 * bought back.
 */

/** A CCU of the hangar or the buy back, by its pledge. */
export interface ShipCcu {
  source: 'hangar' | 'buyback';
  /** The pledge's id in My Hangar or the buy back. */
  id: number;
  title: string;
}

export interface ShipCcus {
  /** CCUs with the ship as base ship. */
  from: ShipCcu[];
  /** CCUs with the ship as target ship. */
  to: ShipCcu[];
}

export interface CcusByShipInput {
  /** The ships to count for, by the upgrade tool's id. */
  targets: readonly Pick<Ship, 'id' | 'name'>[];
  /** The upgrade tool's ships, for their ids and RSI's other names; may be empty. */
  ships: readonly Ship[];
  hangar: readonly Pick<PledgeView, 'id' | 'title' | 'isCcu' | 'upgrade'>[];
  buyback: readonly Pick<BuybackView, 'id' | 'title' | 'isCcu' | 'upgrade' | 'unavailable'>[];
}

/** How many CCUs of a list are in the hangar, or in the buy back. */
export const ccusIn = (list: readonly ShipCcu[], source: ShipCcu['source']): number =>
  list.filter((ccu) => ccu.source === source).length;

/** The CCUs from and to each of `targets`, by its id; every target has an entry. */
export function ccusByShip(input: CcusByShipInput): Map<number, ShipCcus> {
  const result = new Map(input.targets.map((ship) => [ship.id, { from: [], to: [] } as ShipCcus]));
  if (!input.targets.length) return result;
  const shipLookup = createShipLookup(input.ships);
  // The lookup hands back the entry it found, so the entry carries its id.
  type Named = { name: string; price: number; id: number };
  const ownNames = createPriceLookup(
    input.targets.map((ship): Named => ({ name: ship.name, price: 0, id: ship.id })),
  );

  /** The id of a CCU's ship among the targets, by the upgrade tool's id, else by name. */
  const idOf = (id: number | undefined, name: string | undefined) => {
    if (id !== undefined) return result.has(id) ? id : undefined;
    if (!name) return undefined;
    const shipId = shipLookup.shipOf(name)?.id;
    if (shipId !== undefined) return result.has(shipId) ? shipId : undefined;
    return (ownNames(name) as Named | undefined)?.id;
  };
  const add = (ccu: ShipCcu, from: number | undefined, to: number | undefined) => {
    if (from !== undefined) result.get(from)!.from.push(ccu);
    if (to !== undefined) result.get(to)!.to.push(ccu);
  };

  for (const pledge of input.hangar) {
    if (!pledge.isCcu) continue;
    const names = ccuShips(pledge.title);
    const from = pledge.upgrade?.matchItems[0]?.name ?? names?.from;
    const to = pledge.upgrade?.targetItems[0]?.name ?? names?.to;
    const ccu = { source: 'hangar' as const, id: pledge.id, title: pledge.title };
    add(ccu, idOf(undefined, from), idOf(undefined, to));
  }
  for (const pledge of input.buyback) {
    if (!pledge.isCcu || pledge.unavailable) continue;
    const names = ccuShips(pledge.title);
    const ccu = { source: 'buyback' as const, id: pledge.id, title: pledge.title };
    add(
      ccu,
      idOf(pledge.upgrade?.fromShipId, names?.from),
      idOf(pledge.upgrade?.toShipId, names?.to),
    );
  }
  return result;
}
