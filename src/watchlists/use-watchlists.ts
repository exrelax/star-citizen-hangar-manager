import { openTabAt } from '@/hangar/open-tab-at';
import { i18n } from '@/i18n';
import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import {
  addItem,
  addItemCounts,
  createWatchlist,
  itemKey,
  removeItem,
  type WatchItemRef,
  type Watchlist,
} from './watchlists';
import {
  deleteWatchlist,
  loadWatchlists,
  quotaMessageKey,
  saveWatchlist,
  watchWatchlists,
  WatchlistQuotaError,
} from './watchlists-storage';

/*
 * The watchlists (#464) for the whole manager: the tab "Watchlists" (#467) and the rows of My
 * Hangar and the Buy Back (#468), which show and change the watchlists of their item. Read once and
 * followed while the manager is open, also changes from another device; the demo's own lists in the
 * demo (#474).
 */

const lists = shallowRef<Watchlist[]>([]);
const loaded = ref(false);
let demoMode = false;
/** Whether the watchlists shown are the demo's (#474). */
export const watchlistsDemo = ref(false);

/** Every watchlist, in the user's order. */
export const watchlists = computed(() => lists.value);
export const watchlistsLoaded = computed(() => loaded.value);

/** The watchlists of each item, by its key (`itemKey`). */
export const watchlistsByItem = computed(() => {
  const byItem = new Map<string, Watchlist[]>();
  for (const list of lists.value) {
    for (const item of list.items) {
      const key = itemKey(item);
      byItem.set(key, [...(byItem.get(key) ?? []), list]);
    }
  }
  return byItem;
});

/** Reads the watchlists and follows them; again when the demo mode changes. Once, by the manager. */
export function followWatchlists(demo: Ref<boolean>): () => void {
  let stop: (() => void) | undefined;
  let run = 0;
  const follow = async (on: boolean) => {
    const current = ++run;
    stop?.();
    stop = undefined;
    demoMode = on;
    watchlistsDemo.value = on;
    loaded.value = false;
    const read = await loadWatchlists(on);
    if (current !== run) return;
    lists.value = read;
    loaded.value = true;
    stop = watchWatchlists((value) => (lists.value = value), on);
  };
  const stopWatch = watch(demo, (on) => void follow(on), { immediate: true });
  return () => {
    stopWatch();
    stop?.();
  };
}

/** The lists with the watchlist put in, or `previous` of it put back (undefined: taken out). */
const withList = (all: Watchlist[], id: string, list: Watchlist | undefined): Watchlist[] => {
  const index = all.findIndex((other) => other.id === id);
  if (!list) return all.filter((other) => other.id !== id);
  return index < 0 ? [...all, list] : all.map((other, at) => (at === index ? list : other));
};

/** The writes one after another, so a quick second change never lands before the first (#658). */
let writes: Promise<unknown> = Promise.resolve();

/**
 * Writes the watchlist; its new state shows at once, so a quick next change builds on it, and the
 * storage's change confirms it. A failed write puts the watchlist back as it was and throws.
 */
export async function storeWatchlist(list: Watchlist): Promise<void> {
  const previous = lists.value.find((other) => other.id === list.id);
  lists.value = withList(lists.value, list.id, list);
  const write = writes.then(() => saveWatchlist(list, demoMode));
  writes = write.catch(() => undefined);
  try {
    await write;
  } catch (error) {
    // Only if nothing changed it since: a later change carries on from this state.
    if (lists.value.find((other) => other.id === list.id) === list) {
      lists.value = withList(lists.value, list.id, previous);
    }
    throw error;
  }
}

/** Removes the watchlist with its items. */
export async function removeWatchlist(id: string): Promise<void> {
  await deleteWatchlist(id, demoMode);
  lists.value = lists.value.filter((list) => list.id !== id);
}

/** What a write that failed says, e.g. that the synced storage is full. */
export function saveErrorOf(cause: unknown): string {
  return cause instanceof WatchlistQuotaError
    ? i18n.t(quotaMessageKey(cause.limit))
    : i18n.t('watchlists.saveFailed', [cause instanceof Error ? cause.message : String(cause)]);
}

/** An item to put on a watchlist: what identifies it, and its name and value now. */
export type NewWatchItem = WatchItemRef & { name: string; value?: number };

/** Puts the item on the watchlist with this id. */
export async function addToWatchlist(id: string, item: NewWatchItem): Promise<void> {
  const list = lists.value.find((other) => other.id === id);
  if (list) await storeWatchlist(addItem(list, item, Date.now()));
}

/** Takes the item off the watchlist with this id. */
export async function removeFromWatchlist(id: string, key: string): Promise<void> {
  const list = lists.value.find((other) => other.id === id);
  const next = list && removeItem(list, key, Date.now());
  if (next && next !== list) await storeWatchlist(next);
}

/**
 * Puts the items on the watchlist with this id (the selection of My Hangar, #549), in one write;
 * how many weren't on it yet.
 */
export async function addItemsToWatchlist(
  id: string,
  items: readonly NewWatchItem[],
): Promise<number> {
  const list = lists.value.find((other) => other.id === id);
  if (!list) return 0;
  const now = Date.now();
  const known = new Set(list.items.map(itemKey));
  const added = items.filter((item) => !known.has(itemKey(item))).length;
  await storeWatchlist(items.reduce((next, item) => addItem(next, item, now), list));
  return added;
}

/**
 * Puts the store items with their counts on the watchlist with this id, in one write: the counts
 * add to those already on it (pledges to rebuy, #531). How many were new and on it already.
 */
export async function addItemCountsToWatchlist(
  id: string,
  items: readonly (NewWatchItem & { count: number })[],
): Promise<{ added: number; raised: number }> {
  const list = lists.value.find((other) => other.id === id);
  if (!list) return { added: 0, raised: 0 };
  const { list: next, added, raised } = addItemCounts(list, items, Date.now());
  await storeWatchlist(next);
  return { added, raised };
}

/**
 * A new watchlist with this name and the items on it; optionally with a description, a date and a
 * reminder (pledges to rebuy, #531).
 */
export async function createWatchlistWithItems(
  name: string,
  items: readonly (NewWatchItem & { count?: number })[],
  fields: Omit<Parameters<typeof createWatchlist>[0], 'name'> = {},
): Promise<Watchlist> {
  const now = Date.now();
  const list = items.reduce(
    (next, item) => addItem(next, item, now),
    createWatchlist({ ...fields, name }, now),
  );
  await storeWatchlist(list);
  return list;
}

/** A new watchlist with this name and the item on it. */
export async function createWatchlistWith(name: string, item: NewWatchItem): Promise<Watchlist> {
  const now = Date.now();
  const list = addItem(createWatchlist({ name }, now), item, now);
  await storeWatchlist(list);
  return list;
}

// ---- Showing a watchlist from elsewhere (#469) ----

/** The top of the tab "Watchlists", where a link to a watchlist scrolls to. */
export const WATCHLISTS_TOP_ID = 'shm-watchlists-top';

/** The last request to show a watchlist (a reminder); `at` tells repeated ones apart. */
export const watchlistRequest = ref<{ id: string; at: number }>();

/** Switches to the tab "Watchlists" with the watchlist `id` open, and scrolls to its top. */
export function openWatchlist(id: string): void {
  watchlistRequest.value = { id, at: Date.now() };
  openTabAt('watchlists', WATCHLISTS_TOP_ID);
}
