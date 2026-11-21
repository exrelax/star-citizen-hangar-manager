import { i18n } from '@/i18n';
import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import {
  addItem,
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

/** Writes the watchlist; its new state shows at once, the storage's change confirms it. */
export async function storeWatchlist(list: Watchlist): Promise<void> {
  await saveWatchlist(list, demoMode);
  const index = lists.value.findIndex((other) => other.id === list.id);
  lists.value =
    index < 0
      ? [...lists.value, list]
      : lists.value.map((other, at) => (at === index ? list : other));
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

/** A new watchlist with this name and the item on it. */
export async function createWatchlistWith(name: string, item: NewWatchItem): Promise<Watchlist> {
  const now = Date.now();
  const list = addItem(createWatchlist({ name }, now), item, now);
  await storeWatchlist(list);
  return list;
}
