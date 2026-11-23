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
import type { StorageGroupId } from './storage-group-ids';
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
import {
  rebuyPlanItem,
  type AnyStoredRebuyPlan,
} from '@/store/paint-consultant/rebuy-plan-storage';
import {
  completedPlansItem,
  type CompletedPlansSnapshot,
} from '@/store/paint-consultant/completed-plans';
import {
  siteWarbondHistoryItem,
  siteWarbondHistoryMeta,
  warbondHistoryItem,
  type SiteWarbondHistorySnapshot,
} from '@/store/warbond-history-storage';
import type { WarbondHistorySnapshot } from '@/store/warbond-history';
import { eventsItem, eventsMeta, type EventsSnapshot } from '@/events/events-storage';
import {
  priceIncreasesItem,
  priceIncreasesMeta,
  type PriceIncreasesSnapshot,
} from '@/price-increases/price-increases-storage';
import {
  shipRemovalsItem,
  shipRemovalsMeta,
  type ShipRemovalsSnapshot,
} from '@/ship-removals/ship-removals-storage';
import {
  tokenRenewalsItem,
  tokenRenewalsMeta,
  type TokenRenewalsSnapshot,
} from '@/buyback-tokens/token-renewals-storage';
import { watchlistsItem } from '@/watchlists/watchlists-storage';
import { meltMarksItem, type MeltMarks } from '@/hangar/melt-marks';
import type { Watchlist } from '@/watchlists/watchlists';
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
  | 'warbondHistory'
  | 'warbondHistorySite'
  | 'shipStatus'
  | 'shipFacts'
  | 'storeItems'
  | 'events'
  | 'priceIncreases'
  | 'shipRemovals'
  | 'buybackTokenRenewals'
  | 'storeCredit'
  | 'paintPlan'
  | 'paintHistory'
  | 'watchlists'
  | 'meltMarks'
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
  /**
   * Data read from RSI (removed by "Reset" in the settings), what the user keeps in the synced
   * storage across devices (never removed by a reset of this browser's copy), or the settings.
   */
  kind: 'data' | 'synced' | 'settings';
  /**
   * Its group in the settings' "Stored data" (#624, `storage-groups.ts`): by where its data comes
   * from. Every storage but the settings has one.
   */
  group?: StorageGroupId;
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
    group: 'account',
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
    group: 'account',
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
    group: 'account',
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
    group: 'store',
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
    group: 'store',
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
    group: 'store',
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
    id: 'warbondHistory',
    group: 'browser',
    item: warbondHistoryItem,
    content: 'Warbond offers seen so far: ship, price, standard price, first and last seen, events',
    source: 'Every read of the ship upgrade tool of RSI, since the Hangar Manager was installed',
    usedBy: ['Pledge Store (earlier offers)'],
    kind: 'data',
    count: (value: WarbondHistorySnapshot | null) => value?.sightings.length ?? 0,
    readAgain: 'never',
  },
  {
    id: 'warbondHistorySite',
    group: 'website',
    meta: siteWarbondHistoryMeta,
    item: siteWarbondHistoryItem,
    content: 'Earlier warbond offers: ship, price, standard price, first and last seen, events',
    source: 'The project website (GitHub Pages, data/warbond-history.json)',
    usedBy: ['Pledge Store (Warbond CCU History, earlier offers)'],
    kind: 'data',
    count: (value: SiteWarbondHistorySnapshot | null) => value?.offers.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'shipStatus',
    group: 'store',
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
    group: 'website',
    meta: shipFactsMeta,
    item: shipFactsItem,
    content: 'Every ship: production status, always available, standard price, with their history',
    source: 'Project website (data/ships.json, from the Ship Matrix and the Star Citizen Wiki)',
    usedBy: ['Price Increase Advisor', 'CCU Check (always available base ships)'],
    kind: 'data',
    count: (value: ShipFactsSnapshot | null) => value?.facts.ships.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'storeItems',
    group: 'store',
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
    group: 'website',
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
    group: 'website',
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
    id: 'shipRemovals',
    group: 'website',
    meta: shipRemovalsMeta,
    item: shipRemovalsItem,
    content: 'Ship removals: ship id and name, date, source, event',
    source: 'The project website (GitHub Pages, data/ship-removals.json)',
    usedBy: [],
    kind: 'data',
    count: (value: ShipRemovalsSnapshot | null) => value?.shipRemovals.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'buybackTokenRenewals',
    group: 'website',
    meta: tokenRenewalsMeta,
    item: tokenRenewalsItem,
    content: 'Buy back token renewals: dates, whether confirmed, note, source',
    source: 'The project website (GitHub Pages, data/buyback-tokens.json)',
    usedBy: [],
    kind: 'data',
    count: (value: TokenRenewalsSnapshot | null) => value?.renewals.length ?? 0,
    readAgain: 'auto',
  },
  {
    id: 'storeCredit',
    group: 'account',
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
    group: 'synced',
    item: rebuyPlanItem,
    content: "The Paint Discount Planner's plan whose paints were put into the cart",
    source: 'The Paint Discount Planner ("Start plan"), in the synced storage (one key)',
    usedBy: ['Paint Discount Planner (filler paints to melt again)'],
    // In the synced storage (#635): it follows the browser profile, a reset keeps it.
    kind: 'synced',
    count: (value: AnyStoredRebuyPlan | null) =>
      value ? value.own.length + value.fillers.reduce((sum, f) => sum + f.quantity, 0) : 0,
    readAgain: 'never',
  },
  {
    id: 'paintHistory',
    group: 'synced',
    item: completedPlansItem,
    content: "The Paint Discount Planner's completed plans",
    source:
      'The Paint Discount Planner (a running plan that ended), in the synced storage (one key per plan, the last 10; older ones in this browser)',
    usedBy: ['Paint Discount Planner (completed plans)'],
    kind: 'synced',
    count: (value: CompletedPlansSnapshot | null) => value?.plans.length ?? 0,
    readAgain: 'never',
  },
  {
    id: 'watchlists',
    group: 'synced',
    item: watchlistsItem,
    content: 'Watchlists: name, description, date, reminder and the items on each (#465)',
    source: 'The watchlists the user made, in the synced storage (one key per list)',
    usedBy: ['Watchlists'],
    kind: 'synced',
    count: (value: Watchlist[] | null) => value?.length ?? 0,
    readAgain: 'never',
  },
  {
    id: 'meltMarks',
    group: 'synced',
    item: meltMarksItem,
    content: 'Marks to melt: the pledge id and when it was marked (#144)',
    source: 'The marks the user set in My Hangar, in the synced storage',
    usedBy: ['My Hangar (melt marks)', 'sidebar notifications', 'Paint Discount Planner'],
    kind: 'synced',
    count: (value: MeltMarks | null) => Object.keys(value ?? {}).length,
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

/**
 * The local copy: hangar, buy back, orders, ships, … – not the settings and not what the user keeps
 * in the synced storage (the watchlists, the marks to melt), which a reset of this browser must
 * never remove.
 */
export const LOCAL_COPY = STORAGES.filter((storage) => storage.kind === 'data');

/** What the user keeps in the synced storage (#560): shown apart, never reset with the local copy. */
export const SYNCED = STORAGES.filter((storage) => storage.kind === 'synced');
