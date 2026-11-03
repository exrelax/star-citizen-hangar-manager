import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { hangarSnapshot, shipPricesItem } from './hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from './pledge';
import { toPledgeView, type PledgeView } from './pledge-view';
import { createPriceLookup, type ShipPrices } from './ship-prices';
import { ordersSnapshot } from '@/orders/orders-storage';
import { withOrder, type OrdersSnapshot } from '@/orders/orders';

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

  // Ship prices and orders are stored separately and arrive on their own schedule.
  let snapshot: HangarSnapshot | null = null;
  let prices: ShipPrices | null = null;
  let orders: OrdersSnapshot | null = null;
  const apply = () => {
    const current = snapshot?.version === HANGAR_SNAPSHOT_VERSION ? snapshot : null;
    const priceOf = prices ? createPriceLookup(prices.ships) : undefined;
    pledges.value = current
      ? current.pledges.map((pledge, index) =>
          withOrder(toPledgeView(pledge, current.shipLinks, index, priceOf), orders),
        )
      : [];
    syncedAt.value = current?.syncedAt;
    loaded.value = true;
  };

  const unwatchSnapshot = hangarSnapshot.watch((value) => {
    snapshot = value;
    apply();
  });
  const unwatchPrices = shipPricesItem.watch((value) => {
    prices = value;
    apply();
  });
  const unwatchOrders = ordersSnapshot.watch((value) => {
    orders = value;
    apply();
  });
  onMounted(async () => {
    [snapshot, prices, orders] = await Promise.all([
      hangarSnapshot.getValue(),
      shipPricesItem.getValue(),
      ordersSnapshot.getValue(),
    ]);
    apply();
  });
  onUnmounted(() => {
    unwatchSnapshot();
    unwatchPrices();
    unwatchOrders();
  });

  return { pledges, loaded, syncedAt };
}
