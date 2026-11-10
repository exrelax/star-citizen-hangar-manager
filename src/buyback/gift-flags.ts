import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';

/*
 * RSI's gift flag of the pledges that left the hangar (#204): a bought back pledge keeps the
 * giftable status it had when it was melted, which the hangar shows but the buy back doesn't. So
 * when a pledge is no longer in the stored hangar – melted, or gifted away –, its flag is kept by
 * its id, which the buy back keeps too. Exact for pledges melted from now on; older ones are told
 * by their order (`probably-giftable.ts`).
 */

/** Giftable or not, by pledge id, as the hangar showed it before the pledge left. */
export type GiftFlags = Readonly<Record<string, boolean>>;

export const giftFlagsItem = storage.defineItem<GiftFlags>('local:buyback.giftFlags', {
  fallback: {},
});

const pledgesOf = (snapshot: HangarSnapshot | null | undefined) =>
  snapshot?.version === HANGAR_SNAPSHOT_VERSION ? snapshot.pledges : undefined;

/**
 * The gift flags of the pledges in `before` but not in `after`. Protected pledges count as not
 * giftable, as in My Hangar.
 */
export function leftGiftFlags(
  before: HangarSnapshot | null | undefined,
  after: HangarSnapshot | null | undefined,
): GiftFlags {
  const old = pledgesOf(before);
  const current = pledgesOf(after);
  // A missing or outdated snapshot tells nothing about what left.
  if (!old || !current) return {};
  const kept = new Set(current.map((pledge) => pledge.id));
  return Object.fromEntries(
    old
      .filter((pledge) => !kept.has(pledge.id))
      .map((pledge) => [pledge.id, pledge.isGiftable && !pledge.protectedGames?.length]),
  );
}

/** Keeps the flags of pledges leaving the stored hangar (call it in the background script). */
export function watchGiftFlags(): void {
  hangarSnapshot.watch(async (after, before) => {
    const left = leftGiftFlags(before, after);
    if (!Object.keys(left).length) return;
    await giftFlagsItem.setValue({ ...(await giftFlagsItem.getValue()), ...left });
  });
}
