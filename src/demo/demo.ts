import type { StoreCredit } from '@/account/store-credit';
import type { BuybackView } from '@/buyback/buyback-view';
import { BUYBACK_PAGE_SIZE, DEMO, HANGAR_PAGE_SIZE, REFUND_DAYS } from '@/config';
import { localToday } from '@/orders/refund';
import type { PledgeView } from '@/hangar/pledge-view';
import { normalizeSearchText } from '@/hangar/search';
import type { UpgradeLogEntry } from '@/hangar/upgrade-log';

/*
 * The demo view shows a fixed selection of the stored pledges with made-up pledge ids and
 * purchase dates, so screenshots (e.g. for a store listing) don't reveal the real hangar, its ids
 * or when it was bought. Selection, ids and dates are derived from a random key stored only in
 * this browser: they stay the same for every visit, and without the key they can't be traced back
 * to the real ones.
 */

/** cyrb53: a fast 53-bit string hash with a good spread. */
export function hash(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Made-up ids like "99FE3X712" for pledge ids and order ids: nine digits and capital letters,
 * never all digits – so they can't be mistaken for (or looked up as) RSI's ids.
 */
export function createFakeIds(key: string): (id: number | string) => string {
  const cache = new Map<number | string, string>();
  return (id) => {
    let fake = cache.get(id);
    if (!fake) {
      const value = hash(`${key}:id:${id}`);
      fake = value.toString(36).toUpperCase().padStart(9, '0').slice(-9);
      if (!/[A-Z]/.test(fake))
        fake = fake.slice(0, 4) + LETTERS[value % LETTERS.length] + fake.slice(5);
      cache.set(id, fake);
    }
    return fake;
  };
}

/**
 * `count` entries in a random but fixed order (by `key`), plus all `required` ones; the result
 * keeps the order of `entries` (RSI's order).
 */
export function pickDemo<T extends { id: number }>(
  entries: readonly T[],
  count: number,
  key: string,
  required: (entry: T) => boolean = () => false,
): T[] {
  const picked = new Set(entries.filter(required));
  const shuffled = [...entries].sort(
    (a, b) => hash(`${key}:pick:${a.id}`) - hash(`${key}:pick:${b.id}`),
  );
  for (const entry of shuffled) {
    if (picked.size >= count) break;
    picked.add(entry);
  }
  return entries.filter((entry) => picked.has(entry));
}

const containsShip = (pledge: PledgeView, names: readonly string[]) =>
  pledge.items.some((item) => item.kind === 'Ship' && names.includes(item.title));

/**
 * The demo selection of the hangar, with made-up ids (also for the search), purchase dates and
 * demo pages (see `demoDates`).
 */
export function demoHangar(
  pledges: readonly PledgeView[],
  key: string,
  today = localToday(),
): PledgeView[] {
  const fakeId = createFakeIds(key);
  // Some upgraded pledges for their "Applied upgrades", in the same fixed random order.
  const upgraded = new Set(
    pickDemo(
      pledges.filter((pledge) => pledge.isUpgraded),
      DEMO.upgradedPledges,
      key,
    ),
  );
  const selection = pickDemo(
    pledges,
    DEMO.hangarPledges,
    key,
    // The protected game access pledges (at most two) show the lock tag.
    (pledge) =>
      upgraded.has(pledge) ||
      containsShip(pledge, DEMO.includeShips) ||
      pledge.protectedGames.length > 0,
  );
  const dates = demoDates(selection, key, today);
  return selection.map((pledge, position) => {
    const demo = anonymized(pledge, fakeId);
    const createdAt = dates[position]!;
    return {
      ...demo,
      createdAt,
      // The order of a pledge was placed when the pledge was bought.
      order: demo.order && { ...demo.order, placedAt: createdAt },
      page: Math.floor(position / HANGAR_PAGE_SIZE) + 1,
    };
  });
}

/**
 * Made-up purchase dates for the demo selection, newest first like RSI's list (which is sorted by
 * pledge id, so by purchase): random between `DEMO.earliestDate` and `today`, nothing of the real
 * dates. The first pledges with a money-paid order are dated for the refund tags (see
 * `DEMO.refundDaysLeft`); all other money-paid pledges are older than the refund period, so they
 * show no tag.
 */
export function demoDates(
  pledges: readonly { id: number; order?: object }[],
  key: string,
  today: string,
): string[] {
  // Fixed dates, newest first: the refund pledges, then the end of the refund period.
  const anchors = new Map<number, string>();
  pledges
    .filter((pledge) => pledge.order)
    .slice(0, DEMO.refundDaysLeft.length)
    .forEach((pledge, index) =>
      anchors.set(pledge.id, addDays(today, DEMO.refundDaysLeft[index]! - REFUND_DAYS)),
    );
  const refundEnd = addDays(today, -REFUND_DAYS - 1);
  const dates: string[] = [];
  let newest = today;
  let segment: { id: number }[] = [];
  /** Dates for the pledges between two fixed ones, random and newest first. */
  const fill = (oldest: string) => {
    dates.push(...randomDates(segment, key, oldest, newest));
    segment = [];
  };
  for (const pledge of pledges) {
    const anchor = anchors.get(pledge.id);
    if (anchor === undefined) {
      segment.push(pledge);
      continue;
    }
    fill(anchor);
    dates.push(anchor);
    newest = anchor;
  }
  // After the last refund pledge, the rest is older than the refund period.
  if (newest > refundEnd) newest = refundEnd;
  fill(DEMO.earliestDate);
  return dates;
}

/** Random dates between `oldest` and `newest` (both included) for `pledges`, newest first. */
function randomDates(
  pledges: readonly { id: number }[],
  key: string,
  oldest: string,
  newest: string,
): string[] {
  const days = Math.max(0, daysBetween(oldest, newest));
  return pledges
    .map((pledge) => Math.round(fraction(`${key}:date:${pledge.id}`) * days))
    .sort((a, b) => b - a)
    .map((offset) => addDays(oldest, offset));
}

/**
 * The applied CCUs of a demo pledge with made-up dates: after its demo purchase date (`createdAt`)
 * and before `now`, in the order RSI applied them (oldest first), each at a random time.
 */
export function demoUpgradeLog(
  entries: readonly UpgradeLogEntry[],
  pledgeId: number,
  createdAt: string | undefined,
  key: string,
  now = Date.now(),
): UpgradeLogEntry[] {
  const from = Date.parse(`${createdAt ?? DEMO.earliestDate}T00:00:00Z`);
  // Times as RSI shows them, without a time zone: read and written as UTC, "now" as local time.
  const until = now - new Date(now).getTimezoneOffset() * 60_000;
  const minutes = Math.max(0, Math.floor((until - from) / 60_000));
  const times = entries
    .map((_, index) => Math.floor(fraction(`${key}:upgrade:${pledgeId}:${index}`) * minutes))
    .sort((a, b) => a - b);
  return entries.map((entry, index) => ({
    ...entry,
    appliedAt: new Date(from + times[index]! * 60_000).toISOString().slice(0, 16).replace('T', ' '),
  }));
}

/**
 * The store credit of the demo instead of the account's: random between 0 and
 * `DEMO.storeCreditMax` US dollars, fixed by `key` like the rest of the demo.
 */
export function demoStoreCredit(key: string): StoreCredit {
  const cents = Math.floor(fraction(`store-credit:${key}`) * (DEMO.storeCreditMax * 100 + 1));
  return { amount: cents / 100, currency: 'USD' };
}

/** A number in [0, 1), fixed for `text`. */
function fraction(text: string): number {
  return hash(text) / 2 ** 53;
}

/** The ISO date `days` days after `date` (before it for negative days). */
function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(time).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The demo selection of the buy back, with made-up ids (also for the search). */
export function demoBuyback(pledges: readonly BuybackView[], key: string): BuybackView[] {
  const fakeId = createFakeIds(key);
  return pickDemo(pledges, DEMO.buybackPledges, key).map((pledge, position) => ({
    ...anonymized(pledge, fakeId),
    position,
    page: Math.floor(position / BUYBACK_PAGE_SIZE) + 1,
  }));
}

/** A pledge with made-up pledge and order ids, searchable by them instead of the real ones. */
function anonymized<T extends PledgeView | BuybackView>(
  pledge: T,
  fakeId: (id: number | string) => string,
): T {
  const displayId = fakeId(pledge.id);
  const order = pledge.order && { ...pledge.order, id: fakeId(pledge.order.id) };
  const names = [pledge.title, ...pledge.ships.map((ship) => ship.name)];
  return {
    ...pledge,
    displayId,
    order,
    searchText: normalizeSearchText([...names, displayId, order?.id ?? ''].join(' ')),
  };
}
