import { defineMeta } from '@/storage/meta';
import type { OrdersSnapshot } from './orders';

/** Orders of the pledges (see `orders.ts`), replaced as a whole by each sync. */
export const ordersSnapshot = storage.defineItem<OrdersSnapshot | null>('local:orders.history', {
  fallback: null,
});

/**
 * When the orders were last read in full and checked; the fingerprint is the newest pledge log
 * entry (see `storage/meta.ts`).
 */
export const ordersMeta = defineMeta('local:orders.history');
