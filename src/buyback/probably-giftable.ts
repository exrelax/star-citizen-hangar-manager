import { BUYBACK_GIFTABLE_PURCHASED_BEFORE } from '@/config';
import type { Pledge } from '@/hangar/pledge';
import { isPaidWithMoneyOnly, ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import type { GiftFlags } from './gift-flags';

/*
 * Whether a buy back pledge is probably giftable when bought back with money (#204). RSI's Gifting
 * FAQs (November 2026): a bought back pledge keeps the giftable status it had when it was melted –
 * then RSI offers "Buying as a gift?" at checkout. Pledges acquired before 2026-10-30 were
 * giftable if bought with money only; any store credit, a gift received, or an acquisition on or
 * after that date makes them ungiftable.
 *
 * So, without a request to RSI:
 * 1. the gift flag the hangar showed before the pledge left it (`gift-flags.ts`), if kept,
 * 2. else its order, from the pledge log: paid with money only, before the date – a buy back
 *    paid with money before it counts too, as it made pledges giftable under the old rules.
 * A pledge without a known order (a gift received, orders not read yet) is not marked.
 */

export interface GiftableSources {
  orders?: OrdersSnapshot | null;
  /** The pledges of the stored hangar: their ids and dates tell which ids are older. */
  hangarPledges?: readonly Pick<Pledge, 'id' | 'createdAt'>[];
  giftFlags?: GiftFlags;
  cutoff?: string;
}

/**
 * Highest pledge id known to be bought before the cutoff date, from the hangar's pledges and
 * their creation dates. Pledge ids grow over time and are kept when a pledge is melted, so every
 * pledge up to this id was bought before the cutoff, too.
 */
export function giftableIdLimit(
  hangarPledges: readonly Pick<Pledge, 'id' | 'createdAt'>[],
  cutoff = BUYBACK_GIFTABLE_PURCHASED_BEFORE,
): number | undefined {
  let limit: number | undefined;
  for (const { id, createdAt } of hangarPledges) {
    if (createdAt && createdAt < cutoff && (limit === undefined || id > limit)) limit = id;
  }
  return limit;
}

/** A function telling whether the buy back pledge of an id is probably giftable. */
export function createGiftableCheck({
  orders,
  hangarPledges = [],
  giftFlags = {},
  cutoff = BUYBACK_GIFTABLE_PURCHASED_BEFORE,
}: GiftableSources) {
  const snapshot = orders?.version === ORDERS_SNAPSHOT_VERSION ? orders : undefined;
  const idLimit = giftableIdLimit(hangarPledges, cutoff);
  return (pledgeId: number): boolean => {
    const flag = giftFlags[pledgeId];
    if (flag !== undefined) return flag;
    const link = snapshot?.pledgeOrders[pledgeId];
    const order = link && snapshot.orders[link.orderId];
    if (!order || !isPaidWithMoneyOnly(order)) return false;
    // The pledge log's time ("2026-10-29T19:55") compares with the date as text.
    const created = link.createdAt ?? order.placedAt;
    if (created) return created < cutoff;
    return idLimit !== undefined && pledgeId <= idLimit;
  };
}

export type GiftableCheck = ReturnType<typeof createGiftableCheck>;
