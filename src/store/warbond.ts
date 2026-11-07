import { PLEDGE_STORE } from '@/config';
import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { createPriceLookup, type PledgeDiscount, type ShipPrice } from '@/hangar/ship-prices';

/*
 * Warbond CCUs of the pledge store. RSI's ship upgrade tool lists a "Warbond Edition" SKU for some
 * ships: the ship for less than its standard price (msrp), paid with new money. A CCU to it costs
 * the warbond price minus the msrp of the ship it starts from, and RSI offers it from every ship
 * whose msrp is below the warbond price. The discount is the same from every ship, so the cheapest
 * CCU – from the most expensive of these ships – gets it for the least money.
 *
 * Whatever ship it starts from, a warbond CCU always spans the prices from the warbond price to the
 * msrp. A CCU of the hangar that overlaps this span can't be chained with any of them; CCUs ending
 * at or below the warbond price can (e.g. one to the ship the warbond CCU starts from).
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

/** How often a ship is in the hangar and the buy back: as ship, and as target of a CCU. */
export interface Holdings {
  hangarShips: number;
  hangarCcus: number;
  buybackShips: number;
  buybackCcus: number;
}

/** A ship to start a warbond CCU from. */
export interface BaseShip {
  ship: StoreShip;
  /** Price of the CCU from this ship to the warbond. */
  ccuPrice: number;
  holdings: Holdings;
}

/** CCUs of the hangar with the same ships and value (several pledges form one entry). */
export interface OwnedCcu {
  title: string;
  from: ShipPrice;
  to: ShipPrice;
  /** Pledge ids, newest first. */
  ids: number[];
  valueUsd: number;
  discount?: PledgeDiscount;
}

export interface WarbondOffer {
  target: WarbondTarget;
  /** `msrp - price` in USD. */
  discount: number;
  /** `discount` in percent of the msrp. */
  percent: number;
  /** The ships with the cheapest CCUs to the warbond, cheapest CCU first. */
  bases: BaseShip[];
  /** CCUs of the hangar overlapping the span of every warbond CCU (warbond price to msrp). */
  owned: OwnedCcu[];
}

const NO_HOLDINGS: Holdings = { hangarShips: 0, hangarCcus: 0, buybackShips: 0, buybackCcus: 0 };

/** The ships with the cheapest CCUs to the warbond: the most expensive ones below its price. */
export function cheapestBases(
  ships: readonly StoreShip[],
  target: WarbondTarget,
  holdings: ReadonlyMap<number, Holdings> = new Map(),
  count: number = PLEDGE_STORE.baseShips,
): BaseShip[] {
  return ships
    .filter((ship) => ship.id !== target.ship.id && ship.msrp > 0 && ship.msrp < target.price)
    .sort((a, b) => b.msrp - a.msrp || a.name.localeCompare(b.name))
    .slice(0, count)
    .map((ship) => ({
      ship,
      ccuPrice: round(target.price - ship.msrp),
      holdings: holdings.get(ship.id) ?? NO_HOLDINGS,
    }));
}

/** Finds the upgrade tool's ship for a ship name of the hangar or the buy back. */
export function createShipLookup(ships: readonly StoreShip[]) {
  const prices = ships.map(({ name, msrp }) => ({ name, price: msrp }));
  const shipOf = new Map(prices.map((price, index) => [price, ships[index]!]));
  const priceOf = createPriceLookup(prices);
  return {
    priceOf,
    shipOf: (name: string) => {
      const price = priceOf(name);
      return price && shipOf.get(price);
    },
  };
}

type ShipLookup = ReturnType<typeof createShipLookup>;

/** "Upgrade - Mercury to Eclipse Warbond Edition" → "Eclipse". */
const CCU_TARGET = /\bto\s+(.+?)(?:\s+(?:warbond|standard)\s+edition)?\s*$/i;

/** How often each ship (by the upgrade tool's id) is in the hangar and the buy back. */
export function holdingsByShip(
  lookup: ShipLookup,
  hangar: readonly PledgeView[],
  buyback: readonly BuybackView[],
): Map<number, Holdings> {
  const holdings = new Map<number, Holdings>();
  const add = (id: number | undefined, key: keyof Holdings) => {
    if (id === undefined) return;
    const entry = holdings.get(id) ?? { ...NO_HOLDINGS };
    entry[key]++;
    holdings.set(id, entry);
  };

  for (const pledge of hangar) {
    if (pledge.isCcu) {
      const target = pledge.upgrade?.targetItems[0]?.name;
      add(target ? lookup.shipOf(target)?.id : undefined, 'hangarCcus');
      continue;
    }
    // Each ship once per pledge; an upgraded pledge lists its current ship.
    const names = pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title);
    const ids = new Set(names.map((name) => lookup.shipOf(name)?.id));
    for (const id of ids) add(id, 'hangarShips');
  }

  for (const pledge of buyback) {
    if (pledge.isCcu) {
      // The buy back button names the upgrade tool's ship; without it, the title does.
      const name = CCU_TARGET.exec(pledge.title)?.[1];
      add(pledge.upgrade?.toShipId ?? (name ? lookup.shipOf(name)?.id : undefined), 'buybackCcus');
      continue;
    }
    const ids = new Set(pledge.ships.map((ship) => lookup.shipOf(ship.name)?.id));
    for (const id of ids) add(id, 'buybackShips');
  }
  return holdings;
}

/**
 * CCUs of the hangar whose price span overlaps the given one, grouped by their title and value,
 * in order of their target's price. Their ships are matched by name with the upgrade tool's prices.
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

    const key = `${pledge.title}|${pledge.valueUsd}`;
    const group = groups.get(key);
    if (group) group.ids.push(pledge.id);
    else {
      groups.set(key, {
        title: pledge.title,
        from,
        to,
        ids: [pledge.id],
        valueUsd: pledge.valueUsd,
        discount: pledge.discount,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.to.price - b.to.price || a.from.price - b.from.price || a.valueUsd - b.valueUsd,
  );
}

/**
 * How many of the hangar's colliding CCUs end at the warbond ship itself, and how many end at
 * other ships (counting every pledge).
 */
export function ownedCounts(offer: Pick<WarbondOffer, 'target' | 'owned'>) {
  let sameShip = 0;
  let others = 0;
  for (const ccu of offer.owned) {
    if (ccu.to.name === offer.target.ship.name) sameShip += ccu.ids.length;
    else others += ccu.ids.length;
  }
  return { sameShip, others };
}

/** The warbond offers with their cheapest CCUs and the hangar's CCUs that collide with them. */
export function buildWarbondOffers(
  data: StoreData,
  hangar: readonly PledgeView[],
  buyback: readonly BuybackView[] = [],
): WarbondOffer[] {
  const lookup = createShipLookup(data.ships);
  const holdings = holdingsByShip(lookup, hangar, buyback);
  return data.warbonds
    .map((target): WarbondOffer => {
      const discount = round(target.ship.msrp - target.price);
      return {
        target,
        discount,
        percent: (discount / target.ship.msrp) * 100,
        bases: cheapestBases(data.ships, target, holdings),
        owned: ownedCcusInRange(hangar, lookup.priceOf, {
          low: target.price,
          high: target.ship.msrp,
        }),
      };
    })
    .sort(
      (a, b) => b.discount - a.discount || a.target.ship.name.localeCompare(b.target.ship.name),
    );
}

const round = (value: number) => Math.round(value * 100) / 100;
