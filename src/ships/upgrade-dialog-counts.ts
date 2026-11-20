import { buybackShipNames, type BuybackPledge } from '@/buyback/buyback';
import { createAvailabilityCheck } from '@/buyback/buyback-availability';
import type { Pledge } from '@/hangar/pledge';
import { createShipLookup, holdingsByShip } from '@/store/warbond';
import type { Ship } from './ships';
import type { UpgradeTarget } from './upgrade-dialog-labels';

/*
 * The counts on the base ships of RSI's ship upgrade dialog (#506): how often the hangar has each
 * ship, and how many CCUs to it the hangar and the buy back have – each gives the ship to one CCU
 * from it (#454). From the stored hangar and buy back, counted as everywhere in the manager
 * (`holdingsByShip`); buy back CCUs RSI can't sell again (#207) don't count.
 */

/** What gives a base ship: pledges with it in the hangar, CCUs to it in the hangar and buy back. */
export interface BaseShipCounts {
  owned: number;
  hangarCcus: number;
  /** Unset without a stored buy back: then it isn't known. */
  buybackCcus?: number;
}

export interface BaseShipCountsInput {
  /** The upgrade tool's ships, for their ids and RSI's other names. */
  ships: readonly Ship[];
  /** The stored hangar's pledges; none without a stored hangar. */
  hangar?: readonly Pledge[];
  /** The stored buy back's pledges; none without a stored buy back. */
  buyback?: readonly BuybackPledge[];
}

/**
 * The counts of a ship of the dialog, by RSI's id, else by its name; none for a ship the upgrade
 * tool doesn't know or without a stored hangar.
 */
export function createBaseShipCounts(
  input: BaseShipCountsInput,
): (target: UpgradeTarget) => BaseShipCounts | undefined {
  if (!input.hangar) return () => undefined;
  const lookup = createShipLookup(input.ships);
  const known = new Set(input.ships.map((ship) => ship.id));
  const available = createAvailabilityCheck(input.ships);
  const holdings = holdingsByShip(
    lookup,
    input.hangar.map((pledge) => ({
      isCcu: pledge.upgrade !== undefined,
      upgrade: pledge.upgrade,
      items: pledge.items,
    })),
    (input.buyback ?? [])
      .filter((pledge) => !available(pledge))
      .map((pledge) => ({
        isCcu: pledge.isUpgrade,
        upgrade: pledge.upgrade,
        title: pledge.title,
        ships: buybackShipNames(pledge).map((name) => ({ name })),
      })),
  );
  const hasBuyback = input.buyback !== undefined;
  return ({ id, name }) => {
    const shipId =
      id !== undefined && known.has(id) ? id : name ? lookup.shipOf(name)?.id : undefined;
    if (shipId === undefined) return undefined;
    const entry = holdings.get(shipId);
    return {
      owned: entry?.hangarShips ?? 0,
      hangarCcus: entry?.hangarCcus ?? 0,
      ...(hasBuyback && { buybackCcus: entry?.buybackCcus ?? 0 }),
    };
  };
}
