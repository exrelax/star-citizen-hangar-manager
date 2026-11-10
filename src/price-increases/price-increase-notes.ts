import type { BuybackPledge, BuybackSnapshot } from '@/buyback/buyback';
import { BUYBACK_SNAPSHOT_VERSION } from '@/buyback/buyback';
import { createPriceIncreaseMatcher, type PriceIncreaseMatch } from './price-increase-match';
import { isWithinDays, type ExpectedPriceIncrease } from './price-increases';

/*
 * The notifications about buy back pledges whose price is expected to rise (#193):
 * - In the sidebar: one notification for all pledges with an expected price increase within the
 *   period of the settings (`priceIncreaseDays`, like the buy back filter). Its X dismisses it for
 *   exactly these pledges – kept in the sync storage, like the Paint Discount Consultant's (#151) –
 *   and it comes back once another pledge enters the period, with the count of all of them.
 * - In the browser once less than two days are left (`price-increase-browser-notification.ts`).
 * Pledges whose price increase is over don't count any more.
 */

/** The ids of the buy back pledges the sidebar's notification was dismissed for. */
export const dismissedPriceIncreasesItem = storage.defineItem<number[]>(
  'sync:priceIncreases.dismissed',
  { fallback: [] },
);

/** The dismissed pledges of the demo mode, apart from the real ones (see the paints' ones). */
export const demoDismissedPriceIncreasesItem = storage.defineItem<number[]>(
  'local:demo.dismissedPriceIncreases',
  { fallback: [] },
);

/** The ids of the pledges with an expected price increase within `days`, each once, sorted. */
export function pledgesWithinDays(
  pledges: readonly { id: number; priceIncrease?: PriceIncreaseMatch }[],
  now: number,
  days: number,
): number[] {
  const ids = pledges
    .filter((pledge) => isWithinDays(pledge.priceIncrease?.increase, now, days))
    .map((pledge) => pledge.id);
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** Whether the notification shows: some pledge in the period wasn't dismissed. */
export function isPriceIncreaseNoteShown(
  ids: readonly number[],
  dismissed: readonly number[],
): boolean {
  const known = new Set(dismissed);
  return ids.some((id) => !known.has(id));
}

/** Shows the notification again for all pledges, the dismissed ones too (the settings, #213). */
export async function restorePriceIncreaseNotes(): Promise<void> {
  await Promise.all([
    dismissedPriceIncreasesItem.removeValue(),
    demoDismissedPriceIncreasesItem.removeValue(),
  ]);
}

/** A pledge of the stored buy back with its expected price increase. */
export interface StoredPriceIncreasePledge {
  id: number;
  title: string;
  priceIncrease: PriceIncreaseMatch;
}

/**
 * The pledges of the stored buy back with an expected price increase still ahead – for the
 * background and the settings, which have no list of their own.
 */
export function storedPriceIncreasePledges(
  buyback: BuybackSnapshot | null | undefined,
  increases: readonly ExpectedPriceIncrease[],
  now: number,
): StoredPriceIncreasePledge[] {
  if (buyback?.version !== BUYBACK_SNAPSHOT_VERSION || !increases.length) return [];
  const matcher = createPriceIncreaseMatcher(increases, now);
  return buyback.pledges.flatMap((pledge: BuybackPledge) => {
    const priceIncrease = matcher.buyback(pledge);
    return priceIncrease ? [{ id: pledge.id, title: pledge.title, priceIncrease }] : [];
  });
}
