import { current, shipsItem, warbondsItem, warbondsMeta } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
import type { ShipsSnapshot, WarbondsSnapshot } from '@/ships/ships-storage';
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { StoreData, WarbondTarget } from './warbond';
import { WARBOND_HISTORY_VERSION, type WarbondHistorySnapshot } from './warbond-history';
import { withSiteSightings } from './site-warbond-history';
import {
  siteWarbondHistoryItem,
  storedSiteWarbondHistory,
  warbondHistoryItem,
} from './warbond-history-storage';

/**
 * The stored ships and warbond editions of the upgrade tool (see `src/ships`) and the warbond
 * offers seen so far (#4) with the earlier ones of the project website, as the Pledge Store tab
 * uses them, kept up to date after each refresh.
 */
export function useStoreData() {
  const ships = shallowRef<ShipsSnapshot | null>(null);
  const warbonds = shallowRef<WarbondsSnapshot | null>(null);
  const history = shallowRef<WarbondHistorySnapshot | null>(null);
  const site = useStored(siteWarbondHistoryItem);
  const meta = useStored(warbondsMeta);
  /** Set once the stored data was read (there may be none). */
  const loaded = ref(false);

  const unwatchShips = shipsItem.watch((value) => (ships.value = value));
  const unwatchWarbonds = warbondsItem.watch((value) => (warbonds.value = value));
  const unwatchHistory = warbondHistoryItem.watch((value) => (history.value = value));
  onMounted(async () => {
    [ships.value, warbonds.value, history.value] = await Promise.all([
      shipsItem.getValue(),
      warbondsItem.getValue(),
      warbondHistoryItem.getValue(),
    ]);
    loaded.value = true;
  });
  onUnmounted(() => {
    unwatchShips();
    unwatchWarbonds();
    unwatchHistory();
  });

  const data = computed((): StoreData | undefined => {
    const shipList = current(ships.value);
    const offers = current(warbonds.value);
    if (!shipList || !offers) return undefined;
    const byId = new Map(shipList.ships.map((ship) => [ship.id, ship]));
    const targets = offers.warbonds.flatMap(({ shipId, skuId, price }): WarbondTarget[] => {
      const ship = byId.get(shipId);
      return ship ? [{ ship, skuId, price }] : [];
    });
    const own = history.value?.version === WARBOND_HISTORY_VERSION ? history.value : undefined;
    const seen = withSiteSightings(own, storedSiteWarbondHistory(site.value ?? null));
    return { ships: shipList.ships, warbonds: targets, ...(seen && { history: seen }) };
  });

  return {
    data,
    /** Epoch milliseconds of the read. */
    fetchedAt: computed(() => meta.value?.checkedAt || undefined),
    loaded,
  };
}
