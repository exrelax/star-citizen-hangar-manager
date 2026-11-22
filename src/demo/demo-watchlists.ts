import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { translate, type Locale } from '@/i18n';
import type { Ship, ShipSku } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import { fillerWatchlist, fillerWatchlistId } from '@/watchlists/filler-watchlist';
import type { DemoRebuyWatchlistCases } from './demo-rebuy-cases';
import type { StoreCatalog } from '@/watchlists/store-status';
import {
  demoStoreSeenItem,
  seenKey,
  withSeen,
  type SeenStore,
} from '@/watchlists/watch-store-changes';
import { clearWatchlists, saveWatchlist } from '@/watchlists/watchlists-storage';
import {
  addItem,
  createWatchlist,
  type WatchItemRef,
  type Watchlist,
} from '@/watchlists/watchlists';

/*
 * The demo's watchlists (#474), made of the demo hangar, its buy back and the public catalog only,
 * so screenshots show every case of the watchlists (#464) without the real account:
 *
 * - "Melt after the IAE": a date ahead with a reminder; pledges of the hangar and the buy back, a
 *   pledge no longer in the hangar (now in the buy back), a paint of the store three times.
 * - "CCUs to buy when back in stock": no date; a CCU, a standalone ship with LTI twice and a paint
 *   of the store, with notifications on their changes – the demo noted them as they were before, so
 *   the sidebar shows a new price and an item on sale again.
 * - "Due today": its date has come, with a reminder: the sidebar's reminder.
 * - "Wishlist": a date without a reminder.
 * - "Later": empty.
 * - "Rebuy after <date>" (#532): what the demo's pledges to rebuy are rebought as, one pricier
 *   now, one no longer on sale (`rebuyList`).
 * - The Paint Discount Consultant's filler paints (#473), with their reminder.
 *
 * Their names are in the language shown when the demo starts; they are the demo's own and can be
 * changed like any watchlist.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface DemoWatchlistsInput {
  hangar: readonly PledgeView[];
  buyback: readonly BuybackView[];
  ships: readonly Ship[];
  items: readonly StoreItem[];
  buyable?: readonly ShipSku[];
  /** What the generated demo's pledges to rebuy are rebought as (#532). */
  rebuy?: DemoRebuyWatchlistCases;
  now: number;
  locale: Locale;
}

/**
 * The ships of the store items on "CCUs to buy when back in stock": the CCU's ships and the
 * standalone ship with LTI – the cheapest ones on sale. Melt and Rebuy's cases leave them out
 * (#532), so their store items stay as they are.
 */
export function demoWatchlistShips(
  ships: readonly Ship[],
  onSale: (shipId: number) => boolean,
): { from?: Ship; to?: Ship; ship?: Ship } {
  const sorted = [...ships].filter((ship) => ship.msrp > 0).sort((a, b) => a.msrp - b.msrp);
  const from = sorted.find((ship) => ship.msrp >= 25);
  const to = sorted.find((ship) => from && ship.msrp > from.msrp + 50 && onSale(ship.id));
  const ship = sorted.find((candidate) => onSale(candidate.id) && candidate !== to);
  return { from, to, ship };
}

/** The demo's watchlists, and how it noted their store items before (for the changes). */
export function demoWatchlists(input: DemoWatchlistsInput): {
  lists: Watchlist[];
  seen: SeenStore;
} {
  const { hangar, buyback, now, locale } = input;
  const t = (key: Parameters<typeof translate>[1], args?: (string | number)[]) =>
    translate(locale, key, args);
  // Every list a minute apart, so they keep their order.
  let at = now - 10 * DAY;
  const make = (fields: Parameters<typeof createWatchlist>[0], id: string) =>
    createWatchlist(fields, (at += 60_000), `demo${id}`);
  const add = (
    list: Watchlist,
    item: WatchItemRef & { name: string; value?: number; count?: number },
  ) => addItem(list, item, list.createdAt);

  const paints = input.items.filter((item) => item.category === 'Paints');
  const onSale = new Set(input.buyable?.map((sku) => sku.shipId));
  const { from, to, ship } = demoWatchlistShips(input.ships, (id) => onSale.has(id));
  const meltable = hangar.filter((pledge) => pledge.isMeltable);
  const ccu = meltable.find((pledge) => pledge.isCcu);
  const paint = meltable.find((pledge) => pledge.isPaint);
  const hangarItem = (pledge: PledgeView) => ({
    kind: 'hangar' as const,
    pledgeId: pledge.id,
    name: pledge.title,
    value: pledge.valueUsd,
  });

  // 1. Melt after the IAE: pledges of the hangar and the buy back, one gone, a store paint.
  let melt = make(
    {
      name: t('watchlists.demo.meltName'),
      description: t('watchlists.demo.meltDescription'),
      dueAt: now + 2 * DAY,
    },
    'melt',
  );
  for (const pledge of [ccu, paint].filter((entry) => entry !== undefined)) {
    melt = add(melt, hangarItem(pledge));
  }
  const [bought, moved] = buyback;
  if (bought) {
    melt = add(melt, {
      kind: 'buyback',
      pledgeId: bought.id,
      name: bought.title,
      ...(bought.price && { value: bought.price.amount }),
    });
  }
  // A pledge of the hangar melted since: it is in the buy back now.
  if (moved) melt = add(melt, { kind: 'hangar', pledgeId: moved.id, name: moved.title, value: 40 });
  const storePaint = paints[0];
  if (storePaint) {
    melt = add(melt, {
      kind: 'storePaint',
      skuId: storePaint.id,
      name: storePaint.name,
      value: storePaint.price,
      count: 3,
    });
  }

  // 2. CCUs to buy when back in stock: a CCU, a standalone ship with LTI twice, a paint.
  let stock = make(
    { name: t('watchlists.demo.stockName'), description: t('watchlists.demo.stockDescription') },
    'stock',
  );
  if (from && to) {
    stock = add(stock, {
      kind: 'storeCcu',
      fromShipId: from.id,
      toShipId: to.id,
      name: t('watchlists.ccuName', [from.name, to.name]),
      value: to.msrp - from.msrp,
    });
  }
  if (ship) {
    stock = add(stock, {
      kind: 'storeShip',
      shipId: ship.id,
      insurance: 'lti',
      name: ship.name,
      value: ship.msrp,
      count: 2,
    });
  }
  const otherPaint = paints.find((item) => item.available && item !== storePaint);
  if (otherPaint) {
    stock = add(stock, {
      kind: 'storePaint',
      skuId: otherPaint.id,
      name: otherPaint.name,
      value: otherPaint.price,
    });
  }

  // 3. Due today, 4. a date without reminder, 5. empty.
  const due = make(
    { name: t('watchlists.demo.dueName'), dueAt: now - 2 * HOUR, reminder: true },
    'due',
  );
  let wish = make(
    { name: t('watchlists.demo.wishName'), dueAt: now + 30 * DAY, reminder: false },
    'wish',
  );
  if (ship)
    wish = add(wish, { kind: 'storeShip', shipId: ship.id, name: ship.name, value: ship.msrp });
  const rebuy = input.rebuy && rebuyList(input.rebuy, make, add, t, now, locale);
  const later = make({ name: t('watchlists.demo.laterName') }, 'later');

  // 6. The Paint Discount Consultant's filler paints (#473), waiting to be melted.
  const fillers = hangar.filter((pledge) => pledge.isPaint && pledge !== paint).slice(0, 2);
  const filler = fillerWatchlist({
    orderId: 'DEMO',
    fillers,
    planAt: now - 4 * HOUR,
    now: now - 4 * HOUR,
    locale,
  });

  const lists = [
    melt,
    stock,
    due,
    wish,
    ...(rebuy ? [rebuy] : []),
    later,
    ...(filler ? [filler] : []),
  ];

  // The store items as the demo noted them before: a higher price of the CCU, the paint not on sale.
  const catalog: StoreCatalog = {
    ships: input.ships,
    ...(input.buyable && { buyable: input.buyable }),
    items: input.items,
  };
  let seen: Record<string, { price?: number; onSale?: boolean }> = {
    ...withSeen({}, stock, catalog),
  };
  for (const item of stock.items) {
    const key = seenKey(stock, item);
    const now = seen[key];
    if (!now) continue;
    if (item.kind === 'storeCcu' && now.price !== undefined)
      seen[key] = { ...now, price: now.price + 25 };
    if (item.kind === 'storePaint') seen[key] = { ...now, onSale: false };
  }
  seen = { ...seen, ...withSeen({}, melt, catalog) };
  return { lists, seen };
}

/** A made-up SKU for the Best in Show paint the store doesn't sell (#532). */
const RETIRED_PAINT_SKU = 979_999_999;

/**
 * "Rebuy after <date>" (#531, #532): what the demo's rebuyable pledges are rebought as – the paint
 * twice, the standalone ship with 10 years of insurance at a lower price than now, the CCU – and a
 * Best in Show paint the store doesn't sell any more. Its date a week ahead, with a reminder.
 */
function rebuyList(
  cases: DemoRebuyWatchlistCases,
  make: (fields: Parameters<typeof createWatchlist>[0], id: string) => Watchlist,
  add: (
    list: Watchlist,
    item: WatchItemRef & { name: string; value?: number; count?: number },
  ) => Watchlist,
  t: (key: Parameters<typeof translate>[1], args?: (string | number)[]) => string,
  now: number,
  locale: Locale,
): Watchlist | undefined {
  const { base, target, paint, retired } = cases;
  if (!base && !paint) return undefined;
  const dueAt = now + 7 * DAY;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(dueAt);
  let list = make({ name: t('watchlists.rebuy.name', [date]), dueAt, reminder: true }, 'rebuy');
  if (paint) {
    list = add(list, {
      kind: 'storePaint',
      skuId: paint.id,
      name: paint.name,
      value: paint.price,
      count: 2,
    });
  }
  if (base) {
    // Added when it cost less: pricier now.
    list = add(list, {
      kind: 'storeShip',
      shipId: base.id,
      insurance: 120,
      name: `${base.name} - 10 Year`,
      value: Math.max(5, base.msrp - 10),
    });
  }
  if (base && target) {
    list = add(list, {
      kind: 'storeCcu',
      fromShipId: base.id,
      toShipId: target.id,
      name: t('watchlists.ccuName', [base.name, target.name]),
      value: target.msrp - base.msrp,
    });
  }
  if (retired) {
    list = add(list, { kind: 'storePaint', skuId: RETIRED_PAINT_SKU, name: retired, value: 15 });
  }
  return list;
}

/** The id of the demo's filler paints' watchlist, for the running plan's link (#473). */
export const DEMO_FILLER_WATCHLIST = fillerWatchlistId('DEMO');

/** The demo key the watchlists were made for, so they are made once per demo hangar. */
const seededItem = storage.defineItem<string | null>('local:demo.watchlistsSeeded', {
  fallback: null,
});

/** Makes the demo's watchlists, once per demo key; changes to them stay until the next key. */
export async function seedDemoWatchlists(
  key: string,
  made: { lists: readonly Watchlist[]; seen: SeenStore },
): Promise<void> {
  if ((await seededItem.getValue()) === key) return;
  await seededItem.setValue(key);
  await clearWatchlists(true);
  // Noted first: the changes show as soon as the lists do.
  await demoStoreSeenItem.setValue(made.seen);
  for (const list of made.lists) await saveWatchlist(list, true);
}

/** The demo's watchlists made again with the next visit of the demo. */
export async function resetDemoWatchlists(): Promise<void> {
  await Promise.all([seededItem.removeValue(), demoStoreSeenItem.removeValue()]);
}
