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
import { shipStatusItem, shipStatusMeta, type ShipStatusSnapshot } from '@/ships/ship-status';
import { shipFactsItem, shipFactsMeta, type ShipFactsSnapshot } from '@/ships/sync-ship-facts';
import type { MetaItem } from './meta';
import {
  storeCreditItem,
  storeCreditMeta,
  type StoreCreditSnapshot,
} from '@/account/store-credit-storage';
import {
  storeItemsItem,
  storeItemsMeta,
  type StoreItemsSnapshot,
} from '@/store/items/store-items-storage';
import { rebuyPlanItem, type StoredRebuyPlan } from '@/store/paint-consultant/rebuy-plan-storage';
import { eventsItem, eventsMeta, type EventsSnapshot } from '@/events/events-storage';
import {
  priceIncreasesItem,
  priceIncreasesMeta,
  type PriceIncreasesSnapshot,
} from '@/price-increases/price-increases-storage';
import type { BuybackSnapshot } from '@/buyback/buyback';
import type { HangarSnapshot } from '@/hangar/pledge';
import type { OrdersSnapshot } from '@/orders/orders';
import type { BuyableShipsSnapshot, ShipsSnapshot, WarbondsSnapshot } from '@/ships/ships-storage';

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
  getValue(): Promise<unknown>;
  watch(callback: (value: unknown) => void): () => void;
  removeValue(): Promise<void>;
}

export type StorageId =
  | 'hangar'
  | 'buyback'
  | 'orders'
  | 'ships'
  | 'shipsBuyable'
  | 'shipsWarbonds'
  | 'shipStatus'
  | 'shipFacts'
  | 'storeItems'
  | 'events'
  | 'priceIncreases'
  | 'storeCredit'
  | 'paintPlan'
  | 'settings';

export interface StorageDefinition {
  /** Short name; also the key of its texts in the settings (`storage.<id>…`). */
  id: StorageId;
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
  /** Number of entries of a stored value, shown in the settings. */
  count?: (value: never) => number;
  /**
   * After a reset: read again by the next refresh, or on its own as soon as the manager is open
   * (the small data of the upgrade tool), or never (what the user did, e.g. the consultant's plan).
   */
  readAgain?: 'refresh' | 'auto' | 'never';
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
    count: (value: HangarSnapshot | null) => value?.pledges.length ?? 0,
    readAgain: 'refresh',
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
    count: (value: BuybackSnapshot | null) => value?.pledges.length ?? 0,
    readAgain: 'refresh',
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
    count: (value: OrdersSnapshot | null) => Object.keys(value?.orders ?? {}).length,
    readAgain: 'refresh',
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
    count: (value: ShipsSnapshot | null) => value?.ships.length ?? 0,
    readAgain: 'auto',
    // Ship prices of earlier versions (another format).
    obsoleteKeys: ['local:hangar.shipPrices'],
  },
  {
    id: 'shipsBuyable',
    meta: buyableShipsMeta,
    item: buyableShipsItem,
    content: 'Ships currently on sale: their SKUs and prices',
    source: 'Ship upgrade tool of RSI',
    usedBy: [],
    kind: 'data',
    count: (value: BuyableShipsSnapshot | null) => value?.skus.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'shipsWarbonds',
    meta: warbondsMeta,
    item: warbondsItem,
    content: 'Ships currently offered as warbond edition, with their price',
    source: 'Ship upgrade tool of RSI',
    usedBy: ['Pledge Store'],
    kind: 'data',
    count: (value: WarbondsSnapshot | null) => value?.warbonds.length ?? 0,
    readAgain: 'auto',
    // The Pledge Store offers of earlier versions (another format).
    obsoleteKeys: ['local:store.snapshot'],
  },
  {
    id: 'shipStatus',
    meta: shipStatusMeta,
    item: shipStatusItem,
    content: 'The ships still in concept (not flight ready yet), by id',
    source: "RSI's public Ship Matrix (/ship-matrix/index), at the Pledge Store items' minutes",
    usedBy: ['Price Increase Advisor (CCUs to ships that may rise later)'],
    kind: 'data',
    count: (value: ShipStatusSnapshot | null) => value?.count ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'shipFacts',
    meta: shipFactsMeta,
    item: shipFactsItem,
    content: 'Every ship: production status, always available, standard price, with their history',
    source: 'Project website (data/ships.json, from the Ship Matrix and the Star Citizen Wiki)',
    usedBy: ['Price Increase Advisor', 'CCU Consultant (always available base ships)'],
    kind: 'data',
    count: (value: ShipFactsSnapshot | null) => value?.facts.ships.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'storeItems',
    meta: storeItemsMeta,
    item: storeItemsItem,
    content: 'Items of the Pledge Store: name, category, price, image, link, warbond, in stock',
    source: 'Search of the Pledge Store of RSI (/graphql)',
    usedBy: [],
    kind: 'data',
    count: (value: StoreItemsSnapshot | null) => value?.items.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'events',
    meta: eventsMeta,
    item: eventsItem,
    content: 'Events of Star Citizen: name, dates, description, icon',
    source: 'The project website (GitHub Pages, data/events.json)',
    usedBy: ['Pledge Store (events)', 'sidebar notifications'],
    kind: 'data',
    count: (value: EventsSnapshot | null) => value?.events.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'priceIncreases',
    meta: priceIncreasesMeta,
    item: priceIncreasesItem,
    content: 'Expected price increases: ship id and names, dates, related items, note',
    source: 'The project website (GitHub Pages, data/price-increases.json)',
    usedBy: [],
    kind: 'data',
    count: (value: PriceIncreasesSnapshot | null) => value?.priceIncreases.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'storeCredit',
    meta: storeCreditMeta,
    item: storeCreditItem,
    content: "The account's store credit",
    source: 'Credit ledger of the RSI account (/graphql), as in its account menu',
    usedBy: ['Sidebar'],
    kind: 'data',
    count: (value: StoreCreditSnapshot | null) => (value ? 1 : 0),
    readAgain: 'auto',
  },
  {
    id: 'paintPlan',
    item: rebuyPlanItem,
    content: "The Paint Discount Consultant's plan whose paints were put into the cart",
    source: 'The Paint Discount Consultant ("Put the paints into the cart")',
    usedBy: ['Paint Discount Consultant (filler paints to melt again)'],
    kind: 'data',
    count: (value: StoredRebuyPlan | null) =>
      value ? value.own.length + value.fillers.reduce((sum, f) => sum + f.quantity, 0) : 0,
    readAgain: 'never',
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
