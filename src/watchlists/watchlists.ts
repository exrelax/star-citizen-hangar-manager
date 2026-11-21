/*
 * Watchlists (#464, #465): items of My Hangar, the Buy Back and the Pledge Store collected under a
 * name of the user's choice, with a description and optionally a date with a reminder ("Melt after
 * the IAE", "CCUs to buy when back in stock"). An item can be on any number of watchlists.
 *
 * Each entry remembers what identifies its item and the name and value it had when last seen, so a
 * pledge that leaves the hangar or the buy back (melted, gifted, bought back) stays on the list with
 * its last name, marked as gone (`presenceOf`), until it is removed. Store items carry a count.
 *
 * Only pure functions here; the storage is in `watchlists-storage.ts`.
 */

/** Where an item comes from: a pledge of My Hangar or the Buy Back, a CCU or a paint of the store. */
export type WatchItemKind = 'hangar' | 'buyback' | 'storeCcu' | 'storePaint';
export const WATCH_ITEM_KINDS: readonly WatchItemKind[] = [
  'hangar',
  'buyback',
  'storeCcu',
  'storePaint',
];

/** What identifies an item, by its kind. */
export type WatchItemRef =
  | { kind: 'hangar' | 'buyback'; pledgeId: number }
  | { kind: 'storeCcu'; fromShipId: number; toShipId: number }
  | { kind: 'storePaint'; skuId: number };

export type WatchItem = WatchItemRef & {
  /** The name when last seen, e.g. "Upgrade - Cutlass Black to Carrack Standard Edition". */
  name: string;
  /** The value in USD when last seen: a pledge's value, a store item's price. */
  value?: number;
  /** How many of a store item; 1 unless set (never for pledges). */
  count?: number;
  /** When it was added (ms). */
  addedAt: number;
};

export interface Watchlist {
  /** Made-up, stable id. */
  id: string;
  name: string;
  description: string;
  /** The date it is about, with its time (ms); none without a date. */
  dueAt?: number;
  /** A reminder at `dueAt` (#469). */
  reminder: boolean;
  /**
   * The date (ms) whose reminder was dismissed in the sidebar (#469): it doesn't show again for
   * that date, but a new date reminds again.
   */
  reminderDone?: number;
  items: WatchItem[];
  createdAt: number;
  changedAt: number;
}

/** The longest name and description, so a list stays small in the synced storage. */
export const WATCHLIST_LIMITS = { name: 80, description: 500, count: 99 } as const;

/** A key of an item, the same for the same item on every watchlist. */
export function itemKey(ref: WatchItemRef): string {
  switch (ref.kind) {
    case 'hangar':
      return `h:${ref.pledgeId}`;
    case 'buyback':
      return `b:${ref.pledgeId}`;
    case 'storeCcu':
      return `c:${ref.fromShipId}-${ref.toShipId}`;
    case 'storePaint':
      return `p:${ref.skuId}`;
  }
}

const isStoreItem = (ref: WatchItemRef) => ref.kind === 'storeCcu' || ref.kind === 'storePaint';

/** A store item's count, 1 to `WATCHLIST_LIMITS.count`. */
const countOf = (count: number | undefined) =>
  Math.min(WATCHLIST_LIMITS.count, Math.max(1, Math.round(count ?? 1)));

const trimmed = (text: string, max: number) => text.trim().slice(0, max);

/** A made-up id: time and chance, short enough for the synced storage's keys. */
export const newWatchlistId = (now: number, random = Math.random): string =>
  now.toString(36) +
  Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0');

/** A new, empty watchlist. */
export function createWatchlist(
  fields: { name: string; description?: string; dueAt?: number; reminder?: boolean },
  now: number,
  id = newWatchlistId(now),
): Watchlist {
  return {
    id,
    name: trimmed(fields.name, WATCHLIST_LIMITS.name),
    description: trimmed(fields.description ?? '', WATCHLIST_LIMITS.description),
    ...(fields.dueAt !== undefined && { dueAt: fields.dueAt }),
    // A reminder only with a date.
    reminder: fields.dueAt !== undefined && (fields.reminder ?? true),
    items: [],
    createdAt: now,
    changedAt: now,
  };
}

/** The watchlist with its name, description, date or reminder changed; `dueAt: null` drops it. */
export function updateWatchlist(
  list: Watchlist,
  patch: { name?: string; description?: string; dueAt?: number | null; reminder?: boolean },
  now: number,
): Watchlist {
  const dueAt = patch.dueAt === null ? undefined : (patch.dueAt ?? list.dueAt);
  const rest: Watchlist = { ...list };
  delete rest.dueAt;
  return {
    ...rest,
    ...(patch.name !== undefined && { name: trimmed(patch.name, WATCHLIST_LIMITS.name) }),
    ...(patch.description !== undefined && {
      description: trimmed(patch.description, WATCHLIST_LIMITS.description),
    }),
    ...(dueAt !== undefined && { dueAt }),
    reminder: dueAt !== undefined && (patch.reminder ?? list.reminder),
    changedAt: now,
  };
}

/**
 * The watchlist with the item on it: a new one at the end; one already on it gets the name and
 * value given, and a store item the count given (or keeps its own).
 */
export function addItem(
  list: Watchlist,
  item: WatchItemRef & { name: string; value?: number; count?: number },
  now: number,
): Watchlist {
  const key = itemKey(item);
  const existing = list.items.find((entry) => itemKey(entry) === key);
  const { count, value, ...rest } = item;
  const entry = {
    ...rest,
    ...(value !== undefined && { value }),
    ...(isStoreItem(item) && { count: countOf(count ?? existing?.count) }),
    addedAt: existing?.addedAt ?? now,
  } as WatchItem;
  const items = existing
    ? list.items.map((current) => (current === existing ? entry : current))
    : [...list.items, entry];
  return { ...list, items, changedAt: now };
}

/** The watchlist without the item; itself when the item isn't on it. */
export function removeItem(list: Watchlist, key: string, now: number): Watchlist {
  const items = list.items.filter((entry) => itemKey(entry) !== key);
  return items.length === list.items.length ? list : { ...list, items, changedAt: now };
}

/** The watchlist with a store item's count changed (1 to 99); pledges have none. */
export function setItemCount(list: Watchlist, key: string, count: number, now: number): Watchlist {
  let changed = false;
  const items = list.items.map((entry) => {
    if (itemKey(entry) !== key || !isStoreItem(entry)) return entry;
    const next = countOf(count);
    if (next === entry.count) return entry;
    changed = true;
    return { ...entry, count: next };
  });
  return changed ? { ...list, items, changedAt: now } : list;
}

/** The watchlists an item is on. */
export const listsWith = (lists: readonly Watchlist[], key: string): Watchlist[] =>
  lists.filter((list) => list.items.some((entry) => itemKey(entry) === key));

// ---- Items that left the hangar or the buy back ----

/** What the stored hangar and buy back know, to tell whether a pledge is still there. */
export interface PledgeLists {
  /** The hangar's pledges, if it was read, and when it was last updated (ms). */
  hangar?: {
    pledges: readonly { id: number; title: string; valueUsd?: number }[];
    updatedAt: number;
  };
  buyback?: {
    pledges: readonly { id: number; title: string; price?: { amount: number } | null }[];
    updatedAt: number;
  };
}

/**
 * Where a pledge of a watchlist stands: still there (`present`), gone from its list (`gone`, with
 * where it is now if the other list has it: a melted pledge keeps its id in the buy back, a pledge
 * bought back its id in the hangar), or not known while its list wasn't read. Only a pledge added
 * before its list was last updated can be gone: another device may have added one this browser's
 * list doesn't know yet. Store items are always `present` here.
 */
export type Presence =
  { state: 'present' } | { state: 'unknown' } | { state: 'gone'; nowIn?: 'hangar' | 'buyback' };

export function presenceOf(item: WatchItem, lists: PledgeLists): Presence {
  if (item.kind !== 'hangar' && item.kind !== 'buyback') return { state: 'present' };
  const own = item.kind === 'hangar' ? lists.hangar : lists.buyback;
  const other = item.kind === 'hangar' ? lists.buyback : lists.hangar;
  if (!own) return { state: 'unknown' };
  if (own.pledges.some((pledge) => pledge.id === item.pledgeId)) return { state: 'present' };
  if (item.addedAt >= own.updatedAt) return { state: 'unknown' };
  const moved = other?.pledges.some((pledge) => pledge.id === item.pledgeId);
  return { state: 'gone', ...(moved && { nowIn: item.kind === 'hangar' ? 'buyback' : 'hangar' }) };
}

const hangarSeen = (lists: PledgeLists, id: number) => {
  const pledge = lists.hangar?.pledges.find((entry) => entry.id === id);
  return pledge && { name: pledge.title, value: pledge.valueUsd };
};
const buybackSeen = (lists: PledgeLists, id: number) => {
  const pledge = lists.buyback?.pledges.find((entry) => entry.id === id);
  return pledge && { name: pledge.title, value: pledge.price?.amount };
};

/**
 * The watchlist with the names and values of its pledges as the lists show them now; itself when
 * nothing changed. A pledge gone keeps what it had.
 */
export function withLastSeen(list: Watchlist, lists: PledgeLists): Watchlist {
  let changed = false;
  const items = list.items.map((entry) => {
    const seen =
      entry.kind === 'hangar'
        ? hangarSeen(lists, entry.pledgeId)
        : entry.kind === 'buyback'
          ? buybackSeen(lists, entry.pledgeId)
          : undefined;
    if (!seen) return entry;
    if (seen.name === entry.name && (seen.value === undefined || seen.value === entry.value)) {
      return entry;
    }
    changed = true;
    return { ...entry, name: seen.name, ...(seen.value !== undefined && { value: seen.value }) };
  });
  return changed ? { ...list, items } : list;
}

// ---- Reminders (#469) ----

/** Whether the watchlist's reminder is due at `now`: on, its date reached and not dismissed. */
export const isReminderDue = (list: Watchlist, now: number): boolean =>
  list.reminder &&
  list.dueAt !== undefined &&
  list.dueAt <= now &&
  list.reminderDone !== list.dueAt;

/** The watchlists whose reminder is due at `now`, the earliest date first. */
export const dueReminders = (lists: readonly Watchlist[], now: number): Watchlist[] =>
  lists.filter((list) => isReminderDue(list, now)).sort((a, b) => a.dueAt! - b.dueAt!);

/** When the next reminder is due after `now`, if any. */
export function nextReminderAt(lists: readonly Watchlist[], now: number): number | undefined {
  const ahead = lists.flatMap((list) =>
    list.reminder && list.dueAt !== undefined && list.dueAt > now ? [list.dueAt] : [],
  );
  return ahead.length ? Math.min(...ahead) : undefined;
}

/** The watchlist with its due reminder dismissed (until a new date). */
export const withReminderDone = (list: Watchlist): Watchlist =>
  list.dueAt === undefined ? list : { ...list, reminderDone: list.dueAt };

/** The watchlist with a dismissed reminder showing again. */
export function withReminderRestored(list: Watchlist): Watchlist {
  if (list.reminderDone === undefined) return list;
  const rest = { ...list };
  delete rest.reminderDone;
  return rest;
}

/** A reminder told for a watchlist and its date, e.g. by the browser (`<id>@<date>`). */
export const reminderKey = (list: Watchlist): string => `${list.id}@${list.dueAt ?? ''}`;
