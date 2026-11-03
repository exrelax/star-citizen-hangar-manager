import type { BuybackView } from '@/buyback/buyback-view';
import { BUYBACK_PAGE_SIZE, DEMO, HANGAR_PAGE_SIZE, REFUND_DAYS } from '@/config';
import { localToday } from '@/orders/refund';
import type { PledgeView } from '@/hangar/pledge-view';
import { normalizeSearchText } from '@/hangar/search';

/*
 * The demo view shows a fixed selection of the stored pledges with made-up pledge ids, so
 * screenshots (e.g. for a store listing) don't reveal the real hangar or its ids. Selection and
 * ids are derived from a random key stored only in this browser: they stay the same for every
 * visit, and without the key the made-up ids can't be traced back to the real ones.
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
 * The demo selection of the hangar, with made-up ids (also for the search) and demo pages; two
 * pledges get purchase dates relative to `today` for the refund tags (see `DEMO.refundDaysLeft`).
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
    (pledge) => upgraded.has(pledge) || containsShip(pledge, DEMO.includeShips),
  );
  const demo = selection.map((pledge, position) => ({
    ...anonymized(pledge, fakeId),
    page: Math.floor(position / HANGAR_PAGE_SIZE) + 1,
  }));

  // The first pledges with a money-paid order get recent purchase dates for the refund tags.
  const withOrder = demo.filter((pledge) => pledge.order);
  DEMO.refundDaysLeft.forEach((daysLeft, index) => {
    const pledge = withOrder[index];
    if (pledge?.order) {
      const placedAt = addDays(today, daysLeft - REFUND_DAYS);
      // The pledge's own date shown in the row follows, so both dates match.
      pledge.order = { ...pledge.order, placedAt };
      pledge.createdAt = placedAt;
    }
  });
  return demo;
}

/** The ISO date `days` days after `date` (before it for negative days). */
function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(time).toISOString().slice(0, 10);
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
