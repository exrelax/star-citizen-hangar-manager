import { groupItems, pledgeFacts } from '@/hangar/grouping';
import type { PledgeView } from '@/hangar/pledge-view';

/*
 * The melt marks of groups in the demo (#554, for #552): in groups of the grouped view, pledges
 * marked to melt at different times, so each label shows –
 *
 * - "Melt in 3 hr – 21 hr": two items bought 21 and 3 hours ago, both marked;
 * - "Melt now – 21 hr": one item bought long ago and one 3 hours ago, both marked;
 * - "Melt now": all items of a group bought long ago, all marked;
 * - one marked item of several: the count badge "1".
 *
 * Each case takes a group of meltable items of its own, the largest first; with fewer groups the
 * later cases are left out. The items bought recently get that date and time as their purchase, as
 * the demo's pledge bought a few hours ago does (`demoPurchaseTime`).
 */

const HOUR = 60 * 60 * 1000;

/** A time as the pledge log writes it ("2026-11-22T09:00"), in local time, on the full hour. */
export function purchaseTimeOf(ms: number): string {
  const time = new Date(ms);
  time.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}` +
    `T${pad(time.getHours())}:00`
  );
}

export interface DemoGroupMarks {
  /** The pledges to mark. */
  marked: number[];
  /** The purchase times of the pledges bought recently, by id. */
  purchases: Map<number, string>;
}

/**
 * The cases in the demo hangar's groups; `avoid` are pledges the demo uses otherwise (the one
 * bought a few hours ago, its own marks).
 */
export function demoGroupMarks(
  pledges: readonly PledgeView[],
  now: number,
  avoid: ReadonlySet<number> = new Set(),
): DemoGroupMarks {
  const groups = groupItems(pledges, pledgeFacts)
    .map((group) => group.items.filter((item) => item.isMeltable && !avoid.has(item.id)))
    .filter((items) => items.length >= 2)
    .sort((a, b) => b.length - a.length);
  const marked: number[] = [];
  const purchases = new Map<number, string>();
  const bought = (item: PledgeView, hoursAgo: number) =>
    purchases.set(item.id, purchaseTimeOf(now - hoursAgo * HOUR));
  const [range, mixed, ready, one] = groups;
  if (range) {
    bought(range[0]!, 21);
    bought(range[1]!, 3);
    marked.push(range[0]!.id, range[1]!.id);
  }
  if (mixed) {
    bought(mixed[1]!, 3);
    marked.push(mixed[0]!.id, mixed[1]!.id);
  }
  if (ready) marked.push(...ready.map((item) => item.id));
  if (one) marked.push(one[0]!.id);
  return { marked, purchases };
}

/** The demo hangar with the purchase dates of the pledges bought recently. */
export const withRecentPurchases = (
  pledges: readonly PledgeView[],
  purchases: ReadonlyMap<number, string>,
): PledgeView[] =>
  purchases.size
    ? pledges.map((pledge) => {
        const at = purchases.get(pledge.id);
        return at ? { ...pledge, createdAt: at.slice(0, 10) } : pledge;
      })
    : [...pledges];
