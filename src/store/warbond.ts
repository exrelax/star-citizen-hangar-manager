import { PLEDGE_STORE } from '@/config';
import type { PledgeView } from '@/hangar/pledge-view';
import { createPriceLookup, type PledgeDiscount, type ShipPrice } from '@/hangar/ship-prices';

/*
 * Warbond CCUs of the pledge store. RSI's ship upgrade tool lists a "Warbond Edition" SKU for some
 * ships: the ship for less than its standard price (msrp), paid with new money. A CCU to it costs
 * the warbond price minus the msrp of the ship it starts from, and RSI offers it from every ship
 * whose msrp is below the warbond price. The discount is the same from every ship, so the cheapest
 * CCU – from the most expensive of these ships – gets it for the least money.
 */

/** A ship of RSI's upgrade tool; prices in USD. */
export interface StoreShip {
  /** The upgrade tool's ship id (not the hangar's). */
  id: number;
  name: string;
  /** Standard price. */
  msrp: number;
  image?: string;
}

/** A ship currently offered as warbond edition. */
export interface WarbondTarget {
  ship: StoreShip;
  /** The upgrade tool's id of the warbond SKU. */
  skuId: number;
  /** Warbond price in USD. */
  price: number;
}

/** What the upgrade tool offers: all ships (to start from) and the warbond targets. */
export interface StoreData {
  ships: StoreShip[];
  warbonds: WarbondTarget[];
}

/** Ships to start from that cost the same: their CCUs to the warbond have the same price. */
export interface BaseLevel {
  /** Price of the CCU from one of these ships. */
  ccuPrice: number;
  msrp: number;
  ships: StoreShip[];
}

/** CCUs of the hangar with the same ships (several pledges of the same CCU form one entry). */
export interface OwnedCcu {
  title: string;
  from: ShipPrice;
  to: ShipPrice;
  /** Pledge ids, newest first. */
  ids: number[];
  value: string;
  discount?: PledgeDiscount;
}

export interface WarbondOffer {
  target: WarbondTarget;
  /** `msrp - price` in USD. */
  discount: number;
  /** `discount` in percent of the msrp. */
  percent: number;
  /** The cheapest CCUs to the warbond, cheapest first. */
  bases: BaseLevel[];
  /**
   * The price range the CCUs shown cover: from the cheapest ship they start from to the target's
   * msrp. Unset if no ship is cheap enough.
   */
  range?: { low: number; high: number };
  /** CCUs of the hangar overlapping `range`: they can't be chained with the warbond CCUs shown. */
  owned: OwnedCcu[];
}

/** The levels of ships to start from, cheapest CCU first. */
export function cheapestBases(
  ships: readonly StoreShip[],
  target: WarbondTarget,
  levels: number = PLEDGE_STORE.baseLevels,
): BaseLevel[] {
  const byMsrp = new Map<number, StoreShip[]>();
  for (const ship of ships) {
    if (ship.id === target.ship.id || !(ship.msrp > 0) || ship.msrp >= target.price) continue;
    byMsrp.set(ship.msrp, [...(byMsrp.get(ship.msrp) ?? []), ship]);
  }
  return [...byMsrp.entries()]
    .sort(([a], [b]) => b - a)
    .slice(0, levels)
    .map(([msrp, level]) => ({
      ccuPrice: round(target.price - msrp),
      msrp,
      ships: level.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * CCUs of the hangar whose price range overlaps the given one, grouped by their ships, in order
 * of their target's price. Their ships are matched by name with the upgrade tool's prices.
 */
export function ownedCcusInRange(
  pledges: readonly PledgeView[],
  priceOf: (name: string) => ShipPrice | undefined,
  range: { low: number; high: number },
): OwnedCcu[] {
  const groups = new Map<string, OwnedCcu>();
  for (const pledge of pledges) {
    if (!pledge.isCcu || !pledge.upgrade) continue;
    const fromName = pledge.upgrade.matchItems[0]?.name;
    const toName = pledge.upgrade.targetItems[0]?.name;
    const from = fromName ? priceOf(fromName) : undefined;
    const to = toName ? priceOf(toName) : undefined;
    if (!from || !to || !(from.price < range.high && to.price > range.low)) continue;

    const key = `${pledge.title}|${pledge.value}`;
    const group = groups.get(key);
    if (group) group.ids.push(pledge.id);
    else {
      groups.set(key, {
        title: pledge.title,
        from,
        to,
        ids: [pledge.id],
        value: pledge.value,
        discount: pledge.discount,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.to.price - b.to.price || a.from.price - b.from.price,
  );
}

/** The warbond offers with their cheapest CCUs and the hangar's CCUs in their price range. */
export function buildWarbondOffers(
  data: StoreData,
  pledges: readonly PledgeView[],
): WarbondOffer[] {
  const priceOf = createPriceLookup(data.ships.map(({ name, msrp }) => ({ name, price: msrp })));
  return data.warbonds
    .map((target): WarbondOffer => {
      const discount = round(target.ship.msrp - target.price);
      const bases = cheapestBases(data.ships, target);
      const low = bases.at(-1)?.msrp;
      const range = low === undefined ? undefined : { low, high: target.ship.msrp };
      return {
        target,
        discount,
        percent: (discount / target.ship.msrp) * 100,
        bases,
        range,
        owned: range ? ownedCcusInRange(pledges, priceOf, range) : [],
      };
    })
    .sort(
      (a, b) => b.discount - a.discount || a.target.ship.name.localeCompare(b.target.ship.name),
    );
}

const round = (value: number) => Math.round(value * 100) / 100;
