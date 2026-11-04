import { buybackCheckState, buybackSnapshot } from '@/buyback/buyback-storage';
import { hangarCheckState, hangarSnapshot, shipPricesItem } from '@/hangar/hangar-storage';
import { ordersSnapshot } from '@/orders/orders-storage';

/**
 * Everything the extension keeps of the hangar and the buy back in the browser: the pledges, their
 * orders, the ship prices and the state of the smart updates. Not the settings.
 */
const CACHE_ITEMS = [
  hangarSnapshot,
  hangarCheckState,
  shipPricesItem,
  ordersSnapshot,
  buybackSnapshot,
  buybackCheckState,
];

/**
 * Deletes the stored hangar and buy back. Only the extension's copy: nothing is changed on RSI's
 * website, and the next refresh reads everything again. The open lists empty at once, as they
 * follow the stored items.
 */
export async function clearLocalCache(): Promise<void> {
  await storage.removeItems(CACHE_ITEMS);
}
