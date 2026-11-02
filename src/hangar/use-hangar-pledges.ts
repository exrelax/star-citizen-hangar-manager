import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { hangarSnapshot, shipPricesItem } from './hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from './pledge';
import { toPledgeView, type PledgeView } from './pledge-view';
import { createPriceLookup, type ShipPrices } from './ship-prices';

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

  // The original ship prices are stored separately and arrive on their own schedule.
  let snapshot: HangarSnapshot | null = null;
  let prices: ShipPrices | null = null;
  const apply = () => {
    const current = snapshot?.version === HANGAR_SNAPSHOT_VERSION ? snapshot : null;
    const priceOf = prices ? createPriceLookup(prices.ships) : undefined;
    pledges.value = current
      ? current.pledges.map((pledge, index) =>
          toPledgeView(pledge, current.shipLinks, index, priceOf),
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
  onMounted(async () => {
    [snapshot, prices] = await Promise.all([hangarSnapshot.getValue(), shipPricesItem.getValue()]);
    apply();
  });
  onUnmounted(() => {
    unwatchSnapshot();
    unwatchPrices();
  });

  return { pledges, loaded, syncedAt };
}
