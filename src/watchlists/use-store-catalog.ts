import { buyableShipsItem, current, shipsItem, warbondsItem } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import { computed } from 'vue';
import type { StoreCatalog } from './store-status';

/**
 * What the Hangar Manager knows of the Pledge Store, for the prices and availability of a
 * watchlist's store items (#470): the upgrade tool's ships, those on sale and their warbond
 * editions, and the store's items. The same for every account, so also in the demo mode.
 */
export function useStoreCatalog() {
  const ships = useStored(shipsItem);
  const buyable = useStored(buyableShipsItem);
  const warbonds = useStored(warbondsItem);
  const items = useStored(storeItemsItem);
  return computed((): StoreCatalog => ({
    ships: current(ships.value ?? null)?.ships,
    buyable: current(buyable.value ?? null)?.skus,
    warbonds: current(warbonds.value ?? null)?.warbonds,
    items: items.value?.version === STORE_ITEMS_VERSION ? items.value.items : undefined,
  }));
}
