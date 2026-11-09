import { BUYBACK_PAGE_SIZE, SMART_UPDATE } from '@/config';
import { PLEDGE_CATEGORIES } from '@/hangar/pledge';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { recordCheck, type CheckOutcome } from '@/storage/meta';
import {
  checkList,
  checkPages,
  pickSpotPages,
  type CheckResult,
  type ListUpdate,
} from '@/hangar/smart-update/check';
import {
  BUYBACK_SNAPSHOT_VERSION,
  buybackFingerprint,
  withBuybackExtensionData,
  type BuybackPledge,
  type BuybackSnapshot,
} from './buyback';
import { buybackMeta, buybackSnapshot } from './buyback-storage';
import { enrichBuyback, fetchBuybackPage, type BuybackSyncDeps } from './sync-buyback';

/**
 * Smart update of the buy back, the same way as the hangar's (see check.ts). Melted pledges keep
 * their old id, so they appear anywhere in the list – the binary search finds them.
 *
 * Its pages are large (250 pledges, ~1 MB), so the number of pledges is compared with small pages
 * (#126, `SMART_UPDATE.buybackCount`): first and last page, the pages of the pledge log's pledges
 * and the binary search. Only the rotating spot check loads a full page, for changes within a
 * pledge that keep the number.
 */
export async function runBuybackSmartUpdate(
  deps: BuybackSyncDeps & {
    now?: () => number;
    /** Ids known to have changed, e.g. from the pledge log (see `CheckOptions.hintIds`). */
    hintIds?: readonly number[];
    /** Hears about the stored changes, e.g. to check the melted pledges in the hangar. */
    onChanges?: (changes: { added: BuybackPledge[]; removed: BuybackPledge[] }) => void;
  } = {},
): Promise<CheckOutcome | null> {
  const { fetchPage = fetchBuybackPage, now = Date.now, hintIds, onChanges } = deps;

  const snapshot = await buybackSnapshot.getValue();
  if (snapshot?.version !== BUYBACK_SNAPSHOT_VERSION) return null;
  const meta = await buybackMeta.getValue();

  // The first page is always checked; it shows the current buy back tokens, too.
  let tokens = snapshot.tokens;
  const { pageSize, maxRepairPages } = SMART_UPDATE.buybackCount;
  const counted = await checkList(snapshot.pledges, {
    fetchPage: async (page) => {
      const listPage = await fetchPage(page, undefined, pageSize);
      if (page === 1 && listPage.tokens !== undefined) tokens = listPage.tokens;
      return listPage;
    },
    cursor: 0,
    pageSize,
    spotCheckPages: 0,
    maxRepairPages,
    fingerprint: buybackFingerprint,
    merge: withBuybackExtensionData,
    hintIds,
  });

  // The spot check: full pages, rotating over the list as it is after the comparison.
  const current = counted.status === 'updated' ? counted.pledges : snapshot.pledges;
  const spot = pickSpotPages(
    meta.cursor ?? 0,
    Math.max(1, Math.ceil(current.length / BUYBACK_PAGE_SIZE)),
    counted.status === 'needsFullSync' ? 0 : SMART_UPDATE.buybackSpotCheckPages,
  );
  const spotted = await checkPages(current, {
    fetchPage: (page) => fetchPage(page, undefined, BUYBACK_PAGE_SIZE),
    pages: spot.pages,
    pageSize: BUYBACK_PAGE_SIZE,
    fingerprint: buybackFingerprint,
    merge: withBuybackExtensionData,
  });
  const result = combined(counted, spotted, spot.nextCursor);

  const save = (outcome: Omit<CheckOutcome, 'at'>) =>
    recordCheck(
      buybackMeta,
      { ...outcome, pages: result.requests },
      { at: now(), cursor: result.nextCursor },
    );
  if (result.status !== 'updated') {
    // No changes to the pledges, but the tokens may have changed (e.g. by a buy back elsewhere).
    if (tokens !== snapshot.tokens && (await unchangedSince(snapshot))) {
      await buybackSnapshot.setValue({ ...snapshot, tokens });
    }
    return save({ status: result.status, added: 0, removed: 0, changed: 0 });
  }

  const { pledges, added, removed, changed } = result;
  if (added.length) {
    // A freshly melted pledge was in the hangar until now, which knows its category.
    const hangar = new Map((await hangarSnapshot.getValue())?.pledges.map((p) => [p.id, p]));
    const unknown = new Map<number, (typeof added)[number]>();
    for (const pledge of added) {
      const category = hangar.get(pledge.id)?.category;
      if (category) pledge.category = category;
      else if (!hangar.has(pledge.id)) unknown.set(pledge.id, pledge);
    }
    // Others: the first page of RSI's category lists covers recent pledges.
    if (unknown.size) {
      for (const category of PLEDGE_CATEGORIES) {
        for (const { id } of (await fetchPage(1, category)).pledges) {
          const pledge = unknown.get(id);
          if (pledge) pledge.category = category;
        }
      }
    }
  }
  const shipLinks = await enrichBuyback(pledges, snapshot, deps);

  if (!(await unchangedSince(snapshot))) return null;
  await buybackSnapshot.setValue({
    ...snapshot,
    pledges,
    shipLinks,
    ...(tokens !== undefined && { tokens }),
    updatedAt: new Date(now()).toISOString(),
  });
  onChanges?.({ added, removed });
  return save({
    status: 'updated',
    added: added.length,
    removed: removed.length,
    changed: changed.length,
  });
}

/** The result of the comparison with small pages and the spot check together. */
function combined(
  counted: CheckResult<BuybackPledge>,
  spotted: Awaited<ReturnType<typeof checkPages<BuybackPledge>>>,
  nextCursor: number,
): CheckResult<BuybackPledge> {
  const base = { requests: counted.requests + spotted.requests, nextCursor };
  if (counted.status === 'needsFullSync') return { ...base, status: 'needsFullSync' };
  if (counted.status !== 'updated' && spotted.status !== 'updated') {
    return { ...base, status: 'unchanged' };
  }
  const parts = [counted, spotted].filter(
    (part): part is typeof part & ListUpdate<BuybackPledge> => part.status === 'updated',
  );
  // The spot check ran on the list after the comparison: its list is the newest.
  const pledges = parts.at(-1)!.pledges;
  const changedIds = new Set(parts.flatMap((part) => part.changed.map((pledge) => pledge.id)));
  return {
    ...base,
    status: 'updated',
    pledges,
    added: parts.flatMap((part) => part.added),
    removed: parts.flatMap((part) => part.removed),
    changed: pledges.filter((pledge) => changedIds.has(pledge.id)),
  };
}

/** Whether the stored buy back is still `snapshot`: no sync or other update stored meanwhile. */
async function unchangedSince(snapshot: BuybackSnapshot): Promise<boolean> {
  const current = await buybackSnapshot.getValue();
  return current?.syncedAt === snapshot.syncedAt && current?.updatedAt === snapshot.updatedAt;
}
