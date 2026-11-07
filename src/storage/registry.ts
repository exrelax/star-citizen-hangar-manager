import { buybackCheckState, buybackSnapshot } from '@/buyback/buyback-storage';
import { hangarCheckState, hangarSnapshot } from '@/hangar/hangar-storage';
import { ordersSnapshot } from '@/orders/orders-storage';
import { settingsItem } from '@/settings/settings';
import { buyableShipsItem, shipsItem, warbondsItem } from '@/ships/ships-storage';

/*
 * All storages of the extension in one list: what each holds, where it comes from and what uses
 * it. Each lives in its own module next to the code that fills it; a new storage is one entry
 * here. The list drives the reset of the local copy and the migration of old keys.
 *
 * Keys: `local:` is the browser's local storage of the extension (this device), `sync:` its sync
 * storage (follows the browser profile). Every data set is one key, replaced as a whole, so a
 * reader never sees a mix of old and new data.
 */

interface StorageItem {
  key: string;
  removeValue(): Promise<void>;
}

export interface StorageDefinition {
  /** Short name, e.g. for the settings (#64). */
  id: string;
  item: StorageItem;
  /** What it holds. */
  content: string;
  /** Where the data comes from. */
  source: string;
  /** What shows or needs it. */
  usedBy: string[];
  /** Data read from RSI (removed by "Reset" in the settings), or the extension's own state. */
  kind: 'data' | 'state' | 'settings';
  /** Keys of earlier versions with the same format, moved to this one by `migrateStorage`. */
  legacyKeys?: `local:${string}`[];
  /** Keys of earlier versions in another format: removed, the data is read again. */
  obsoleteKeys?: `local:${string}`[];
}

export const STORAGES: readonly StorageDefinition[] = [
  {
    id: 'hangar',
    item: hangarSnapshot,
    content: 'Pledges of "My Gear" with their items, ship links and images',
    source: 'Hangar pages of RSI ("My Gear")',
    usedBy: ['My Hangar', 'buy back (giftable hint)', 'Pledge Store (holdings)'],
    kind: 'data',
    legacyKeys: ['local:hangar.snapshot'],
  },
  {
    id: 'hangar.check',
    item: hangarCheckState,
    content: 'Last smart update of the hangar: time, outcome, spot check rotation',
    source: 'Smart updates',
    usedBy: ['Status line', 'smart updates'],
    kind: 'state',
    legacyKeys: ['local:hangar.checkState'],
  },
  {
    id: 'buyback',
    item: buybackSnapshot,
    content: 'Melted pledges with their items and the buy back tokens',
    source: 'Buy back pages of RSI',
    usedBy: ['Buy Back', 'Pledge Store (holdings)'],
    kind: 'data',
    legacyKeys: ['local:buyback.snapshot'],
  },
  {
    id: 'buyback.check',
    item: buybackCheckState,
    content: 'Last smart update of the buy back: time, outcome, spot check rotation',
    source: 'Smart updates',
    usedBy: ['Smart updates'],
    kind: 'state',
    legacyKeys: ['local:buyback.checkState'],
  },
  {
    id: 'orders',
    item: ordersSnapshot,
    content: 'Order history: the order of every pledge and the newest pledge log entries',
    source: 'Pledge log (/api/account/pledgeLog) and billing list of RSI',
    usedBy: ['Refund tags', 'order details', 'warbond filter', 'search by order id'],
    kind: 'data',
    legacyKeys: ['local:orders.snapshot'],
  },
  {
    id: 'ships',
    item: shipsItem,
    content: 'All ships: id, name, standard price, image, Pledge Store link',
    source: 'Ship upgrade tool of RSI',
    usedBy: ['Discounts', 'upgrade log prices', 'Pledge Store'],
    kind: 'data',
    // Ship prices of earlier versions (another format).
    obsoleteKeys: ['local:hangar.shipPrices'],
  },
  {
    id: 'ships.buyable',
    item: buyableShipsItem,
    content: 'Ships currently on sale: their SKUs and prices',
    source: 'Ship upgrade tool of RSI',
    usedBy: [],
    kind: 'data',
  },
  {
    id: 'ships.warbonds',
    item: warbondsItem,
    content: 'Ships currently offered as warbond edition, with their price',
    source: 'Ship upgrade tool of RSI',
    usedBy: ['Pledge Store'],
    kind: 'data',
    // The Pledge Store offers of earlier versions (another format).
    obsoleteKeys: ['local:store.snapshot'],
  },
  {
    id: 'settings',
    item: settingsItem,
    content: 'Settings: language, theme, display and privacy options, filters, sorting',
    source: 'The settings',
    usedBy: ['Everything'],
    kind: 'settings',
  },
];

/** Storages whose data can be read again from RSI: hangar, buy back, orders, ships, … */
export const LOCAL_COPY = STORAGES.filter((storage) => storage.kind !== 'settings');
