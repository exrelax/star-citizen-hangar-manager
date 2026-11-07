import { buybackMeta, buybackSnapshot } from '@/buyback/buyback-storage';
import { hangarMeta, hangarSnapshot } from '@/hangar/hangar-storage';
import { ordersMeta, ordersSnapshot } from '@/orders/orders-storage';
import { settingsItem } from '@/settings/settings';
import {
  buyableShipsItem,
  buyableShipsMeta,
  shipsItem,
  shipsMeta,
  warbondsItem,
  warbondsMeta,
} from '@/ships/ships-storage';
import type { MetaItem } from './meta';

/*
 * All storages of the extension in one list: what each holds, where it comes from and what uses
 * it. Each lives in its own module next to the code that fills it; a new storage is one entry
 * here. The list drives the reset of the local copy and the migration of old keys. Each data
 * storage has a metadata key next to it (`<key>.meta`, see `meta.ts`).
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
  /** Last full sync, last check and fingerprint (see `meta.ts`); not for the settings. */
  meta?: MetaItem;
  /** What it holds. */
  content: string;
  /** Where the data comes from. */
  source: string;
  /** What shows or needs it. */
  usedBy: string[];
  /** Data read from RSI (removed by "Reset" in the settings), or the settings. */
  kind: 'data' | 'settings';
  /** Keys of earlier versions with the same format, moved to this one by `migrateStorage`. */
  legacyKeys?: `local:${string}`[];
  /** Keys of earlier versions in another format: removed, the data is read again. */
  obsoleteKeys?: `local:${string}`[];
  /** Smart update states of earlier versions, turned into the metadata by `migrateStorage`. */
  legacyCheckKeys?: `local:${string}`[];
}

export const STORAGES: readonly StorageDefinition[] = [
  {
    id: 'hangar',
    meta: hangarMeta,
    item: hangarSnapshot,
    content: 'Pledges of "My Gear" with their items, ship links and images',
    source: 'Hangar pages of RSI ("My Gear")',
    usedBy: ['My Hangar', 'buy back (giftable hint)', 'Pledge Store (holdings)'],
    kind: 'data',
    legacyKeys: ['local:hangar.snapshot'],
    legacyCheckKeys: ['local:hangar.checkState', 'local:hangar.check'],
  },
  {
    id: 'buyback',
    meta: buybackMeta,
    item: buybackSnapshot,
    content: 'Melted pledges with their items and the buy back tokens',
    source: 'Buy back pages of RSI',
    usedBy: ['Buy Back', 'Pledge Store (holdings)'],
    kind: 'data',
    legacyKeys: ['local:buyback.snapshot'],
    legacyCheckKeys: ['local:buyback.checkState', 'local:buyback.check'],
  },
  {
    id: 'orders',
    meta: ordersMeta,
    item: ordersSnapshot,
    content: 'Order history: the order of every pledge and the newest pledge log entries',
    source: 'Pledge log (/api/account/pledgeLog) and billing list of RSI',
    usedBy: ['Refund tags', 'order details', 'warbond filter', 'search by order id'],
    kind: 'data',
    legacyKeys: ['local:orders.snapshot'],
  },
  {
    id: 'ships',
    meta: shipsMeta,
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
    meta: buyableShipsMeta,
    item: buyableShipsItem,
    content: 'Ships currently on sale: their SKUs and prices',
    source: 'Ship upgrade tool of RSI',
    usedBy: [],
    kind: 'data',
  },
  {
    id: 'ships.warbonds',
    meta: warbondsMeta,
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
