import { PAINT_CONSULTANT } from '@/config';
import type { MeltMarks } from '@/hangar/melt-marks';
import { isPaintItem } from '@/hangar/pledge-view';
import { isPaidWithMoney, ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import { storeNameOf } from '../items/item-prices';
import type { StoreItem } from '../items/store-items';
import { dayOf, type PaintPledge } from './calculation';
import type { FillerPurchase, PlanPurchase, StoredRebuyPlan } from './rebuy-plan-storage';

/*
 * The paints of the Paint Discount Consultant's plan, once bought (#105, #245). The plan kept when
 * its paints were put into the cart is checked against the orders and the hangar: an order made on
 * the plan's day or later, paid with store credit, that created paints of the plan – own ones and
 * filler ones – confirms the purchase. The new copies of the own paints and the filler paints it
 * created are kept by their pledge ids; the fillers are marked to melt (#97), never by name: the
 * same paint can be owned several times, and an older copy must not be melted. They can be melted
 * 24 hours after that order; the sidebar and, if allowed, the browser tell when.
 */

/** A pledge of the hangar as needed here. */
export type HangarPledge = Pick<PaintPledge, 'id' | 'title' | 'items' | 'createdAt'> & {
  upgrade?: unknown;
};

/** The SKUs of a plan's paints by the name their pledges carry. */
export function skuByNameOf(
  plan: Pick<StoredRebuyPlan, 'own' | 'fillers'>,
  storeItems: readonly StoreItem[],
): Map<string, number> {
  const names = new Map(storeItems.map((item) => [item.id, item.name]));
  const skuByName = new Map<string, number>();
  for (const filler of plan.fillers) {
    skuByName.set(storeNameOf(names.get(filler.skuId) ?? filler.name), filler.skuId);
  }
  for (const paint of plan.own) {
    const name = names.get(paint.skuId);
    if (name) skuByName.set(storeNameOf(name), paint.skuId);
    // The own pledge's title names the paint too, also once the store no longer sells it.
    if (!skuByName.has(storeNameOf(paint.title))) {
      skuByName.set(storeNameOf(paint.title), paint.skuId);
    }
  }
  return skuByName;
}

/** The paint a pledge holds, as a SKU of the plan; none for other pledges. */
export function paintSkuOf(
  pledge: HangarPledge,
  skuByName: ReadonlyMap<string, number>,
): number | undefined {
  const [item, ...others] = pledge.items;
  if (!item || others.length || pledge.upgrade || !isPaintItem(item)) return undefined;
  return skuByName.get(storeNameOf(pledge.title)) ?? skuByName.get(storeNameOf(item.title));
}

/**
 * The order that bought the plan's paints: with the pledges of the new copies of its own paints
 * and of the fillers it created. None while there is no such order. A plan with filler paints
 * needs at least one of them in the order (as before #245); one without needs a new copy.
 */
export function findPlanPurchase(input: {
  plan: StoredRebuyPlan;
  pledges: readonly HangarPledge[];
  orders: OrdersSnapshot | null | undefined;
  storeItems: readonly StoreItem[];
  now: number;
}): PlanPurchase | undefined {
  const { plan, orders } = input;
  if (orders?.version !== ORDERS_SNAPSHOT_VERSION) return undefined;

  const skuByName = skuByNameOf(plan, input.storeItems);
  const ownSkus = new Set(plan.own.map((paint) => paint.skuId));
  const oldIds = new Set(plan.own.map((paint) => paint.pledgeId));

  // The plan's paints created on its day or later, by order.
  const since = dayOf(plan.at);
  const byOrder = new Map<string, { skuId: number; pledgeId: number; createdAt?: string }[]>();
  for (const pledge of input.pledges) {
    if (oldIds.has(pledge.id)) continue;
    const link = orders.pledgeOrders[pledge.id];
    const created = link?.createdAt?.slice(0, 10) ?? pledge.createdAt;
    if (!link || link.buyback || !created || created < since) continue;
    const skuId = paintSkuOf(pledge, skuByName);
    if (skuId === undefined) continue;
    const order = byOrder.get(link.orderId) ?? [];
    order.push({ skuId, pledgeId: pledge.id, createdAt: link.createdAt });
    byOrder.set(link.orderId, order);
  }

  /** As many pledges of a SKU as the plan bought, the youngest first. */
  const take = (paints: { skuId: number; pledgeId: number }[], skuId: number, count: number) =>
    paints
      .filter((paint) => paint.skuId === skuId)
      .map((paint) => paint.pledgeId)
      .sort((a, b) => b - a)
      .slice(0, count);
  const ownCounts = new Map<number, number>();
  for (const paint of plan.own) ownCounts.set(paint.skuId, (ownCounts.get(paint.skuId) ?? 0) + 1);

  const candidates = [...byOrder.entries()].flatMap(([orderId, paints]) => {
    // Paid with store credit: an order paid with money isn't the plan's.
    const order = orders.orders[orderId];
    if (!order || isPaidWithMoney(order)) return [];
    if (!paints.some((paint) => ownSkus.has(paint.skuId))) return [];
    // An own paint can be a filler too (another copy of it): the copies first, then the fillers.
    const ownPledgeIds = [...ownCounts].flatMap(([skuId, count]) => take(paints, skuId, count));
    const rest = paints.filter((paint) => !ownPledgeIds.includes(paint.pledgeId));
    const pledgeIds = plan.fillers.flatMap((filler) => take(rest, filler.skuId, filler.quantity));
    if (plan.fillers.length ? !pledgeIds.length : !ownPledgeIds.length) return [];
    const ids = new Set([...ownPledgeIds, ...pledgeIds]);
    const skus = Object.fromEntries(
      paints
        .filter((paint) => ids.has(paint.pledgeId))
        .map((paint) => [paint.pledgeId, paint.skuId]),
    );
    const boughtAt = paints.map((paint) => paint.createdAt).find((at) => !!at);
    return [
      {
        orderId,
        pledgeIds: pledgeIds.sort((a, b) => a - b),
        ownPledgeIds: ownPledgeIds.sort((a, b) => a - b),
        skus,
        paints: paints.length,
        newest: Math.max(...ids),
        boughtAt,
      },
    ];
  });
  // The order with most of the plan's paints, the youngest one of equals.
  const best = candidates.sort((a, b) => b.paints - a.paints || b.newest - a.newest)[0];
  if (!best) return undefined;
  return {
    orderId: best.orderId,
    ...(best.boughtAt && { boughtAt: best.boughtAt }),
    pledgeIds: best.pledgeIds,
    ownPledgeIds: best.ownPledgeIds,
    skus: best.skus,
    foundAt: input.now,
  };
}

/** Whether the plan's purchase is still looked for: kept, not found yet (#245: also after the
 * days of `fillerCheckDays`, which only let the plan be given up). */
export function isPurchaseCheckOpen(
  plan: StoredRebuyPlan | null | undefined,
): plan is StoredRebuyPlan {
  return !!plan && !plan.purchase;
}

/** No order showed within `fillerCheckDays` of the plan: it may be given up. */
export const isFillerCheckOver = (plan: StoredRebuyPlan, now: number) =>
  now - plan.at > PAINT_CONSULTANT.fillerCheckDays * 24 * 60 * 60 * 1000;

/** The melt marks with the filler paints marked at `now` (those marked already keep their time). */
export function withFillerMarks(
  marks: MeltMarks,
  purchase: FillerPurchase,
  now: number,
): MeltMarks {
  const added = purchase.pledgeIds.filter((id) => marks[id] === undefined);
  return added.length ? { ...marks, ...Object.fromEntries(added.map((id) => [id, now])) } : marks;
}
