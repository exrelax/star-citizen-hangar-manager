/*
 * The items of RSI's Pledge Store: ships, gear, packs, paints, … – the same for every account.
 * Read with the store's own search (`fetch-store-items.ts`) and kept in a storage of their own
 * (`store-items-storage.ts`). Not shown anywhere yet.
 */

/** An item (SKU) of the Pledge Store; prices in USD without taxes. */
export interface StoreItem {
  /** RSI's SKU id. */
  id: number;
  name: string;
  /** The product it belongs to, e.g. "Standalone Ships", "Paints". */
  category: string;
  price: number;
  /** The price on sale, if the item is discounted. */
  discountedPrice?: number;
  isWarbond: boolean;
  /** Whether it can be bought now (in stock). */
  available: boolean;
  image?: string;
  /** Path of its page, e.g. "/pledge/Standalone-Ships/Avenger-Titan". */
  link?: string;
}

/** A SKU as the store's search returns it (prices in cents). */
export interface ApiStoreSku {
  id: string | number;
  name?: string | null;
  title?: string | null;
  url?: string | null;
  media?: { thumbnail?: { storeSmall?: string | null } | null } | null;
  nativePrice?: { amount?: number | null; discounted?: number | null } | null;
  stock?: { available?: boolean | null } | null;
  isWarbond?: boolean | null;
}

/** The store item of a SKU of the search, in `category`. */
export function toStoreItem(sku: ApiStoreSku, category: string): StoreItem | undefined {
  const id = Number(sku.id);
  const name = (sku.name ?? sku.title ?? '').trim();
  const cents = sku.nativePrice?.amount;
  if (!Number.isInteger(id) || !name || typeof cents !== 'number') return undefined;
  const item: StoreItem = {
    id,
    name,
    category,
    price: cents / 100,
    isWarbond: sku.isWarbond === true,
    available: sku.stock?.available !== false,
  };
  const discounted = sku.nativePrice?.discounted;
  if (typeof discounted === 'number' && discounted < cents) item.discountedPrice = discounted / 100;
  const image = sku.media?.thumbnail?.storeSmall;
  if (image) item.image = image;
  if (sku.url) item.link = sku.url;
  return item;
}
