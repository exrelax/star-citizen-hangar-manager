import { buybackMeta } from '@/buyback/buyback-storage';
import { runBuybackSmartUpdate } from '@/buyback/run';
import { prepareBuybackSync } from '@/buyback/sync-buyback';
import { settingsItem, withDefaults } from '@/settings/settings';
import { maybeRefreshUpgradeTool, refreshUpgradeTool } from '@/ships/sync-upgrade-tool';
import { maybeRefreshStoreItems, refreshStoreItems } from '@/store/items/sync-store-items';
import { refreshStoreCredit } from '@/account/sync-store-credit';
import { maybeRefreshEvents } from '@/events/sync-events';
import type { StorageId } from '@/storage/registry';
import { reactive, readonly } from 'vue';
import { recordCheck, recordSync, type CheckOutcome, type MetaItem } from '@/storage/meta';
import { hangarMeta } from './hangar-storage';
import { runSmartUpdate } from './smart-update/run';
import { pledgeIdsOfLogEntries } from '@/orders/pledge-log';
import { prepareOrderSync, updateOrders } from '@/orders/sync-orders';
import { prepareHangarSync } from './sync';
import { SyncProgressTracker, type SyncProgress } from './sync-progress';
import { currentIntervalMinutes, recordCheckResult } from './smart-update/backoff';
import { isCheckDue, withSmartUpdateLock } from './smart-update/schedule';
import { announceCheck } from './smart-update/broadcast';
import { SMART_UPDATE } from '@/config';

const state = reactive({
  /** A full sync is running (of everything, or of `storage`). */
  running: false,
  /** The storage a sync of a single storage reads (see `startStorageSync`); unset for all. */
  storage: undefined as StorageId | undefined,
  progress: null as SyncProgress | null,
  /** A smart update check is running in this tab. */
  checking: false,
  /** A smart update check is running in another tab (see `smart-update/broadcast.ts`). */
  checkingElsewhere: false,
});

/**
 * Taken by `maybeRunSmartUpdate` from the first trigger on, also while it only looks whether a
 * check is due – unlike `checking`, which is shown and so is set only for a real check.
 */
let claimed = false;

/**
 * Sync state shared by all mounts of the manager view, so switching to "My Gear" and back
 * neither aborts nor duplicates a running sync.
 */
export const syncState = readonly(state);

/**
 * Starts a full sync of the hangar, the buy back and then the orders, unless one is already
 * running. The first pages of all are read up front, so the progress counts all their pages from
 * the start.
 */
export async function startSync(): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.progress = null;
  const startedAt = performance.now();
  try {
    // Small and optional: load alongside, a failure keeps the stored ships, offers and items.
    const upgradeTool = refreshUpgradeTool();
    const storeItems = refreshStoreItems();
    const storeCredit = refreshStoreCredit();
    // Reported only once both totals are known; the detail pages of the buy back join later.
    const progress = new SyncProgressTracker();
    const [runHangar, runBuyback, runOrders] = await Promise.all([
      prepareHangarSync({ progress: progress.section('hangar') }),
      prepareBuybackSync({ progress: progress.section('buyback') }),
      // An extra as well: without the orders, hangar and buy back are still stored.
      prepareOrderSync({ progress: progress.section('orders') }).catch((error: unknown) => {
        console.warn('[star-citizen-hangar-manager] Orders unavailable', error);
        return null;
      }),
    ]);
    progress.start();
    progress.onChange = (value) => (state.progress = value);
    state.progress = progress.progress;

    const hangar = await runHangar();
    await recordSync(hangarMeta);
    const buyback = await runBuyback();
    await recordSync(buybackMeta);
    const orders = await runOrders?.().catch((error: unknown) => {
      console.warn('[star-citizen-hangar-manager] Order sync failed', error);
      return null;
    });
    await upgradeTool;
    await storeItems;
    await storeCredit;

    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    console.info(
      `[star-citizen-hangar-manager] Synced ${hangar.pledges.length} hangar and ` +
        `${buyback.pledges.length} buy back pledges` +
        (orders ? ` and ${Object.keys(orders.snapshot.orders).length} orders` : '') +
        ` in ${seconds} s`,
    );
  } catch (error) {
    console.error('[star-citizen-hangar-manager] Sync failed', error);
  } finally {
    state.running = false;
    state.progress = null;
  }
}

/**
 * Reads a single storage again completely (from the settings): the hangar, the buy back, the
 * whole order history, or the data of the upgrade tool (ships, ships on sale and warbond offers
 * are one read). Not while another sync runs.
 */
export async function startStorageSync(id: StorageId): Promise<void> {
  if (state.running || id === 'settings' || id === 'paintPlan') return;
  state.running = true;
  state.storage = id;
  state.progress = null;
  try {
    const progress = new SyncProgressTracker((value) => (state.progress = value));
    const section = progress.section(id);
    if (id === 'hangar' || id === 'buyback') {
      const run = await (id === 'hangar' ? prepareHangarSync : prepareBuybackSync)({
        progress: section,
      });
      progress.start();
      await run();
      await recordSync(id === 'hangar' ? hangarMeta : buybackMeta);
    } else if (id === 'orders') {
      const run = await prepareOrderSync({ progress: section, full: true });
      progress.start();
      await run();
    } else {
      section.expect(1, 1);
      progress.start();
      await (id === 'storeItems'
        ? refreshStoreItems()
        : id === 'storeCredit'
          ? refreshStoreCredit()
          : id === 'events'
            ? maybeRefreshEvents({ force: true })
            : refreshUpgradeTool());
      section.complete(1, 1);
    }
  } catch (error) {
    console.error(`[star-citizen-hangar-manager] Reading ${id} failed`, error);
  } finally {
    state.running = false;
    state.storage = undefined;
    state.progress = null;
  }
}

/**
 * Runs a smart update of orders, buy back and hangar if it is enabled and due (see
 * `smartUpdateMinutes` in the settings). Three checks work together: the new pledge log entries
 * name changed pledges, a pledge new in the buy back must be gone from the hangar, and first,
 * last and spot check pages find the rest (see `smart-update/check.ts`). `force` skips the
 * interval, e.g. when returning from "My Gear".
 *
 * Called when the manager is shown, every 10 seconds while it stays visible (see
 * `smart-update/schedule.ts`) and after exchanges and gifts. Only one tab checks at a time: the
 * others skip, and as `checkedAt` is read inside the lock, they find the check done afterwards.
 */
export async function maybeRunSmartUpdate({ force = false } = {}): Promise<void> {
  if (state.running || claimed) return;
  // Claimed right away, so triggers firing at the same time don't start two checks.
  claimed = true;
  try {
    await withSmartUpdateLock(() => runSmartUpdateIfDue(force));
  } finally {
    claimed = false;
  }
}

let elsewhereTimeout: ReturnType<typeof setTimeout> | undefined;

/**
 * A check started (`true`) or ended in another tab. If its end never arrives (the tab was closed
 * meanwhile), it counts as ended after `SMART_UPDATE.checkingElsewhereMaxMs`.
 */
export function setCheckingElsewhere(checking: boolean): void {
  clearTimeout(elsewhereTimeout);
  state.checkingElsewhere = checking;
  if (checking) {
    elsewhereTimeout = setTimeout(
      () => (state.checkingElsewhere = false),
      SMART_UPDATE.checkingElsewhereMaxMs,
    );
  }
}

/** Inside the lock: whether a check is due is decided here, after the lock. */
async function runSmartUpdateIfDue(force: boolean): Promise<void> {
  // Ships, ships on sale and warbond offers: on their own interval (see the settings), once a
  // day with smart updates off.
  await maybeRefreshUpgradeTool();
  // The items of the Pledge Store, on their own interval (see the settings).
  await maybeRefreshStoreItems();
  // The events of the project website: once a day; tells the ones whose display period started.
  await maybeRefreshEvents();
  const settings = withDefaults(await settingsItem.getValue());
  if (!settings.smartUpdates) return;
  const { checkedAt } = await hangarMeta.getValue();
  // The set interval, longer while checks find nothing and nobody uses the tabs (#125).
  const intervalMinutes = await currentIntervalMinutes(settings.smartUpdateMinutes);
  if (!force && !isCheckDue({ checkedAt, intervalMinutes, now: Date.now() })) return;

  // Shown as "Checking …", here and in the other tabs.
  state.checking = true;
  announceCheck(true);
  try {
    await recordCheckResult(await runChecks(settings.spotCheckPages));
  } finally {
    state.checking = false;
    announceCheck(false);
  }
}

/** Runs the checks; whether they found anything (a new log entry or a changed pledge). */
async function runChecks(spotCheckPages: number): Promise<boolean> {
  // The store credit: one small request, it changes with exchanges and store credit purchases.
  await refreshStoreCredit();

  // 1. The pledge log: every action on the account is on its first page, also on old pledges.
  //    The pledges it names are checked in the buy back and the hangar (see `pledge-log.ts`).
  //    Usually one page of the log and of the billing list.
  const orders = await updateOrders().catch((error: unknown) => {
    console.warn('[star-citizen-hangar-manager] Order update failed', error);
    return null;
  });
  const logIds = pledgeIdsOfLogEntries(orders?.newLogEntries ?? []);

  // 2. The buy back first: a pledge new there was melted, so it has to be gone from the hangar.
  const melted: number[] = [];
  const buyback = await runLogged('Buy back smart update', buybackMeta, () =>
    runBuybackSmartUpdate({
      hintIds: logIds,
      onChanges: ({ added }) => melted.push(...added.map((pledge) => pledge.id)),
    }),
  );

  // 3. The hangar: first and last page, spot checks, and the pages of the pledges above.
  const hintIds = [...new Set([...logIds, ...melted])];
  const hangar = await runLogged('Smart update', hangarMeta, () =>
    runSmartUpdate({ spotCheckPages, hintIds }),
  );
  return logIds.length > 0 || hasChanges(buyback) || hasChanges(hangar);
}

const hasChanges = (outcome: CheckOutcome | null | undefined) =>
  !!outcome && outcome.added + outcome.removed + outcome.changed > 0;

async function runLogged(
  label: string,
  meta: MetaItem,
  run: () => Promise<CheckOutcome | null>,
): Promise<CheckOutcome | null> {
  const startedAt = performance.now();
  try {
    const outcome = await run();
    if (!outcome) return null;
    const ms = Math.round(performance.now() - startedAt);
    console.info(
      `[star-citizen-hangar-manager] ${label}: ${outcome.status} ` +
        `(+${outcome.added} / -${outcome.removed} / ~${outcome.changed}) in ${ms} ms`,
    );
    return outcome;
  } catch (error) {
    console.error(`[star-citizen-hangar-manager] ${label} failed`, error);
    // Counts as a check, so a broken connection isn't retried on every trigger.
    await recordCheck(meta, { status: 'failed' });
    return null;
  }
}
