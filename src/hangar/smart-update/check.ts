import { HANGAR_PAGE_SIZE, SMART_UPDATE } from '@/config';
import type { Pledge } from '../pledge';
import { shipKey } from '../ship-images';

/*
 * Smart check of the stored hangar against RSI, without reading all pages.
 *
 * RSI lists pledges strictly by id, newest first. So every loaded page covers a closed id range:
 * all current pledges with an id in that range are on this page. Comparing the page with the
 * stored pledges of that range reveals exactly what was added, removed or changed there.
 *
 * Between two loaded pages the number of current pledges is known from their positions. If the
 * stored number for that id range differs, something changed in between, and the page in the
 * middle is loaded next (binary search). Changes that keep the number of pledges (one removed,
 * one older one added in the same range) are found by the rotating spot check pages.
 *
 * The algorithm works for any list sorted that way (hangar, buy back); `checkList` is the generic
 * core, `checkHangar` adds what is specific to the hangar.
 */

/** Anything listed by RSI in pages, newest id first. */
export interface ListEntry {
  id: number;
}

export interface ListPage<T extends ListEntry> {
  pledges: T[];
  /** Highest page number linked from the pager. */
  lastPage: number;
}

export interface CheckOptions<T extends ListEntry = Pledge> {
  fetchPage: (page: number) => Promise<ListPage<T>>;
  /** Position of the rotating spot check, kept between runs. */
  cursor: number;
  spotCheckPages?: number;
  maxRepairPages?: number;
}

export interface ListCheckOptions<T extends ListEntry> extends CheckOptions<T> {
  pageSize: number;
  /** Content as RSI shows it; a different fingerprint for the same id means "changed". */
  fingerprint: (entry: T) => string;
  /** Extra pages to load once the first diff is known (e.g. pledges changed by an applied CCU). */
  followUpPages?: (diff: ListDiff<T>, pageOf: (id: number) => number) => number[];
  /** Combines the fresh version of a changed entry with the stored one. */
  merge?: (fresh: T, stored: T) => T;
}

export interface ListDiff<T extends ListEntry> {
  fresh: Map<number, T>;
  added: T[];
  removed: T[];
  changed: T[];
}

interface CheckBase {
  /** Number of pages loaded. */
  requests: number;
  /** Cursor for the next run's spot check pages. */
  nextCursor: number;
}

export type CheckResult<T extends ListEntry = Pledge> = CheckBase &
  (
    | { status: 'unchanged' }
    | { status: 'needsFullSync' }
    | {
        status: 'updated';
        /** The complete new list, in RSI's order. */
        pledges: T[];
        added: T[];
        removed: T[];
        changed: T[];
      }
  );

/** Spot check pages for this run: the next ones in the rotation over pages 2 … lastPage - 1. */
export function pickSpotPages(cursor: number, lastPage: number, count: number) {
  const middle = lastPage - 2;
  if (middle <= 0 || count <= 0) return { pages: [] as number[], nextCursor: cursor };
  const take = Math.min(count, middle);
  const pages = Array.from({ length: take }, (_, index) => 2 + ((cursor + index) % middle));
  return { pages, nextCursor: (cursor + take) % middle };
}

/**
 * How much of a list one check covers: the first, the last and `count` spot check pages of
 * `lastPage` pages. `share` is the chance that a change on a random page shows in the next check;
 * after `checksToCoverAll` checks every page was checked once (the spot checks rotate).
 */
export function spotCheckCoverage(lastPage: number, count: number) {
  const pages = Math.max(1, lastPage);
  const spot = Math.min(Math.max(0, count), Math.max(0, pages - 2));
  const checked = Math.min(pages, 2 + spot);
  return {
    pages,
    checked,
    share: checked / pages,
    checksToCoverAll: spot ? Math.ceil((pages - 2) / spot) : 1,
  };
}

/** Content of a pledge as RSI shows it; data added by the extension (category, images) is left out. */
export function pledgeFingerprint(pledge: Pledge): string {
  return JSON.stringify([
    pledge.name,
    pledge.title,
    pledge.value,
    pledge.configurationValue,
    pledge.currency,
    pledge.availability,
    pledge.contains,
    pledge.isGiftable,
    pledge.isExchangeable,
    pledge.isUpgradeable,
    pledge.isUpgraded,
    pledge.isBuybackable,
    pledge.items.map((item) => [item.title, item.kind]),
    pledge.upgrade ? [pledge.upgrade.matchItems, pledge.upgrade.targetItems] : null,
    // Missing in pledges stored before it was read: the same as none, so only real locks count.
    pledge.protectedGames ?? [],
  ]);
}

export async function checkHangar(
  stored: Pledge[],
  options: CheckOptions<Pledge>,
): Promise<CheckResult<Pledge>> {
  return checkList(stored, {
    ...options,
    pageSize: HANGAR_PAGE_SIZE,
    fingerprint: pledgeFingerprint,
    followUpPages: (diff, pageOf) => ccuFollowUpPages(stored, diff, pageOf),
    merge: withExtensionData,
  });
}

/**
 * An applied CCU disappears from the hangar and changes the pledge with the upgraded ship –
 * which keeps its id and may be on any page. The pages of all pledges containing the CCU's
 * "from" ship are loaded to refresh them.
 */
function ccuFollowUpPages(
  stored: Pledge[],
  { fresh, removed }: ListDiff<Pledge>,
  pageOf: (id: number) => number,
): number[] {
  const fromShips = new Set(
    removed.flatMap((pledge) => pledge.upgrade?.matchItems.map((item) => shipKey(item.name)) ?? []),
  );
  if (fromShips.size === 0) return [];
  const removedIds = new Set(removed.map((pledge) => pledge.id));
  return stored
    .filter(
      (pledge) =>
        !fresh.has(pledge.id) &&
        !removedIds.has(pledge.id) &&
        pledge.items.some((item) => item.kind === 'Ship' && fromShips.has(shipKey(item.title))),
    )
    .map((pledge) => pageOf(pledge.id));
}

export async function checkList<T extends ListEntry>(
  stored: T[],
  options: ListCheckOptions<T>,
): Promise<CheckResult<T>> {
  const {
    fetchPage,
    cursor,
    spotCheckPages = SMART_UPDATE.spotCheckPages.default,
    maxRepairPages = SMART_UPDATE.maxRepairPages,
    pageSize,
    fingerprint,
    followUpPages,
    merge = (fresh) => fresh,
  } = options;

  const storedIds = stored.map((pledge) => pledge.id).sort((a, b) => b - a);
  const storedById = new Map(stored.map((pledge) => [pledge.id, pledge]));
  const pages = new Map<number, ListPage<T>>();
  let requests = 0;

  const load = async (list: number[]) => {
    const todo = [...new Set(list)].filter((page) => page >= 1 && !pages.has(page));
    const results = await Promise.all(todo.map((page) => fetchPage(page)));
    todo.forEach((page, index) => pages.set(page, results[index]!));
    requests += todo.length;
  };

  // First page, the stored last page and the spot check pages load together. The first page
  // tells the real last page; only if that changed, one more request is needed.
  const storedLastPage = Math.max(1, Math.ceil(storedIds.length / pageSize));
  const spot = pickSpotPages(cursor, storedLastPage, spotCheckPages);
  const done = (status: 'unchanged' | 'needsFullSync'): CheckResult<T> => ({
    status,
    requests,
    nextCursor: spot.nextCursor,
  });

  await load([1, storedLastPage, ...spot.pages]);
  const lastPage = pages.get(1)!.lastPage;
  await load([lastPage]);
  for (const page of [...pages.keys()]) if (page > lastPage) pages.delete(page);

  // Every page but the last one is full; anything else means the list changed while loading.
  for (const [page, { pledges }] of pages) {
    const expected = page < lastPage ? pageSize : pledges.length;
    if (pledges.length !== expected || (page === lastPage && page > 1 && expected === 0)) {
      return done('needsFullSync');
    }
  }

  const ids = (page: number) => pages.get(page)!.pledges.map((pledge) => pledge.id);
  const maxId = (page: number) => ids(page)[0]!;
  const minId = (page: number) => ids(page).at(-1)!;
  const loadedPages = () => [...pages.keys()].sort((a, b) => a - b);
  const countStoredBetween = (high: number, low: number) =>
    storedIds.filter((id) => id < high && id > low).length;

  /** Middle pages of the gaps whose stored pledge count doesn't fit the current one. */
  const mismatchedGaps = () => {
    const sorted = loadedPages();
    const targets: number[] = [];
    for (let index = 0; index + 1 < sorted.length; index++) {
      const [upper, lower] = [sorted[index]!, sorted[index + 1]!];
      const gapPages = lower - upper - 1;
      if (gapPages === 0) continue;
      if (countStoredBetween(minId(upper), maxId(lower)) !== gapPages * pageSize) {
        targets.push(Math.floor((upper + lower) / 2));
      }
    }
    return targets;
  };

  /** Whether the current state of this id is known: inside a loaded page or between adjacent ones. */
  const isVerified = (id: number) => {
    const sorted = loadedPages();
    if (sorted.length === 1 && lastPage === 1) return true;
    for (const page of sorted) {
      if (!pages.get(page)!.pledges.length) continue;
      const high = page === 1 ? Infinity : maxId(page);
      const low = page === lastPage ? -Infinity : minId(page);
      if (id <= high && id >= low) return true;
    }
    for (let index = 0; index + 1 < sorted.length; index++) {
      const [upper, lower] = [sorted[index]!, sorted[index + 1]!];
      if (lower === upper + 1 && id < minId(upper) && id > maxId(lower)) return true;
    }
    return false;
  };

  const diff = () => {
    const fresh = new Map<number, T>();
    for (const { pledges } of pages.values())
      for (const pledge of pledges) fresh.set(pledge.id, pledge);
    const removed = stored.filter((pledge) => !fresh.has(pledge.id) && isVerified(pledge.id));
    const added = [...fresh.values()].filter((pledge) => !storedById.has(pledge.id));
    const changed = [...fresh.values()].filter((pledge) => {
      const old = storedById.get(pledge.id);
      return old !== undefined && fingerprint(old) !== fingerprint(pledge);
    });
    return { fresh, removed, added, changed };
  };

  /** Page of an id in the current list, as far as the diff knows it. */
  const pageOfIn = ({ removed, added }: ListDiff<T>) => {
    const removedIds = new Set(removed.map((entry) => entry.id));
    const currentIds = [
      ...storedIds.filter((id) => !removedIds.has(id)),
      ...added.map((entry) => entry.id),
    ].sort((a, b) => b - a);
    const position = new Map(currentIds.map((id, index) => [id, index]));
    return (id: number) => Math.floor((position.get(id) ?? 0) / pageSize) + 1;
  };

  let extraPages = 0;
  let followedUp = false;
  for (;;) {
    let targets = mismatchedGaps();
    if (targets.length === 0 && !followedUp) {
      followedUp = true;
      const current = diff();
      targets = (followUpPages?.(current, pageOfIn(current)) ?? []).filter(
        (page) => !pages.has(page),
      );
    }
    if (targets.length === 0) break;
    const unique = [...new Set(targets)];
    if (extraPages + unique.length > maxRepairPages) return done('needsFullSync');
    await load(unique);
    extraPages += unique.length;
  }

  const { fresh, removed, added, changed } = diff();
  if (!removed.length && !added.length && !changed.length) return done('unchanged');

  const removedIds = new Set(removed.map((pledge) => pledge.id));
  const changedIds = new Set(changed.map((pledge) => pledge.id));
  const pledges = [
    ...stored
      .filter((pledge) => !removedIds.has(pledge.id))
      .map((pledge) => (changedIds.has(pledge.id) ? merge(fresh.get(pledge.id)!, pledge) : pledge)),
    ...added,
  ].sort((a, b) => b.id - a.id);

  return {
    status: 'updated',
    pledges,
    added,
    removed,
    changed: pledges.filter((pledge) => changedIds.has(pledge.id)),
    requests,
    nextCursor: spot.nextCursor,
  };
}

/** Keeps what the extension added to a pledge (RSI category, CCU target image) on its new version. */
function withExtensionData(fresh: Pledge, old: Pledge): Pledge {
  const pledge: Pledge = { ...fresh };
  if (old.category) pledge.category = old.category;
  if (fresh.upgrade && old.upgrade?.targetImage) {
    pledge.upgrade = { ...fresh.upgrade, targetImage: old.upgrade.targetImage };
  }
  return pledge;
}
