import { itemKey, type WatchItem, type Watchlist } from './watchlists';

/*
 * The watchlists in the browser's synced storage (#465), so they follow the browser profile to
 * other devices like the marks to melt (#144). The synced storage is small – Chrome and Firefox
 * allow 8 KB per key, 100 KB in all and 512 keys –, so:
 * - each watchlist is a key of its own (`sync:watchlist.<id>`), the order of the lists one more
 *   (`sync:watchlists`): a big list never blocks the others, and a change writes one list only;
 * - a list is stored compactly (`StoredWatchlist`): short field names, an item as a tuple, times in
 *   seconds;
 * - every write is measured first, and one that wouldn't fit fails with a `WatchlistQuotaError`
 *   that says which limit it reached, before anything is written.
 * The demo (#474) has lists of its own in this browser only (`local:demo.watchlist…`), never the
 * account's.
 */

/** The synced storage's limits, the same in Chrome and Firefox. */
export const SYNC_QUOTA = { perItem: 8192, total: 102_400, maxItems: 512 } as const;

const VERSION = 1;

/**
 * An item as stored: [kind, its id, name, added (s), value?, count?]. A CCU's id is
 * `<from>-<to>`, a standalone ship's `<ship>` or `<ship>:<insurance>` (`lti` or months, #470).
 */
type StoredItem =
  | [
      kind: 'h' | 'b' | 'p',
      ref: number,
      name: string,
      addedAt: number,
      value?: number | null,
      count?: number,
    ]
  | [
      kind: 'c' | 's',
      ref: string,
      name: string,
      addedAt: number,
      value?: number | null,
      count?: number,
    ];

/** A watchlist as stored. */
export interface StoredWatchlist {
  v: typeof VERSION;
  /** Name, description. */
  n: string;
  d?: string;
  /** Its date (s), with a reminder (`r: 1`); the date whose reminder was dismissed (`x`, #469). */
  t?: number;
  r?: 1;
  x?: number;
  /** Notifications on changes of its Pledge Store items (`a: 1`, #472). */
  a?: 1;
  /** Created and changed (s). */
  c: number;
  u: number;
  i: StoredItem[];
}

/** The order of the watchlists, by id. */
export interface StoredWatchlistIndex {
  v: typeof VERSION;
  ids: string[];
}

const seconds = (ms: number) => Math.round(ms / 1000);
const ms = (s: number) => s * 1000;

function encodeItem(item: WatchItem): StoredItem {
  const tail = (stored: StoredItem): StoredItem => {
    if (item.count !== undefined && item.count !== 1) {
      stored.push(item.value ?? null, item.count);
    } else if (item.value !== undefined) {
      stored.push(item.value);
    }
    return stored;
  };
  const added = seconds(item.addedAt);
  switch (item.kind) {
    case 'hangar':
      return tail(['h', item.pledgeId, item.name, added]);
    case 'buyback':
      return tail(['b', item.pledgeId, item.name, added]);
    case 'storePaint':
      return tail(['p', item.skuId, item.name, added]);
    case 'storeCcu':
      return tail(['c', `${item.fromShipId}-${item.toShipId}`, item.name, added]);
    case 'storeShip':
      return tail([
        's',
        item.insurance === undefined ? `${item.shipId}` : `${item.shipId}:${item.insurance}`,
        item.name,
        added,
      ]);
  }
}

function decodeItem(stored: unknown): WatchItem | undefined {
  if (!Array.isArray(stored) || stored.length < 4) return undefined;
  const [kind, ref, name, added, value, count] = stored as unknown[];
  if (typeof name !== 'string' || typeof added !== 'number') return undefined;
  const common = {
    name,
    addedAt: ms(added),
    ...(typeof value === 'number' && { value }),
  };
  const storeCount = { count: typeof count === 'number' && count > 0 ? count : 1 };
  if ((kind === 'h' || kind === 'b') && typeof ref === 'number') {
    return { kind: kind === 'h' ? 'hangar' : 'buyback', pledgeId: ref, ...common };
  }
  if (kind === 'p' && typeof ref === 'number') {
    return { kind: 'storePaint', skuId: ref, ...common, ...storeCount };
  }
  if (kind === 'c' && typeof ref === 'string') {
    const match = /^(\d+)-(\d+)$/.exec(ref);
    if (!match) return undefined;
    const [fromShipId, toShipId] = [Number(match[1]), Number(match[2])];
    return { kind: 'storeCcu', fromShipId, toShipId, ...common, ...storeCount };
  }
  if (kind === 's' && typeof ref === 'string') {
    const match = /^(\d+)(?::(lti|\d+))?$/.exec(ref);
    if (!match) return undefined;
    const insurance =
      match[2] === undefined ? undefined : match[2] === 'lti' ? 'lti' : Number(match[2]);
    return {
      kind: 'storeShip',
      shipId: Number(match[1]),
      ...(insurance !== undefined && { insurance }),
      ...common,
      ...storeCount,
    } as WatchItem;
  }
  return undefined;
}

/** A watchlist as stored. */
export function encodeWatchlist(list: Watchlist): StoredWatchlist {
  return {
    v: VERSION,
    n: list.name,
    ...(list.description && { d: list.description }),
    ...(list.dueAt !== undefined && { t: seconds(list.dueAt) }),
    ...(list.reminder && list.dueAt !== undefined && { r: 1 as const }),
    ...(list.reminderDone !== undefined && { x: seconds(list.reminderDone) }),
    ...(list.storeAlerts && { a: 1 as const }),
    c: seconds(list.createdAt),
    u: seconds(list.changedAt),
    i: list.items.map(encodeItem),
  };
}

/** A stored watchlist, checked; unknown items are left out, an unknown format gives none. */
export function decodeWatchlist(id: string, stored: unknown): Watchlist | undefined {
  const value = stored as Partial<StoredWatchlist> | null | undefined;
  if (value?.v !== VERSION || typeof value.n !== 'string' || !Array.isArray(value.i)) {
    return undefined;
  }
  const seen = new Set<string>();
  const items = value.i.flatMap((entry) => {
    const item = decodeItem(entry);
    // Each item once, as `addItem` keeps it.
    if (!item || seen.has(itemKey(item))) return [];
    seen.add(itemKey(item));
    return [item];
  });
  return {
    id,
    name: value.n,
    description: typeof value.d === 'string' ? value.d : '',
    ...(typeof value.t === 'number' && { dueAt: ms(value.t) }),
    reminder: value.r === 1 && typeof value.t === 'number',
    ...(typeof value.x === 'number' && { reminderDone: ms(value.x) }),
    storeAlerts: value.a === 1,
    items,
    createdAt: ms(typeof value.c === 'number' ? value.c : 0),
    changedAt: ms(typeof value.u === 'number' ? value.u : 0),
  };
}

// ---- The size limits ----

/** Which limit of the synced storage a write would exceed. */
export type QuotaLimit = 'list' | 'total' | 'items';

/** A write of a watchlist that doesn't fit into the synced storage; nothing was written. */
export class WatchlistQuotaError extends Error {
  constructor(readonly limit: QuotaLimit) {
    super(`Watchlist doesn't fit into the synced storage (${limit})`);
    this.name = 'WatchlistQuotaError';
  }
}

const encoder = new TextEncoder();
/** What a key and its value take of the synced storage, as the browsers count it. */
export const bytesOf = (key: string, value: unknown): number =>
  encoder.encode(key).length + encoder.encode(JSON.stringify(value)).length;

/**
 * Which limit writing `value` under `key` would exceed, if any, given everything stored in the
 * synced storage now (`stored`, by key without the area).
 */
export function exceededLimit(
  key: string,
  value: unknown,
  stored: Readonly<Record<string, unknown>>,
): QuotaLimit | undefined {
  const size = bytesOf(key, value);
  if (size > SYNC_QUOTA.perItem) return 'list';
  const others = Object.entries(stored).filter(([other]) => other !== key);
  const total = others.reduce((sum, [other, data]) => sum + bytesOf(other, data), size);
  if (total > SYNC_QUOTA.total) return 'total';
  if (others.length + 1 > SYNC_QUOTA.maxItems) return 'items';
  return undefined;
}

// ---- Reading and writing ----

/** Where the lists are: the synced storage, or the demo's own in this browser. */
interface Area {
  prefix: 'sync:' | 'local:demo.';
  /** The browser's storage area, to measure what is stored. */
  area: 'sync' | 'local';
}
const areaOf = (demo: boolean): Area =>
  demo ? { prefix: 'local:demo.', area: 'local' } : { prefix: 'sync:', area: 'sync' };

const INDEX = 'watchlists';
const LIST = 'watchlist.';
const indexKey = (demo: boolean) => `${areaOf(demo).prefix}${INDEX}` as const;
const listKey = (id: string, demo: boolean) => `${areaOf(demo).prefix}${LIST}${id}` as const;

async function readIndex(demo: boolean): Promise<string[]> {
  const index = await storage.getItem<StoredWatchlistIndex>(indexKey(demo));
  return index?.v === VERSION && Array.isArray(index.ids)
    ? index.ids.filter((id) => typeof id === 'string')
    : [];
}

/** Every watchlist, in the user's order; a list whose key is missing or unreadable is left out. */
export async function loadWatchlists(demo = false): Promise<Watchlist[]> {
  const ids = await readIndex(demo);
  if (!ids.length) return [];
  const values = await storage.getItems(ids.map((id) => listKey(id, demo)));
  return ids.flatMap((id, index) => decodeWatchlist(id, values[index]?.value) ?? []);
}

/** Throws a `WatchlistQuotaError` if writing `value` under `key` wouldn't fit. */
async function ensureFits(key: string, value: unknown, demo: boolean): Promise<void> {
  // Only the synced storage is small; the demo's lists are in the local one.
  if (demo) return;
  const stored = await browser.storage.sync.get(null);
  const limit = exceededLimit(key.slice('sync:'.length), value, stored);
  if (limit) throw new WatchlistQuotaError(limit);
}

/** The browser's own quota error, e.g. when another device wrote meanwhile. */
const isQuotaError = (error: unknown) =>
  error instanceof Error && /quota|MAX_ITEMS|MAX_WRITE/i.test(error.message);

async function write(key: `${'sync:' | 'local:'}${string}`, value: unknown, demo: boolean) {
  await ensureFits(key, value, demo);
  try {
    await storage.setItem(key, value);
  } catch (error) {
    if (isQuotaError(error)) throw new WatchlistQuotaError('total');
    throw error;
  }
}

/**
 * Stores the watchlist, a new one at the end of the order. Throws a `WatchlistQuotaError` if it
 * doesn't fit; then nothing is written.
 */
export async function saveWatchlist(list: Watchlist, demo = false): Promise<void> {
  const ids = await readIndex(demo);
  const isNew = !ids.includes(list.id);
  const key = listKey(list.id, demo);
  const value = encodeWatchlist(list);
  // Measured before anything is written: a list that doesn't fit leaves the order as it was.
  await ensureFits(key, value, demo);
  if (isNew) await write(indexKey(demo), { v: VERSION, ids: [...ids, list.id] }, demo);
  try {
    await write(key, value, demo);
  } catch (error) {
    if (isNew) await storage.setItem(indexKey(demo), { v: VERSION, ids });
    throw error;
  }
}

/** Removes the watchlist with its items. */
export async function deleteWatchlist(id: string, demo = false): Promise<void> {
  const ids = await readIndex(demo);
  await storage.removeItem(listKey(id, demo));
  if (ids.includes(id)) {
    await storage.setItem(indexKey(demo), { v: VERSION, ids: ids.filter((other) => other !== id) });
  }
}

/** Puts the watchlists in the given order; ids not given keep their place after them. */
export async function reorderWatchlists(order: readonly string[], demo = false): Promise<void> {
  const ids = await readIndex(demo);
  const known = order.filter((id) => ids.includes(id));
  await storage.setItem(indexKey(demo), {
    v: VERSION,
    ids: [...known, ...ids.filter((id) => !known.includes(id))],
  });
}

/** Removes every watchlist (the demo's on a reset of the demo). */
export async function clearWatchlists(demo = false): Promise<void> {
  const ids = await readIndex(demo);
  await storage.removeItems([indexKey(demo), ...ids.map((id) => listKey(id, demo))]);
}

/**
 * The keys of the synced storage (without the area) that hold these lists in this order: the
 * index and a key per list, for an import that writes them at once (#230).
 */
export function watchlistEntries(lists: readonly Watchlist[]): Record<string, unknown> {
  if (!lists.length) return {};
  return {
    [INDEX]: { v: VERSION, ids: lists.map((list) => list.id) },
    ...Object.fromEntries(lists.map((list) => [`${LIST}${list.id}`, encodeWatchlist(list)])),
  };
}

/** Whether a key of the synced storage (without the area) holds the watchlists. */
export const isWatchlistKey = (key: string) => key === INDEX || key.startsWith(LIST);

/** Calls `callback` with every watchlist whenever one changes, also on another device. */
export function watchWatchlists(callback: (lists: Watchlist[]) => void, demo = false): () => void {
  const { area, prefix } = areaOf(demo);
  const names = prefix.slice(prefix.indexOf(':') + 1);
  const ours = (key: string) => key === `${names}${INDEX}` || key.startsWith(`${names}${LIST}`);
  const listener = (changes: Record<string, unknown>, areaName: string) => {
    if (areaName === area && Object.keys(changes).some(ours)) {
      void loadWatchlists(demo).then(callback);
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** The watchlists as one storage for the registry (`storage/registry.ts`). */
export const watchlistsItem = {
  key: indexKey(false),
  getValue: () => loadWatchlists(false),
  watch: (callback: (value: unknown) => void) => watchWatchlists(callback, false),
  removeValue: () => clearWatchlists(false),
};

/** The message key for a write that didn't fit, e.g. `watchlists.quota.list`. */
export const quotaMessageKey = (limit: QuotaLimit) => `watchlists.quota.${limit}` as const;
