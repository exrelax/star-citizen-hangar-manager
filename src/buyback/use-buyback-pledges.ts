import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackSnapshot } from './buyback';
import { buybackSnapshot } from './buyback-storage';
import { giftableIdLimit, toBuybackView, type BuybackView } from './buyback-view';
import { ordersSnapshot } from '@/orders/orders-storage';
import { withOrder, type OrdersSnapshot } from '@/orders/orders';
import { createPriceLookup, shipPricesOf } from '@/hangar/ship-prices';
import { current as currentShips, shipsItem, type ShipsSnapshot } from '@/ships/ships-storage';
import { createItemPriceLookup } from '@/store/items/item-prices';
import {
  storeItemsItem,
  STORE_ITEMS_VERSION,
  type StoreItemsSnapshot,
} from '@/store/items/store-items-storage';
import { createBuybackPricer } from './buyback-price';

/**
 * Pledges of the stored buy back, kept up to date. The hangar snapshot contributes the id limit
 * for "probably giftable" and its ship links; the ships and the Pledge Store items the buy back
 * prices (#185).
 */
export function useBuybackPledges() {
  const pledges = shallowRef<BuybackView[]>([]);
  const loaded = ref(false);
  const syncedAt = ref<string>();
  /** Buy back tokens left, as of the last sync or smart update; unset if unknown. */
  const tokens = ref<number>();

  let buyback: BuybackSnapshot | null = null;
  let hangar: HangarSnapshot | null = null;
  let orders: OrdersSnapshot | null = null;
  let ships: ShipsSnapshot | null = null;
  let storeItems: StoreItemsSnapshot | null = null;

  const rebuild = () => {
    const current = buyback?.version === BUYBACK_SNAPSHOT_VERSION ? buyback : null;
    const validHangar = hangar?.version === HANGAR_SNAPSHOT_VERSION ? hangar : null;
    const idLimit = validHangar ? giftableIdLimit(validHangar.pledges) : undefined;
    const shipLinks = { ...validHangar?.shipLinks, ...current?.shipLinks };
    const shipPrices = shipPricesOf(ships);
    const items = storeItems?.version === STORE_ITEMS_VERSION ? storeItems.items : [];
    const priceOf = createBuybackPricer({
      ships: currentShips(ships)?.ships,
      shipPriceOf: shipPrices.length ? createPriceLookup(shipPrices) : undefined,
      itemPriceOf: items.length ? createItemPriceLookup(items) : undefined,
      pledges: current?.pledges,
    });
    pledges.value = current
      ? current.pledges.map((pledge, position) =>
          withOrder(toBuybackView(pledge, { position, idLimit, shipLinks, priceOf }), orders),
        )
      : [];
    syncedAt.value = current?.syncedAt;
    tokens.value = current?.tokens;
  };

  const unwatchBuyback = buybackSnapshot.watch((value) => {
    buyback = value;
    rebuild();
  });
  const unwatchHangar = hangarSnapshot.watch((value) => {
    hangar = value;
    rebuild();
  });
  const unwatchOrders = ordersSnapshot.watch((value) => {
    orders = value;
    rebuild();
  });
  const unwatchShips = shipsItem.watch((value) => {
    ships = value;
    rebuild();
  });
  const unwatchStoreItems = storeItemsItem.watch((value) => {
    storeItems = value;
    rebuild();
  });
  onMounted(async () => {
    [buyback, hangar, orders, ships, storeItems] = await Promise.all([
      buybackSnapshot.getValue(),
      hangarSnapshot.getValue(),
      ordersSnapshot.getValue(),
      shipsItem.getValue(),
      storeItemsItem.getValue(),
    ]);
    rebuild();
    loaded.value = true;
  });
  onUnmounted(() => {
    unwatchBuyback();
    unwatchHangar();
    unwatchOrders();
    unwatchShips();
    unwatchStoreItems();
  });

  return { pledges, loaded, syncedAt, tokens };
}
