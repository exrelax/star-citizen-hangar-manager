import type { Ship, ShipSku, WarbondSku } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import type { WatchItemRef } from './watchlists';

/*
 * Where a Pledge Store item of a watchlist stands now (#470): its price and whether it can be bought,
 * from what the Hangar Manager knows of the store – the upgrade tool's ships, the ships on sale and
 * their warbond editions, and the store's items (for paints). Unknown while that wasn't read.
 *
 * - A CCU costs the standard price difference of its ships and can be bought while its target ship
 *   is on sale; with a warbond edition of the target it costs less for new money. RSI can't sell it
 *   at all once its base ship costs as much as the target (#207).
 * - A standalone ship costs its standard price while it is on sale, less as warbond edition.
 * - A paint costs its price in the store, its sale price if it has one.
 */

/** What is known of the Pledge Store; each part is missing while it wasn't read. */
export interface StoreCatalog {
  ships?: readonly Ship[];
  buyable?: readonly ShipSku[];
  warbonds?: readonly WarbondSku[];
  items?: readonly StoreItem[];
}

export interface StoreStatus {
  /** The price of one in USD now; none while unknown. */
  price?: number;
  /** The price of one as warbond edition, for new money only, while one is offered. */
  warbondPrice?: number;
  /** Whether it can be bought now; none while unknown. */
  onSale?: boolean;
  /** RSI can't sell it at all: a CCU whose base costs as much as its target or more. */
  impossible?: boolean;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function storeStatus(item: WatchItemRef, catalog: StoreCatalog): StoreStatus {
  const ship = (id: number) => catalog.ships?.find((candidate) => candidate.id === id);
  const onSale = (shipId: number) =>
    catalog.buyable ? catalog.buyable.some((sku) => sku.shipId === shipId) : undefined;
  const warbond = (shipId: number) => catalog.warbonds?.find((sku) => sku.shipId === shipId);
  const known = <T extends object>(status: T) =>
    Object.fromEntries(Object.entries(status).filter(([, value]) => value !== undefined)) as T;

  switch (item.kind) {
    case 'storePaint': {
      if (!catalog.items) return {};
      const paint = catalog.items.find((candidate) => candidate.id === item.skuId);
      if (!paint) return { onSale: false };
      return { price: paint.discountedPrice ?? paint.price, onSale: paint.available };
    }
    case 'storeShip': {
      const target = ship(item.shipId);
      const offer = warbond(item.shipId);
      return known({
        price: target && target.msrp > 0 ? target.msrp : undefined,
        warbondPrice: offer?.price,
        onSale: onSale(item.shipId),
      });
    }
    case 'storeCcu': {
      const from = ship(item.fromShipId);
      const to = ship(item.toShipId);
      if (!from || !to || !(from.msrp > 0) || !(to.msrp > 0)) return {};
      if (from.msrp >= to.msrp) return { impossible: true, onSale: false };
      const offer = warbond(item.toShipId);
      return known({
        price: round(to.msrp - from.msrp),
        warbondPrice: offer && offer.price > from.msrp ? round(offer.price - from.msrp) : undefined,
        onSale: onSale(item.toShipId),
      });
    }
    default:
      return {};
  }
}
