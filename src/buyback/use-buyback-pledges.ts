import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackSnapshot } from './buyback';
import { buybackSnapshot } from './buyback-storage';
import { giftableIdLimit, toBuybackView, type BuybackView } from './buyback-view';
import { ordersSnapshot } from '@/orders/orders-storage';
import { withOrder, type OrdersSnapshot } from '@/orders/orders';

/**
 * Pledges of the stored buy back, kept up to date. The hangar snapshot contributes the id limit
 * for "probably giftable" and its ship links.
 */
export function useBuybackPledges() {
  const pledges = shallowRef<BuybackView[]>([]);
  const loaded = ref(false);
  const syncedAt = ref<string>();

  let buyback: BuybackSnapshot | null = null;
  let hangar: HangarSnapshot | null = null;
  let orders: OrdersSnapshot | null = null;

  const rebuild = () => {
    const current = buyback?.version === BUYBACK_SNAPSHOT_VERSION ? buyback : null;
    const validHangar = hangar?.version === HANGAR_SNAPSHOT_VERSION ? hangar : null;
    const idLimit = validHangar ? giftableIdLimit(validHangar.pledges) : undefined;
    const shipLinks = { ...validHangar?.shipLinks, ...current?.shipLinks };
    pledges.value = current
      ? current.pledges.map((pledge, position) =>
          withOrder(toBuybackView(pledge, { position, idLimit, shipLinks }), orders),
        )
      : [];
    syncedAt.value = current?.syncedAt;
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
  onMounted(async () => {
    [buyback, hangar, orders] = await Promise.all([
      buybackSnapshot.getValue(),
      hangarSnapshot.getValue(),
      ordersSnapshot.getValue(),
    ]);
    rebuild();
    loaded.value = true;
  });
  onUnmounted(() => {
    unwatchBuyback();
    unwatchHangar();
    unwatchOrders();
  });

  return { pledges, loaded, syncedAt };
}
