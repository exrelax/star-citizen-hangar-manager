import { HANGAR_PAGE_SIZE } from '@/config';
import { recordUpdate } from '@/storage/meta';
import { hangarMeta, hangarSnapshot } from './hangar-storage';
import type { Pledge } from './pledge';
import { fetchPledgePage } from './sync';
import { pledgeFingerprint, withExtensionData, type ListPage } from './smart-update/check';

/*
 * The check right before bulk melting (#415): RSI melts the pledge with each id as it is now,
 * while the dialog shows it as it was stored. So every pledge to melt is read from "My Gear" again
 * first, and the run goes on only if each one is still there, unchanged and meltable.
 *
 * RSI lists pledges strictly by id, newest first, so the page of an id is found from the page it
 * was stored on: a page whose ids are all newer sends the search to a later page, all older to an
 * earlier one, and an id within a page's range is either on it or gone. Only these pages are read,
 * never the whole hangar.
 */

/** Why a pledge can't be melted as the dialog shows it. */
export type PledgeChange = 'gone' | 'notMeltable' | 'name' | 'value' | 'items' | 'other';

export interface PledgeMismatch {
  id: number;
  /** As stored, the way the dialog shows it. */
  stored: Pledge;
  /** As RSI lists it now; missing if it is gone. */
  fresh?: Pledge;
  changes: PledgeChange[];
}

export type VerifyResult =
  | { status: 'match'; requests: number }
  | { status: 'mismatch'; mismatches: PledgeMismatch[]; requests: number };

export interface VerifyOptions {
  fetchPage: (page: number) => Promise<ListPage<Pledge>>;
  /** The page each pledge was stored on, where the search starts. */
  pageOf: (id: number) => number;
  /** More pages than this: the hangar changed too much to tell, it throws. */
  maxPages?: number;
}

/** Meltable as the dialog decides it: RSI offers the exchange and no game access is protected. */
const isMeltable = (pledge: Pledge) => pledge.isExchangeable && !pledge.protectedGames?.length;

const itemsKey = (pledge: Pledge) =>
  JSON.stringify([
    pledge.items.map((item) => [item.title, item.kind]),
    pledge.upgrade ? [pledge.upgrade.matchItems, pledge.upgrade.targetItems] : null,
  ]);

/** What changed between the stored and the fresh version of a pledge; empty if nothing did. */
export function changesOf(stored: Pledge, fresh: Pledge | undefined): PledgeChange[] {
  if (!fresh) return ['gone'];
  const changes: PledgeChange[] = [];
  if (!isMeltable(fresh)) changes.push('notMeltable');
  if (fresh.name !== stored.name || fresh.title !== stored.title) changes.push('name');
  if (fresh.value !== stored.value) changes.push('value');
  if (itemsKey(fresh) !== itemsKey(stored)) changes.push('items');
  if (!changes.length && pledgeFingerprint(fresh) !== pledgeFingerprint(stored)) {
    changes.push('other');
  }
  return changes;
}

/**
 * Reads the given pledges from RSI again: each id's current version, or `undefined` for one that
 * is gone. Throws if a page can't be read or the search needs more than `maxPages` pages.
 */
export async function findPledges(
  ids: readonly number[],
  { fetchPage, pageOf, maxPages = 2 * ids.length + 10 }: VerifyOptions,
): Promise<{ found: Map<number, Pledge | undefined>; requests: number }> {
  const pages = new Map<number, ListPage<Pledge>>();
  let lastPage = Infinity;
  const load = async (page: number) => {
    let loaded = pages.get(page);
    if (!loaded) {
      if (pages.size >= maxPages)
        throw new Error(`More than ${maxPages} pages to find the pledges`);
      loaded = await fetchPage(page);
      pages.set(page, loaded);
      lastPage = Math.max(1, loaded.lastPage);
    }
    return loaded;
  };

  const found = new Map<number, Pledge | undefined>();
  for (const id of ids) {
    let low = 1;
    let high = lastPage;
    let page = Math.max(1, pageOf(id));
    let step = 1;
    let direction = 0;
    for (;;) {
      page = Math.min(Math.max(page, low), high);
      if (low > high) {
        // Between two pages: no page holds it any more.
        found.set(id, undefined);
        break;
      }
      const { pledges } = await load(page);
      high = Math.min(high, lastPage);
      if (page > high) continue;
      const newest = pledges[0]?.id;
      const oldest = pledges.at(-1)?.id;
      let next: number;
      if (newest === undefined || oldest === undefined) {
        // An empty page: the list ends before it.
        high = page - 1;
        next = -1;
      } else if (id > newest && page > 1) {
        high = page - 1;
        next = -1;
      } else if (id < oldest && page < lastPage) {
        low = page + 1;
        next = 1;
      } else {
        found.set(
          id,
          pledges.find((pledge) => pledge.id === id),
        );
        break;
      }
      // Pledges usually move by a page or two: steps that double, then within what is left.
      step = next === direction ? step * 2 : 1;
      direction = next;
      page += next * step;
    }
  }
  return { found, requests: pages.size };
}

/** Compares the stored pledges with what RSI lists now. */
export async function verifyPledges(
  stored: readonly Pledge[],
  options: VerifyOptions,
): Promise<VerifyResult> {
  const { found, requests } = await findPledges(
    stored.map((pledge) => pledge.id),
    options,
  );
  const mismatches = stored
    .map((pledge) => {
      const fresh = found.get(pledge.id);
      return {
        id: pledge.id,
        stored: pledge,
        ...(fresh && { fresh }),
        changes: changesOf(pledge, fresh),
      };
    })
    .filter((mismatch) => mismatch.changes.length);
  return mismatches.length
    ? { status: 'mismatch', mismatches, requests }
    : { status: 'match', requests };
}

/** The stored pledges of these ids, in their order; throws if one isn't stored. */
export async function storedPledges(ids: readonly number[]): Promise<Pledge[]> {
  const byId = new Map(
    (await hangarSnapshot.getValue())?.pledges.map((pledge) => [pledge.id, pledge]),
  );
  return ids.map((id) => {
    const pledge = byId.get(id);
    if (!pledge) throw new Error(`Pledge #${id} is not in the stored hangar`);
    return pledge;
  });
}

/** Puts what the check read into the stored hangar: the changed pledges, without the gone ones. */
export async function storeMismatches(mismatches: readonly PledgeMismatch[]): Promise<void> {
  if (!mismatches.length) return;
  const snapshot = await hangarSnapshot.getValue();
  if (!snapshot) return;
  const byId = new Map(mismatches.map((mismatch) => [mismatch.id, mismatch]));
  await hangarSnapshot.setValue({
    ...snapshot,
    pledges: snapshot.pledges.flatMap((pledge) => {
      const mismatch = byId.get(pledge.id);
      if (!mismatch) return [pledge];
      return mismatch.fresh ? [withExtensionData(mismatch.fresh, pledge)] : [];
    }),
    updatedAt: new Date().toISOString(),
  });
  await recordUpdate(hangarMeta);
}

/** The stored page of a pledge, by its position among the stored ones (newest first). */
export function storedPageOf(all: readonly { id: number }[]): (id: number) => number {
  const ids = all.map((pledge) => pledge.id).sort((a, b) => b - a);
  return (id) => Math.floor(ids.filter((other) => other > id).length / HANGAR_PAGE_SIZE) + 1;
}

/**
 * The check of the bulk melting dialog: reads the pledges from RSI again and compares them with
 * their stored versions as the dialog showed them (`storedPledges` when it opened). The dialog
 * stores what differs once it closes (`storeMismatches`). Throws if they can't be read.
 */
export async function checkBeforeExchange(shown: readonly Pledge[]): Promise<VerifyResult> {
  const all = (await hangarSnapshot.getValue())?.pledges ?? shown;
  return verifyPledges(shown, {
    fetchPage: (page) => fetchPledgePage(page),
    pageOf: storedPageOf(all),
  });
}
