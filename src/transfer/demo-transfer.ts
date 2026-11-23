import { demoRiskNoteSeenItem } from '@/account-safety/risk-note';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackPledge } from '@/buyback/buyback';
import type { BuybackView } from '@/buyback/buyback-view';
import type { StoreCredit } from '@/account/store-credit';
import { STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { demoNotificationsItem } from '@/demo/demo-notes';
import { demoMeltMarksItem } from '@/hangar/melt-marks';
import { HANGAR_SNAPSHOT_VERSION, type Pledge } from '@/hangar/pledge';
import type { PledgeView } from '@/hangar/pledge-view';
import { demoDismissedAdvisorNotesItem } from '@/price-increases/advisor-notes';
import { demoDismissedPriceIncreasesItem } from '@/price-increases/price-increase-notes';
import { demoDismissedRemovalNotesItem } from '@/ship-removals/removal-notes';
import { STORAGES, type StorageId } from '@/storage/registry';
import { demoCompletedPlansItem } from '@/store/paint-consultant/completed-plans';
import { demoDismissedPaintsItem } from '@/store/paint-consultant/paint-notification';
import { demoRebuyPlanItem } from '@/store/paint-consultant/rebuy-plan-storage';
import {
  clearWatchlists,
  loadWatchlists,
  saveWatchlist,
  SYNC_QUOTA,
} from '@/watchlists/watchlists-storage';
import type { Watchlist } from '@/watchlists/watchlists';
import { NEAR_LIMIT_SHARE } from '@/storage/synced-usage';
import type { HangarData } from './hangar-export';
import { SETTINGS_PARTS, storagesOfPart, type SettingsPart } from './settings-export';
import { ImportQuotaError, syncedImport, type Values } from './settings-import';

/*
 * Export & Import in the demo mode (#233): never the real account. Every export holds only the
 * demo's data – its hangar and buy back numbered from 1, without orders, with the demo's store
 * credit; its watchlists, marks, paint plans and closed notes –, and an import goes into the
 * demo's own data in this browser (`local:demo.*`), measured as it would be synced, never into the
 * synced storage. What the demo has no copy of (the settings, the warbond offers this browser
 * saw, the browser notification hint) is exported as it is, since it isn't the account's, but
 * never imported. The hangar can't be restored in the demo.
 */

interface DemoItem {
  getValue(): Promise<unknown>;
  setValue(value: unknown): Promise<void>;
}

const item = <T>(source: { getValue(): Promise<T>; setValue(value: T): Promise<void> }) =>
  source as unknown as DemoItem;

/** The demo's own copy of each storage of your data and the decisions. */
export const DEMO_ITEMS: Partial<Record<StorageId, DemoItem>> = {
  watchlists: {
    getValue: () => loadWatchlists(true),
    async setValue(value) {
      await clearWatchlists(true);
      for (const list of value as Watchlist[]) await saveWatchlist(list, true);
    },
  },
  meltMarks: item(demoMeltMarksItem),
  paintPlan: item(demoRebuyPlanItem),
  paintHistory: item(demoCompletedPlansItem),
  notifications: item(demoNotificationsItem),
  dismissedPaints: item(demoDismissedPaintsItem),
  riskNoteSeen: item(demoRiskNoteSeenItem),
  dismissedPriceIncreases: item(demoDismissedPriceIncreasesItem),
  dismissedPriceAdvisor: item(demoDismissedAdvisorNotesItem),
  dismissedShipRemovals: item(demoDismissedRemovalNotesItem),
};

/** Whether the demo imports a storage: only into its own copy. */
export const demoImports = (id: StorageId) => id in DEMO_ITEMS;

/** The values of the export of settings and your data in the demo. */
export async function loadDemoSettingsData(
  parts: readonly SettingsPart[] = SETTINGS_PARTS,
): Promise<Values> {
  const storages = parts.flatMap(storagesOfPart);
  const values = await Promise.all(
    storages.map((storage) => (DEMO_ITEMS[storage.id] ?? storage.item).getValue()),
  );
  return Object.fromEntries(storages.map((storage, index) => [storage.id, values[index]]));
}

/** What the demo has of these storages now, for the preview. */
export async function currentDemoValues(ids: readonly StorageId[]): Promise<Values> {
  const values = await Promise.all(ids.map((id) => DEMO_ITEMS[id]?.getValue() ?? null));
  return Object.fromEntries(ids.map((id, index) => [id, values[index]]));
}

/**
 * The synced storage as the demo measures it: the demo's own data as if synced, and almost full
 * with the demo setting "Synced storage almost full" (#560), so the limit can be reached.
 */
export function demoSyncedStorage(nearLimit: boolean): Record<string, unknown> {
  if (!nearLimit) return {};
  const filler = Math.ceil(SYNC_QUOTA.total * NEAR_LIMIT_SHARE);
  // Spread over keys of the limit per key, as real data would be.
  const keys = Math.ceil(filler / (SYNC_QUOTA.perItem - 100));
  return Object.fromEntries(
    Array.from({ length: keys }, (_, index) => [
      `demo.filler.${index}`,
      'x'.repeat(Math.floor(filler / keys)),
    ]),
  );
}

/**
 * Writes an import into the demo's own data, after measuring it like the real one
 * (`ImportQuotaError`, nothing written). Storages the demo has no copy of are left out.
 */
export async function writeDemoImport(values: Values, nearLimit: boolean): Promise<void> {
  const own = Object.fromEntries(
    Object.entries(values).filter(([id]) => demoImports(id as StorageId)),
  ) as Values;
  const placed = syncedImport(demoSyncedStorage(nearLimit), own);
  if (!('writes' in placed)) throw new ImportQuotaError(placed);
  for (const [id, value] of Object.entries(own)) {
    await DEMO_ITEMS[id as StorageId]!.setValue(value);
  }
}

// ---- The hangar of the demo ----

/** A demo pledge as stored, numbered from 1: never a real id. */
function demoPledge(view: PledgeView, index: number): Pledge {
  return {
    id: index + 1,
    name: view.originalName ?? view.title,
    title: view.title,
    value: view.value,
    valueUsd: view.valueUsd,
    configurationValue: '',
    currency: '',
    ...(view.createdAt && { createdAt: view.createdAt }),
    availability: 'Attributed',
    contains: '',
    isLastAlpha: view.isLastAlpha,
    isBuybackable: view.isBuybackable,
    isGiftable: view.isGiftable,
    isExchangeable: view.isMeltable,
    isUpgradeable: false,
    isUpgraded: view.isUpgraded,
    ...(view.upgrade && { upgrade: view.upgrade }),
    ...(view.protectedGames.length && { protectedGames: [...view.protectedGames] }),
    nameReservations: null,
    nameableShips: null,
    items: view.items.map((entry) => ({ ...entry })),
  };
}

function demoBuyback(view: BuybackView, index: number): BuybackPledge {
  return {
    id: index + 1,
    title: view.title,
    ...(view.reclaimedAt && { reclaimedAt: view.reclaimedAt }),
    contained: view.contained,
    isUpgrade: view.isCcu,
    ...(view.upgrade && { upgrade: view.upgrade }),
    items: [...view.items],
    ...(view.price && { price: view.price.amount }),
  };
}

/** The data of a hangar export in the demo: its lists, its store credit, no orders or flags. */
export function demoHangarData(
  lists: { hangar: readonly PledgeView[]; buyback: readonly BuybackView[] },
  credit: StoreCredit,
  now = new Date(),
): HangarData {
  const syncedAt = now.toISOString();
  return {
    hangar: { version: HANGAR_SNAPSHOT_VERSION, syncedAt, pledges: lists.hangar.map(demoPledge) },
    buyback: {
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt,
      pledges: lists.buyback.map(demoBuyback),
    },
    orders: null,
    storeCredit: { version: STORE_CREDIT_VERSION, credit },
    giftFlags: null,
  };
}

/** The ids the demo leaves out of an import, for its preview. */
export const notImportedInDemo = (ids: readonly StorageId[]) =>
  ids.filter((id) => !demoImports(id) && STORAGES.some((storage) => storage.id === id));
