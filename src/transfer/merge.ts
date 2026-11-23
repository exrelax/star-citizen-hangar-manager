import { PLEDGE_STORE } from '@/config';
import type { MeltMarks } from '@/hangar/melt-marks';
import type { StorageId } from '@/storage/registry';
import {
  COMPLETED_PLANS_KEPT,
  type CompletedPaintPlan,
  type CompletedPlansSnapshot,
} from '@/store/paint-consultant/completed-plans';
import type { AnyStoredRebuyPlan } from '@/store/paint-consultant/rebuy-plan-storage';
import {
  completedIdOf,
  COMPLETED_PLANS_VERSION,
  mergeCompleted,
} from '@/store/paint-consultant/synced-plans';
import {
  WARBOND_HISTORY_VERSION,
  type SightingEvent,
  type WarbondHistorySnapshot,
  type WarbondSighting,
} from '@/store/warbond-history';
import { itemKey, type WatchItem, type Watchlist } from '@/watchlists/watchlists';
import type { Values } from './settings-import';

/*
 * Merging the user's own data on import (#634), instead of replacing it: data that can't be read
 * again from RSI and may differ between two browsers. Each storage merges by its own rule, and
 * the preview counts what each choice does – added, changed, kept and left out. The merged values
 * are written like a replace (`writeSettingsImport`), so the synced storage's limits are checked
 * for all of them together first.
 */

/** The storages that can be merged: the user's own data. */
export const MERGEABLE = [
  'watchlists',
  'meltMarks',
  'paintPlan',
  'paintHistory',
  'warbondHistory',
] as const satisfies readonly StorageId[];
export type Mergeable = (typeof MERGEABLE)[number];

export const isMergeable = (id: StorageId): id is Mergeable =>
  (MERGEABLE as readonly StorageId[]).includes(id);

export type ImportMode = 'merge' | 'replace';

/** What a merge or a replace does to a storage. */
export interface MergeCounts {
  /** Only in the file, added here. */
  added: number;
  /** In both, changed here. */
  changed: number;
  /** Here, staying as it is. */
  kept: number;
  /** Not taken over: here (replace, the plan not kept) or from the file (beyond the limit). */
  leftOut: number;
}

export interface Merged<T> {
  value: T;
  counts: MergeCounts;
}

const counts = (partial: Partial<MergeCounts>): MergeCounts => ({
  added: 0,
  changed: 0,
  kept: 0,
  leftOut: 0,
  ...partial,
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---- Watchlists ----

/** Both items' union by item key, the higher count; the earlier added wins its other fields. */
function mergeItems(here: readonly WatchItem[], file: readonly WatchItem[]): WatchItem[] {
  const merged = new Map(here.map((item) => [itemKey(item), item]));
  for (const item of file) {
    const key = itemKey(item);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }
    const count = Math.max(existing.count ?? 1, item.count ?? 1);
    if (count !== (existing.count ?? 1)) merged.set(key, { ...existing, count } as WatchItem);
  }
  return [...merged.values()];
}

/**
 * By their id: a list only in the file is added; one in both keeps the newer name, description,
 * date and reminder (`changedAt`) and the union of their items. The order of this browser, then
 * the file's new lists.
 */
export function mergeWatchlists(
  here: readonly Watchlist[],
  file: readonly Watchlist[],
): Merged<Watchlist[]> {
  const fromFile = new Map(file.map((list) => [list.id, list]));
  let changed = 0;
  let kept = 0;
  const merged = here.map((list) => {
    const other = fromFile.get(list.id);
    if (!other) {
      kept += 1;
      return list;
    }
    const newer = other.changedAt > list.changedAt ? other : list;
    const result: Watchlist = {
      ...newer,
      id: list.id,
      items: mergeItems(list.items, other.items),
      createdAt: Math.min(list.createdAt, other.createdAt),
      changedAt: Math.max(list.changedAt, other.changedAt),
    };
    if (same(result, list)) kept += 1;
    else changed += 1;
    return result;
  });
  const known = new Set(here.map((list) => list.id));
  const added = file.filter((list) => !known.has(list.id));
  return { value: [...merged, ...added], counts: counts({ added: added.length, changed, kept }) };
}

// ---- Marks to melt ----

/** The union by pledge id, the earlier mark time. */
export function mergeMeltMarks(here: MeltMarks, file: MeltMarks): Merged<MeltMarks> {
  const merged: Record<string, number> = { ...here };
  let added = 0;
  let changed = 0;
  for (const [id, at] of Object.entries(file)) {
    if (merged[id] === undefined) {
      merged[id] = at;
      added += 1;
    } else if (at < merged[id]!) {
      merged[id] = at;
      changed += 1;
    }
  }
  const kept = Object.keys(here).length - changed;
  return { value: merged, counts: counts({ added, changed, kept }) };
}

// ---- The running paint plan ----

/** Which running plan to keep when both have one: only one can run, never both. */
export type KeepPlan = 'here' | 'file';

/** Without a plan here the file's is taken; with one, the one chosen. */
export function mergePaintPlan(
  here: AnyStoredRebuyPlan | null,
  file: AnyStoredRebuyPlan | null,
  keep: KeepPlan = 'here',
): Merged<AnyStoredRebuyPlan | null> {
  if (!file) return { value: here, counts: counts({ kept: here ? 1 : 0 }) };
  if (!here) return { value: file, counts: counts({ added: 1 }) };
  if (same(here, file)) return { value: here, counts: counts({ kept: 1 }) };
  return keep === 'file'
    ? { value: file, counts: counts({ changed: 1, leftOut: 1 }) }
    : { value: here, counts: counts({ kept: 1, leftOut: 1 }) };
}

// ---- Completed paint plans ----

/** The union by plan (start time and way), newest first, at most `COMPLETED_PLANS_KEPT`. */
export function mergePaintHistory(
  here: CompletedPlansSnapshot | null,
  file: CompletedPlansSnapshot | null,
): Merged<CompletedPlansSnapshot> {
  const herePlans: CompletedPaintPlan[] = here?.plans ?? [];
  const filePlans: CompletedPaintPlan[] = file?.plans ?? [];
  const all = mergeCompleted(herePlans, filePlans);
  const plans = all.slice(0, COMPLETED_PLANS_KEPT);
  const kept = new Set(plans.map(completedIdOf));
  const hereIds = new Set(herePlans.map(completedIdOf));
  const added = filePlans.filter(
    (plan) => !hereIds.has(completedIdOf(plan)) && kept.has(completedIdOf(plan)),
  );
  return {
    value: { version: COMPLETED_PLANS_VERSION, plans },
    counts: counts({
      added: added.length,
      kept: herePlans.filter((plan) => kept.has(completedIdOf(plan))).length,
      leftOut: all.length - plans.length,
    }),
  };
}

// ---- Warbond history ----

const offerOf = (sighting: WarbondSighting) => `${sighting.skuId}:${sighting.price}`;
const overlaps = (a: WarbondSighting, b: WarbondSighting) =>
  a.firstSeen <= b.lastSeen && b.firstSeen <= a.lastSeen;

function joinEvents(a: SightingEvent[] = [], b: SightingEvent[] = []): SightingEvent[] | undefined {
  const events = [...a, ...b.filter((event) => !a.some((other) => other.id === event.id))];
  return events.length ? events : undefined;
}

/** One sighting of two of the same offer that overlap: the earliest first seen, the latest last. */
function joinSightings(a: WarbondSighting, b: WarbondSighting): WarbondSighting {
  const later = b.lastSeen > a.lastSeen ? b : a;
  const events = joinEvents(
    a.firstSeen <= b.firstSeen ? a.events : b.events,
    a.firstSeen <= b.firstSeen ? b.events : a.events,
  );
  const expectedEnd = later.expectedEnd ?? (later === a ? b : a).expectedEnd;
  return {
    ...later,
    firstSeen: Math.min(a.firstSeen, b.firstSeen),
    lastSeen: Math.max(a.lastSeen, b.lastSeen),
    ...(events ? { events } : {}),
    ...(expectedEnd !== undefined ? { expectedEnd } : {}),
  };
}

/**
 * The union of the sightings by SKU and price; overlapping ones of the same offer become one
 * (earliest first seen, latest last seen, their events and the expected end). Oldest first, the
 * newest `PLEDGE_STORE.historyMax`.
 */
export function mergeWarbondHistory(
  here: WarbondHistorySnapshot | null,
  file: WarbondHistorySnapshot | null,
): Merged<WarbondHistorySnapshot> {
  const merged: WarbondSighting[] = [...(here?.sightings ?? [])];
  let added = 0;
  const changedAt = new Set<number>();
  for (const sighting of file?.sightings ?? []) {
    const index = merged.findIndex(
      (other) => offerOf(other) === offerOf(sighting) && overlaps(other, sighting),
    );
    if (index < 0) {
      merged.push(sighting);
      added += 1;
      continue;
    }
    const joined = joinSightings(merged[index]!, sighting);
    if (!same(joined, merged[index])) {
      merged[index] = joined;
      if (index < (here?.sightings.length ?? 0)) changedAt.add(index);
    }
  }
  merged.sort((a, b) => a.firstSeen - b.firstSeen);
  const sightings = merged.slice(-PLEDGE_STORE.historyMax);
  const hereCount = here?.sightings.length ?? 0;
  return {
    value: {
      version: WARBOND_HISTORY_VERSION,
      lastReadAt: Math.max(here?.lastReadAt ?? 0, file?.lastReadAt ?? 0),
      sightings,
    },
    counts: counts({
      added,
      changed: changedAt.size,
      kept: hereCount - changedAt.size,
      leftOut: merged.length - sightings.length,
    }),
  };
}

// ---- All of them ----

/** What a replace does: the file's entries come in, this browser's go. */
export const replaceCounts = (here: number, file: number): MergeCounts =>
  counts({ added: file, leftOut: here });

/** One storage merged with the file's value. */
export function mergeStorage(
  id: Mergeable,
  here: unknown,
  file: unknown,
  keepPlan: KeepPlan = 'here',
): Merged<unknown> {
  switch (id) {
    case 'watchlists':
      return mergeWatchlists((here as Watchlist[] | null) ?? [], file as Watchlist[]);
    case 'meltMarks':
      return mergeMeltMarks((here as MeltMarks | null) ?? {}, file as MeltMarks);
    case 'paintPlan':
      return mergePaintPlan(
        here as AnyStoredRebuyPlan | null,
        file as AnyStoredRebuyPlan | null,
        keepPlan,
      );
    case 'paintHistory':
      return mergePaintHistory(
        here as CompletedPlansSnapshot | null,
        file as CompletedPlansSnapshot,
      );
    case 'warbondHistory':
      return mergeWarbondHistory(
        here as WarbondHistorySnapshot | null,
        file as WarbondHistorySnapshot,
      );
  }
}

/** Whether both sides have a running plan that differs: the user chooses which to keep. */
export const plansCollide = (here: Values, file: Values) =>
  !!here.paintPlan && !!file.paintPlan && !same(here.paintPlan, file.paintPlan);

/**
 * The values to write: the file's, with each storage of the user's data merged with this
 * browser's unless it is to be replaced (merge by default); the settings are always replaced.
 */
export function valuesToWrite(
  file: Values,
  here: Values,
  modes: Partial<Record<Mergeable, ImportMode>> = {},
  keepPlan: KeepPlan = 'here',
): Values {
  return Object.fromEntries(
    (Object.keys(file) as StorageId[]).map((id) => [
      id,
      isMergeable(id) && (modes[id] ?? 'merge') === 'merge'
        ? mergeStorage(id, here[id] ?? null, file[id], keepPlan).value
        : file[id],
    ]),
  );
}
