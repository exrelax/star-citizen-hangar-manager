import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackSnapshot } from './buyback';
import { buybackSnapshot } from './buyback-storage';
import { toBuybackView, type BuybackView } from './buyback-view';
import { giftFlagsItem, type GiftFlags } from './gift-flags';
import { createGiftableCheck } from './probably-giftable';
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
import { createAvailabilityCheck } from './buyback-availability';
import { createBuybackImager } from './buyback-image';
import { createBuybackPricer } from './buyback-price';
import { createPriceIncreaseMatcher } from '@/price-increases/price-increase-match';
import {
  priceIncreasesItem,
  storedPriceIncreases,
  type PriceIncreasesSnapshot,
} from '@/price-increases/price-increases-storage';

/**
 * Pledges of the stored buy back, kept up to date. The orders, the gift flags and the hangar's
 * pledge ids tell "probably giftable" (#204); the hangar also gives its ship links and, with the
 * ships, the images (#202); the ships and the Pledge Store items give the buy back prices (#185); the expected price
 * increases of the website mark what will probably cost more soon (#191).
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
  let giftFlags: GiftFlags = {};
  let priceIncreases: PriceIncreasesSnapshot | null = null;

  const rebuild = () => {
    const current = buyback?.version === BUYBACK_SNAPSHOT_VERSION ? buyback : null;
    const validHangar = hangar?.version === HANGAR_SNAPSHOT_VERSION ? hangar : null;
    const giftable = createGiftableCheck({
      orders,
      hangarPledges: validHangar?.pledges,
      giftFlags,
    });
    const shipLinks = { ...validHangar?.shipLinks, ...current?.shipLinks };
    const shipPrices = shipPricesOf(ships);
    const items = storeItems?.version === STORE_ITEMS_VERSION ? storeItems.items : [];
    const catalog = currentShips(ships)?.ships;
    const availabilityOf = createAvailabilityCheck(catalog);
    const imageOf = createBuybackImager({ ships: catalog, hangarPledges: validHangar?.pledges });
    const shipPriceOf = shipPrices.length ? createPriceLookup(shipPrices) : undefined;
    const priceOf = createBuybackPricer({
      ships: catalog,
      shipPriceOf,
      itemPriceOf: items.length ? createItemPriceLookup(items) : undefined,
      pledges: current?.pledges,
    });
    const priceIncreaseMatcher = createPriceIncreaseMatcher(
      storedPriceIncreases(priceIncreases),
      Date.now(),
    );
    pledges.value = current
      ? current.pledges.map((pledge, position) =>
          withOrder(
            toBuybackView(pledge, {
              position,
              shipLinks,
              giftable,
              priceOf,
              imageOf,
              availabilityOf,
              priceIncreaseOf: priceIncreaseMatcher.buyback,
              ccuPriceChangeOf: (ccu, paid) =>
                priceIncreaseMatcher.buybackCcu(ccu, shipPriceOf, paid),
            }),
            orders,
          ),
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
  const unwatchGiftFlags = giftFlagsItem.watch((value) => {
    giftFlags = value;
    rebuild();
  });
  // The expected price increases of the project website (#195).
  const unwatchPriceIncreases = priceIncreasesItem.watch((value) => {
    priceIncreases = value;
    rebuild();
  });
  onMounted(async () => {
    [buyback, hangar, orders, ships, storeItems, giftFlags, priceIncreases] = await Promise.all([
      buybackSnapshot.getValue(),
      hangarSnapshot.getValue(),
      ordersSnapshot.getValue(),
      shipsItem.getValue(),
      storeItemsItem.getValue(),
      giftFlagsItem.getValue(),
      priceIncreasesItem.getValue(),
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
    unwatchGiftFlags();
    unwatchPriceIncreases();
  });

  return { pledges, loaded, syncedAt, tokens };
}
