import { defineMeta } from '@/storage/meta';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackSnapshot } from './buyback';

/** The whole buy back in a single key, replaced atomically like the hangar snapshot. */
export const buybackSnapshot = storage.defineItem<BuybackSnapshot | null>('local:buyback.items', {
  fallback: null,
});

/** When the buy back was last read, changed and checked (see `storage/meta.ts`). */
export const buybackMeta = defineMeta('local:buyback.items');

/**
 * Keeps the buy back price read for one pledge (#185: read when its row is opened, see
 * `loadBuybackPrice`); `null` when its page showed none. The rest of the snapshot stays as it is.
 */
export async function rememberBuybackPrice(id: number, price: number | null): Promise<void> {
  const snapshot = await buybackSnapshot.getValue();
  if (snapshot?.version !== BUYBACK_SNAPSHOT_VERSION) return;
  const index = snapshot.pledges.findIndex((pledge) => pledge.id === id);
  if (index < 0 || snapshot.pledges[index]!.price === price) return;
  const pledges = [...snapshot.pledges];
  pledges[index] = { ...pledges[index]!, price };
  await buybackSnapshot.setValue({ ...snapshot, pledges });
}
