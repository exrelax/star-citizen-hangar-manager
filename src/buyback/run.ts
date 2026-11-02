import { BUYBACK_PAGE_SIZE, SMART_UPDATE } from '@/config';
import { PLEDGE_CATEGORIES } from '@/hangar/pledge';
import { hangarSnapshot, type CheckOutcome } from '@/hangar/hangar-storage';
import { checkList } from '@/hangar/smart-update/check';
import { BUYBACK_SNAPSHOT_VERSION, buybackFingerprint, withBuybackExtensionData } from './buyback';
import { buybackCheckState, buybackSnapshot } from './buyback-storage';
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
  const checkState = await buybackCheckState.getValue();

  const result = await checkList(snapshot.pledges, {
    fetchPage: (page) => fetchPage(page),
    cursor: checkState.cursor,
    pageSize: BUYBACK_PAGE_SIZE,
    spotCheckPages: SMART_UPDATE.buybackSpotCheckPages,
    fingerprint: buybackFingerprint,
    merge: withBuybackExtensionData,
  });

  const save = async (outcome: Omit<CheckOutcome, 'at'>) => {
    const at = now();
    const lastOutcome = { ...outcome, at };
    await buybackCheckState.setValue({ lastCheckAt: at, cursor: result.nextCursor, lastOutcome });
    return lastOutcome;
  };
  if (result.status !== 'updated') {
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

  const current = await buybackSnapshot.getValue();
  if (current?.syncedAt !== snapshot.syncedAt || current?.updatedAt !== snapshot.updatedAt) {
    return null;
  }
  await buybackSnapshot.setValue({
    ...snapshot,
    pledges,
    shipLinks,
    updatedAt: new Date(now()).toISOString(),
  });
  return save({
    status: 'updated',
    added: added.length,
    removed: removed.length,
    changed: changed.length,
  });
}
