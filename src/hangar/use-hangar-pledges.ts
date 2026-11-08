import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { hangarSnapshot } from './hangar-storage';
import { shipsItem, type ShipsSnapshot } from '@/ships/ships-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from './pledge';
import { toPledgeView, type PledgeView } from './pledge-view';
import { createPriceLookup, shipPricesOf } from './ship-prices';
import { ordersSnapshot } from '@/orders/orders-storage';
import { withOrder, type OrdersSnapshot } from '@/orders/orders';
import { createItemPriceLookup } from '@/store/items/item-prices';
import {
  storeItemsItem,
  STORE_ITEMS_VERSION,
  type StoreItemsSnapshot,
} from '@/store/items/store-items-storage';

/**
 * Pledges of the stored hangar snapshot, kept up to date after each sync.
 * `shallowRef`: the list is replaced as a whole, so Vue doesn't need deep proxies for
 * thousands of pledges.
 */
export function useHangarPledges() {
  const pledges = shallowRef<PledgeView[]>([]);
  const loaded = ref(false);
  /** ISO timestamp of the last full sync. */
  const syncedAt = ref<string>();

  // Ships (their prices) and orders are stored separately and arrive on their own schedule.
  let snapshot: HangarSnapshot | null = null;
  let ships: ShipsSnapshot | null = null;
  let orders: OrdersSnapshot | null = null;
  let storeItems: StoreItemsSnapshot | null = null;
  const apply = () => {
    const current = snapshot?.version === HANGAR_SNAPSHOT_VERSION ? snapshot : null;
    const prices = shipPricesOf(ships);
    const priceOf = prices.length ? createPriceLookup(prices) : undefined;
    const items = storeItems?.version === STORE_ITEMS_VERSION ? storeItems.items : [];
    const itemPriceOf = items.length ? createItemPriceLookup(items) : undefined;
    pledges.value = current
      ? current.pledges.map((pledge, index) =>
          withOrder(toPledgeView(pledge, current.shipLinks, index, priceOf, itemPriceOf), orders),
        )
      : [];
    syncedAt.value = current?.syncedAt;
    loaded.value = true;
  };

  const unwatchSnapshot = hangarSnapshot.watch((value) => {
    snapshot = value;
    apply();
  });
  const unwatchPrices = shipsItem.watch((value) => {
    ships = value;
    apply();
  });
  const unwatchOrders = ordersSnapshot.watch((value) => {
    orders = value;
    apply();
  });
  // The items of the Pledge Store: original prices of everything that is no ship.
  const unwatchStoreItems = storeItemsItem.watch((value) => {
    storeItems = value;
    apply();
  });
  onMounted(async () => {
    [snapshot, ships, orders, storeItems] = await Promise.all([
      hangarSnapshot.getValue(),
      shipsItem.getValue(),
      ordersSnapshot.getValue(),
      storeItemsItem.getValue(),
    ]);
    apply();
  });
  onUnmounted(() => {
    unwatchSnapshot();
    unwatchPrices();
    unwatchOrders();
    unwatchStoreItems();
  });

  return { pledges, loaded, syncedAt };
}
