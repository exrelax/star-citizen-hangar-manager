import { defineMeta } from '@/storage/meta';
import {
  BUYBACK_SNAPSHOT_VERSION,
  hasSeveralItems,
  type BuybackPledge,
  type BuybackSnapshot,
} from './buyback';
import type { BuybackDetails } from './sync-buyback';

/** The whole buy back in a single key, replaced atomically like the hangar snapshot. */
export const buybackSnapshot = storage.defineItem<BuybackSnapshot | null>('local:buyback.items', {
  fallback: null,
});

/** When the buy back was last read, changed and checked (see `storage/meta.ts`). */
export const buybackMeta = defineMeta('local:buyback.items');

/**
 * Keeps what the detail page of one pledge showed, read when its row is opened (see
 * `loadBuybackDetails`): its buy back price (#185; `null` when the page showed none) and – for a
 * pledge with several items – its items, which also ends a failed read (#334). The rest of the
 * snapshot stays as it is.
 */
export async function rememberBuybackDetails(id: number, details: BuybackDetails): Promise<void> {
  const snapshot = await buybackSnapshot.getValue();
  if (snapshot?.version !== BUYBACK_SNAPSHOT_VERSION) return;
  const index = snapshot.pledges.findIndex((pledge) => pledge.id === id);
  if (index < 0) return;
  const before = snapshot.pledges[index]!;
  const pledge: BuybackPledge = { ...before, price: details.price ?? null };
  if (hasSeveralItems(before)) pledge.items = details.items;
  delete pledge.detailsFailed;
  const unchanged =
    pledge.price === before.price &&
    !before.detailsFailed &&
    JSON.stringify(pledge.items) === JSON.stringify(before.items);
  if (unchanged) return;
  const pledges = [...snapshot.pledges];
  pledges[index] = pledge;
  await buybackSnapshot.setValue({ ...snapshot, pledges });
}
