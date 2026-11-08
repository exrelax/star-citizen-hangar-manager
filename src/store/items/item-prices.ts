import type { StoreItem } from './store-items';

/*
 * Original prices of the items of the Pledge Store (see `fetch-store-items.ts`), for the discount
 * of pledges that are no ship or CCU: paints, gear, add-ons, packs, game packages, … A pledge is
 * matched by its title without RSI's category prefix ("Paints - Eclipse - Desmodus Paint" →
 * "Eclipse - Desmodus Paint"). Only items the store sells now have a price.
 */

/** The price an item is compared with: its standard price, not a warbond or sale price. */
export interface ItemPrice {
  name: string;
  price: number;
}

/** RSI's category in front of a pledge title: "Paints - …", "Standalone Ship - …", "Gear - …". */
const CATEGORY_PREFIX =
  /^(?:paints?|gear|add-ons?|packs?|packages?|standalone ships?|subscribers? store|gift cards?|digital goodies pack)\s+-\s+/i;

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The item's name a pledge title would have in the store. */
export const storeNameOf = (title: string) => normalize(title.replace(CATEGORY_PREFIX, ''));

/**
 * Finds the standard price of a pledge by its title. Several items of one name (a standard and a
 * warbond edition) give the highest price: the standard one.
 */
export function createItemPriceLookup(items: readonly StoreItem[]) {
  const byName = new Map<string, ItemPrice>();
  for (const item of items) {
    const key = normalize(item.name);
    const known = byName.get(key);
    if (!known || item.price > known.price) byName.set(key, { name: item.name, price: item.price });
  }
  return (title: string): ItemPrice | undefined => byName.get(storeNameOf(title));
}

export type ItemPriceLookup = ReturnType<typeof createItemPriceLookup>;
