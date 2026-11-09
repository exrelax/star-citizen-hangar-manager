/*
 * The sidebar's notification of the Paint Discount Consultant (#151): how many own paints can be
 * bought again with more discount. Its X dismisses it for exactly these paints: their pledge ids
 * are kept in the sync storage, so it stays dismissed on every browser of the profile. It comes
 * back once a paint can be bought again that wasn't among them, with the count of all of them.
 *
 * Dismissing stores the paints of that moment only, so the list never grows beyond the paints the
 * consultant finds (the sync storage has a small quota per item); paints that can't be bought
 * again any more don't bring it back.
 */

/** The pledge ids of the paints the notification was dismissed for. */
export const dismissedPaintsItem = storage.defineItem<number[]>('sync:consultant.dismissedPaints', {
  fallback: [],
});

/**
 * The dismissed paints of the demo mode, apart from the real ones: the demo's pledges have the
 * real ids, and trying it out there shouldn't dismiss the real notification. This browser only.
 */
export const demoDismissedPaintsItem = storage.defineItem<number[]>('local:demo.dismissedPaints', {
  fallback: [],
});

/** Whether the notification shows: some paint to buy again wasn't dismissed. */
export function isPaintNotificationShown(
  paints: readonly number[],
  dismissed: readonly number[],
): boolean {
  const known = new Set(dismissed);
  return paints.some((id) => !known.has(id));
}

/** The ids to store when the notification is dismissed: the paints of now, each once, sorted. */
export const dismissedOf = (paints: readonly number[]): number[] =>
  [...new Set(paints)].sort((a, b) => a - b);

/** Shows the notification again for all paints, the dismissed ones too (the settings, #151). */
export async function restorePaintNotifications(): Promise<void> {
  await Promise.all([dismissedPaintsItem.removeValue(), demoDismissedPaintsItem.removeValue()]);
}
