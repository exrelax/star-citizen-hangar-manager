import { PAINT_CONSULTANT } from '@/config';
import { meltMarksItem, type MeltMarks } from '@/hangar/melt-marks';
import { isPaintItem } from '@/hangar/pledge-view';
import { isPaidWithMoney, ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import { storeNameOf } from '../items/item-prices';
import type { StoreItem } from '../items/store-items';
import { dayOf, type PaintPledge } from './calculation';
import {
  REBUY_PLAN_VERSION,
  rebuyPlanItem,
  type FillerPurchase,
  type StoredRebuyPlan,
} from './rebuy-plan-storage';

/*
 * The filler paints of the Paint Discount Consultant, once bought (#105). The plan kept when its
 * paints were put into the cart is checked against the orders and the hangar: an order made on the
 * plan's day or later, paid with store credit, that created paints of the plan – own ones and
 * filler ones – confirms the purchase. The filler paints it created are marked to melt by their
 * pledge ids (#97), never by name: the same paint can be owned several times, and an older copy
 * must not be melted. They can be melted 24 hours after that order; the sidebar and, if allowed,
 * the browser tell when.
 */

/** A pledge of the hangar as needed here. */
type HangarPledge = Pick<PaintPledge, 'id' | 'title' | 'items' | 'createdAt'> & {
  upgrade?: unknown;
};

/** The paint a pledge holds, as a SKU of the plan; none for other pledges. */
function skuOf(pledge: HangarPledge, skuByName: ReadonlyMap<string, number>): number | undefined {
  const [item, ...others] = pledge.items;
  if (!item || others.length || pledge.upgrade || !isPaintItem(item)) return undefined;
  return skuByName.get(storeNameOf(pledge.title)) ?? skuByName.get(storeNameOf(item.title));
}

/**
 * The order that bought the plan's filler paints, with the pledges of the fillers it created; none
 * while there is no such order (or the plan has no filler paints).
 */
export function findFillerPurchase(input: {
  plan: StoredRebuyPlan;
  pledges: readonly HangarPledge[];
  orders: OrdersSnapshot | null | undefined;
  storeItems: readonly StoreItem[];
  now: number;
}): FillerPurchase | undefined {
  const { plan, orders } = input;
  if (!plan.fillers.length || orders?.version !== ORDERS_SNAPSHOT_VERSION) return undefined;

  // The names of the plan's paints, as the pledges carry them.
  const names = new Map(input.storeItems.map((item) => [item.id, item.name]));
  const skuByName = new Map<string, number>();
  for (const filler of plan.fillers) {
    skuByName.set(storeNameOf(names.get(filler.skuId) ?? filler.name), filler.skuId);
  }
  const ownSkus = new Set(plan.own.map((paint) => paint.skuId));
  for (const skuId of ownSkus) {
    const name = names.get(skuId);
    if (name) skuByName.set(storeNameOf(name), skuId);
  }

  // The plan's paints created on its day or later, by order.
  const since = dayOf(plan.at);
  const byOrder = new Map<string, { skuId: number; pledgeId: number; createdAt?: string }[]>();
  for (const pledge of input.pledges) {
    const link = orders.pledgeOrders[pledge.id];
    const created = link?.createdAt?.slice(0, 10) ?? pledge.createdAt;
    if (!link || link.buyback || !created || created < since) continue;
    const skuId = skuOf(pledge, skuByName);
    if (skuId === undefined) continue;
    const order = byOrder.get(link.orderId) ?? [];
    order.push({ skuId, pledgeId: pledge.id, createdAt: link.createdAt });
    byOrder.set(link.orderId, order);
  }

  const candidates = [...byOrder.entries()].flatMap(([orderId, paints]) => {
    // Paid with store credit: an order paid with money isn't the plan's.
    const order = orders.orders[orderId];
    if (!order || isPaidWithMoney(order)) return [];
    if (!paints.some((paint) => ownSkus.has(paint.skuId))) return [];
    // The filler paints of the plan, as many of each as it planned; the youngest pledges first.
    const pledgeIds = plan.fillers.flatMap((filler) =>
      paints
        .filter((paint) => paint.skuId === filler.skuId)
        .map((paint) => paint.pledgeId)
        .sort((a, b) => b - a)
        .slice(0, filler.quantity),
    );
    if (!pledgeIds.length) return [];
    const boughtAt = paints.map((paint) => paint.createdAt).find((at) => !!at);
    return [
      { orderId, pledgeIds: pledgeIds.sort((a, b) => a - b), paints: paints.length, boughtAt },
    ];
  });
  // The order with most of the plan's paints, the youngest one of equals.
  const best = candidates.sort(
    (a, b) => b.paints - a.paints || Math.max(...b.pledgeIds) - Math.max(...a.pledgeIds),
  )[0];
  if (!best) return undefined;
  return {
    orderId: best.orderId,
    ...(best.boughtAt && { boughtAt: best.boughtAt }),
    pledgeIds: best.pledgeIds,
    foundAt: input.now,
  };
}

/** Whether the plan's purchase is still looked for: kept, with fillers, not found, not too old. */
export function isFillerCheckOpen(
  plan: StoredRebuyPlan | null | undefined,
): plan is StoredRebuyPlan {
  return !!plan && !!plan.fillers.length && !plan.purchase && plan.checkEndedAt === undefined;
}

/** No order showed within `fillerCheckDays` of the plan: it isn't looked for any more. */
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

/**
 * Looks for the order of the kept plan's filler paints (the content script, whenever the hangar,
 * the orders or the Pledge Store items change): found, its fillers are marked to melt and the
 * purchase is kept with the plan; after `fillerCheckDays` without it, it isn't looked for any more.
 * The plan itself stays: paints bought again (#139) and those left to buy (#168) need it.
 */
export async function checkFillerPurchase(input: {
  pledges: readonly HangarPledge[];
  orders: OrdersSnapshot | null | undefined;
  storeItems: readonly StoreItem[];
  now?: number;
}): Promise<FillerPurchase | undefined> {
  const now = input.now ?? Date.now();
  const plan = await rebuyPlanItem.getValue();
  if (plan?.version !== REBUY_PLAN_VERSION || !isFillerCheckOpen(plan)) return undefined;
  const purchase = findFillerPurchase({ ...input, plan, now });
  if (purchase) {
    await meltMarksItem.setValue(withFillerMarks(await meltMarksItem.getValue(), purchase, now));
    await rebuyPlanItem.setValue({ ...plan, purchase });
  } else if (isFillerCheckOver(plan, now)) {
    await rebuyPlanItem.setValue({ ...plan, checkEndedAt: now });
  }
  return purchase;
}
