import type { OrdersSnapshot } from './orders';

/** Orders of the pledges (see `orders.ts`), replaced as a whole by each sync. */
export const ordersSnapshot = storage.defineItem<OrdersSnapshot | null>('local:orders.snapshot', {
  fallback: null,
});
