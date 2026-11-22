import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import type { StoreCatalog } from './store-status';

/** The stored Pledge Store data as a `StoreCatalog`, e.g. for the background script (#472). */
export async function loadStoreCatalog(): Promise<StoreCatalog> {
  const [ships, buyable, warbonds, items] = await Promise.all([
    shipsItem.getValue(),
    buyableShipsItem.getValue(),
    warbondsItem.getValue(),
    storeItemsItem.getValue(),
  ]);
  return {
    ships: current(ships)?.ships,
    buyable: current(buyable)?.skus,
    warbonds: current(warbonds)?.warbonds,
    items: items?.version === STORE_ITEMS_VERSION ? items.items : undefined,
  };
}

/** Calls `callback` whenever a part of the stored Pledge Store data changes. */
export function watchStoreCatalog(callback: () => void): () => void {
  const stops = [shipsItem, buyableShipsItem, warbondsItem, storeItemsItem].map((item) =>
    item.watch(callback),
  );
  return () => stops.forEach((stop) => stop());
}
