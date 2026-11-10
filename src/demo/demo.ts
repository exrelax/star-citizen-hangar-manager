import type { StoreCredit } from '@/account/store-credit';
import type { BuybackView } from '@/buyback/buyback-view';
import { BUYBACK_PAGE_SIZE, DEMO, HANGAR_PAGE_SIZE, REFUND_DAYS } from '@/config';
import { localToday } from '@/orders/refund';
import type { PledgeView } from '@/hangar/pledge-view';
import { normalizeSearchText } from '@/hangar/search';
import type { UpgradeLogEntry } from '@/hangar/upgrade-log';
import { toPledgeView } from '@/hangar/pledge-view';
import { createPriceLookup } from '@/hangar/ship-prices';
import { createItemPriceLookup } from '@/store/items/item-prices';
import type { DemoCatalog } from './catalog';
import { generateDemoAccount, type DemoAccount } from './generate-states';
import { generateBuyback, type DemoBuyback } from './generate-buyback';
import { toBuybackView } from '@/buyback/buyback-view';
import { createAvailabilityCheck } from '@/buyback/buyback-availability';
import { createBuybackImager } from '@/buyback/buyback-image';
import { createBuybackPricer } from '@/buyback/buyback-price';
import { createGiftableCheck } from '@/buyback/probably-giftable';
import type { OrdersSnapshot } from '@/orders/orders';
import { withOrder } from '@/orders/orders';
import { createPriceIncreaseMatcher } from '@/price-increases/price-increase-match';
import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import { demoPriceIncreases } from './demo-price-increases';
import { fraction, hash } from './random';

/*
 * The demo view, e.g. for screenshots, reveals nothing of the real account: by default a hangar
 * generated from the public catalog (#175, `generate-hangar.ts`), or a fixed selection of the
 * stored pledges. Either way with made-up pledge ids and purchase dates. Everything is derived
 * from a random key stored only in this browser: it stays the same for every visit, and without
 * the key nothing can be traced back to the real account.
 */

export { hash } from './random';

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
  now = Date.now(),
): PledgeView[] {
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
  return demoViews(selection, key, today, now);
}

/**
 * The generated demo hangar (#175) as the list shows it: the pledges of `generateDemoAccount`
 * with their states and orders (#176), their discounts against the catalog's prices, made-up
 * display ids and purchase dates – and the account they belong to.
 */
export function generatedDemo(
  catalog: DemoCatalog,
  key: string,
  today = localToday(),
  now = Date.now(),
): {
  pledges: PledgeView[];
  buyback: BuybackView[];
  account: DemoAccount;
  generatedBuyback: DemoBuyback;
  priceIncreases: ExpectedPriceIncrease[];
} {
  const account = generateDemoAccount(catalog, key);
  const generatedBuyback = generateBuyback(catalog, key, today);
  // One order snapshot for both lists, like the order sync's.
  const orders: OrdersSnapshot = {
    ...account.orders,
    pledgeOrders: { ...account.orders.pledgeOrders, ...generatedBuyback.orders.pledgeOrders },
    orders: { ...account.orders.orders, ...generatedBuyback.orders.orders },
  };
  const priceOf = createPriceLookup(catalog.ships.map(({ name, msrp }) => ({ name, price: msrp })));
  const itemPriceOf = createItemPriceLookup(catalog.items);
  // The demo's expected price increases (#194), matched like the website's.
  const priceIncreases = demoPriceIncreases(
    catalog,
    account.pledges,
    generatedBuyback.pledges,
    now,
  );
  const matcher = createPriceIncreaseMatcher(priceIncreases, now);
  const views = account.pledges.map((pledge, position) => {
    const view = withOrder(toPledgeView(pledge, {}, position, priceOf, itemPriceOf), orders);
    const priceIncrease = matcher.hangar(pledge);
    return priceIncrease ? { ...view, priceIncrease } : view;
  });
  const pledges = demoViews(views, key, today, now);
  const buyback = generatedBuybackViews(
    generatedBuyback,
    catalog,
    orders,
    account,
    key,
    matcher.buyback,
  );
  return { pledges, buyback, account, generatedBuyback, priceIncreases };
}

/**
 * The generated buy back (#177) as the list shows it: built like the real one
 * (`use-buyback-pledges.ts`) – prices of every source, images, availability and "probably
 * giftable" from the generated orders and gift flags – with made-up display ids.
 */
function generatedBuybackViews(
  generated: DemoBuyback,
  catalog: DemoCatalog,
  orders: OrdersSnapshot,
  account: DemoAccount,
  key: string,
  priceIncreaseOf: NonNullable<Parameters<typeof toBuybackView>[1]['priceIncreaseOf']>,
): BuybackView[] {
  const fakeId = createFakeIds(key);
  const giftable = createGiftableCheck({
    orders,
    hangarPledges: account.pledges,
    giftFlags: generated.giftFlags,
  });
  const priceOf = createBuybackPricer({
    ships: catalog.ships,
    shipPriceOf: createPriceLookup(catalog.ships.map(({ name, msrp }) => ({ name, price: msrp }))),
    itemPriceOf: createItemPriceLookup(catalog.items),
    pledges: generated.pledges,
  });
  const imageOf = createBuybackImager({ ships: catalog.ships });
  const availabilityOf = createAvailabilityCheck(catalog.ships);
  return generated.pledges.map((pledge, position) =>
    anonymized(
      withOrder(
        toBuybackView(pledge, {
          position,
          giftable,
          priceOf,
          imageOf,
          availabilityOf,
          priceIncreaseOf,
        }),
        orders,
      ),
      fakeId,
    ),
  );
}

/** The generated demo hangar as the list shows it (see `generatedDemo`). */
export const generatedHangar = (
  catalog: DemoCatalog,
  key: string,
  today = localToday(),
  now = Date.now(),
): PledgeView[] => generatedDemo(catalog, key, today, now).pledges;

/** A demo list with made-up ids (also for the search), purchase dates and pages. */
function demoViews(
  selection: readonly PledgeView[],
  key: string,
  today: string,
  now: number,
): PledgeView[] {
  const fakeId = createFakeIds(key);
  const justBought = justBoughtOf(selection);
  const dates = demoDates(
    selection,
    key,
    today,
    justBought === undefined
      ? undefined
      : { id: justBought, on: demoPurchaseTime(now).slice(0, 10) },
  );
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
 * The pledge the demo shows as bought a few hours ago, to try marking it to melt (#97): the first
 * meltable one bought with store credit, before the first one paid with money – so its date stays
 * the newest of the list, ahead of the refund pledges. None if the list starts with a money-paid
 * pledge.
 */
export function justBoughtOf(
  pledges: readonly { id: number; order?: object; isMeltable: boolean }[],
): number | undefined {
  for (const pledge of pledges) {
    if (pledge.order) return undefined;
    if (pledge.isMeltable) return pledge.id;
  }
  return undefined;
}

/**
 * The made-up purchase time of that pledge: `DEMO.justBoughtHoursAgo` hours before the start of the
 * current hour, in local time and written like the pledge log's times ("2026-11-08T15:00").
 */
export function demoPurchaseTime(now = Date.now()): string {
  const time = new Date(now);
  time.setMinutes(0, 0, 0);
  time.setHours(time.getHours() - DEMO.justBoughtHoursAgo);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:00`;
}

/**
 * Made-up purchase dates for the demo selection, newest first like RSI's list (which is sorted by
 * pledge id, so by purchase): random between `DEMO.earliestDate` and `today`, nothing of the real
 * dates. The first pledges with a money-paid order are dated for the refund tags (see
 * `DEMO.refundDaysLeft`), and the pledge bought a few hours ago (`justBought`) on its day; all
 * other money-paid pledges are older than the refund period, so they show no tag.
 */
export function demoDates(
  pledges: readonly { id: number; order?: object }[],
  key: string,
  today: string,
  /** The pledge bought a few hours ago (see `justBoughtOf`), on this day. */
  justBought?: { id: number; on: string },
): string[] {
  // Fixed dates, newest first: the pledge just bought, the refund pledges, then the end of the
  // refund period.
  const anchors = new Map<number, string>();
  if (justBought) anchors.set(justBought.id, justBought.on);
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
