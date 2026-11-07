import { BUYBACK_PAGE_SIZE, SMART_UPDATE } from '@/config';
import { PLEDGE_CATEGORIES } from '@/hangar/pledge';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { recordCheck, type CheckOutcome } from '@/storage/meta';
import { checkList } from '@/hangar/smart-update/check';
import {
  BUYBACK_SNAPSHOT_VERSION,
  buybackFingerprint,
  withBuybackExtensionData,
  type BuybackSnapshot,
} from './buyback';
import { buybackMeta, buybackSnapshot } from './buyback-storage';
import { enrichBuyback, fetchBuybackPage, type BuybackSyncDeps } from './sync-buyback';

/**
 * Smart update of the buy back, the same way as the hangar's (see check.ts). Melted pledges keep
 * their old id, so they appear anywhere in the list – the binary search finds them.
 */
export async function runBuybackSmartUpdate(
  deps: BuybackSyncDeps & { now?: () => number } = {},
): Promise<CheckOutcome | null> {
  const { fetchPage = fetchBuybackPage, now = Date.now } = deps;

  const snapshot = await buybackSnapshot.getValue();
  if (snapshot?.version !== BUYBACK_SNAPSHOT_VERSION) return null;
  const meta = await buybackMeta.getValue();

  // The first page is always checked; it shows the current buy back tokens, too.
  let tokens = snapshot.tokens;
  const result = await checkList(snapshot.pledges, {
    fetchPage: async (page) => {
      const listPage = await fetchPage(page);
      if (page === 1 && listPage.tokens !== undefined) tokens = listPage.tokens;
      return listPage;
    },
    cursor: meta.cursor ?? 0,
    pageSize: BUYBACK_PAGE_SIZE,
    spotCheckPages: SMART_UPDATE.buybackSpotCheckPages,
    fingerprint: buybackFingerprint,
    merge: withBuybackExtensionData,
  });

  const save = (outcome: Omit<CheckOutcome, 'at'>) =>
    recordCheck(buybackMeta, outcome, { at: now(), cursor: result.nextCursor });
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
  return save({
    status: 'updated',
    added: added.length,
    removed: removed.length,
    changed: changed.length,
  });
}

/** Whether the stored buy back is still `snapshot`: no sync or other update stored meanwhile. */
async function unchangedSince(snapshot: BuybackSnapshot): Promise<boolean> {
  const current = await buybackSnapshot.getValue();
  return current?.syncedAt === snapshot.syncedAt && current?.updatedAt === snapshot.updatedAt;
}
