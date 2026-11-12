import { storeNameOf } from '../items/item-prices';
import type { StoreItem } from '../items/store-items';
import { dayOf, type PaintPledge, type PaintRebuyPlan, type PaintTier } from './calculation';
import type { CartLine } from './cart';

/*
 * The plan of the Paint Discount Consultant whose paints were put into the cart (#103), kept on
 * its own while it runs (#245): which own paints were to be bought again and which filler paints
 * were probably bought with them, which way was chosen, and the facts that can't be worked out
 * later – the store credit at the start, the store prices, when paints were melted and for how
 * much, the purchase. #105 compares it with the hangar later, to tell when the filler paints can
 * be melted. Kept in this browser only; one plan at a time.
 */

/** Format version of the stored plan; version 1 is upgraded on read (`currentPlanOf`). */
export const REBUY_PLAN_VERSION = 2;

/** The way of a plan: buy the cart first ("buy first", 1) or melt the own paints first (2). */
export type PlanWay = 'buy' | 'melt';

/** An own paint of a stored plan: the old pledge to melt and buy again. */
export interface StoredOwnPaint {
  pledgeId: number;
  title: string;
  skuId: number;
  /** What melting it gives, as the plan worked it out, in USD. */
  meltValue: number;
  /** Its standard price in the Pledge Store when the plan started; unknown for version 1. */
  price?: number;
  /** When it was melted (ms): seen in the bulk melting, or first seen gone (`seenGone`). */
  meltedAt?: number;
  /** What melting it really gave, in USD, where known. */
  freed?: number;
  /** Only seen gone from the hangar: `meltedAt` is when that was noticed, not the melt. */
  seenGone?: boolean;
}

/** Filler paints of one SKU put into the cart, to melt again after 24 hours. */
export interface StoredFiller {
  skuId: number;
  name: string;
  quantity: number;
  price: number;
}

/** The filler paints of a plan as bought (#105). */
export interface FillerPurchase {
  orderId: string;
  /** When the order created them, as the pledge log shows it ("2026-11-09T19:55"), if known. */
  boughtAt?: string;
  /**
   * The pledges of the filler paints this order created – never others of the same name. Read by
   * the "can be melted" notification without a version check: it always means the fillers.
   */
  pledgeIds: number[];
  /** When the order was found, in ms. */
  foundAt: number;
  /** When the browser notification about them was shown, in ms. */
  notifiedAt?: number;
}

/** The order that bought a plan's paints (#245): also found for plans without fillers. */
export interface PlanPurchase extends FillerPurchase {
  /** The new copies of the own paints this order created; unknown for purchases of version 1. */
  ownPledgeIds?: number[];
  /** The SKU of each pledge of the order the plan bought, by pledge id (copies and fillers). */
  skus?: Record<number, number>;
}

export interface StoredRebuyPlan {
  version: 2;
  /** The way chosen: the steps and their order follow it, and nothing else tells it later. */
  way: PlanWay;
  /** When the plan started – the paints were put into the cart, or melted first –, in ms. */
  at: number;
  /** The account's store credit when it started, in USD; unknown for plans of version 1. */
  creditAtStart?: number;
  tier: PaintTier;
  /** Own paints to melt and buy again. */
  own: StoredOwnPaint[];
  /** Filler paints put into the cart, to melt again after 24 hours. */
  fillers: StoredFiller[];
  /** What the cart was worked out to cost after the volume discount, in USD. */
  cartCost: number;
  /** The order that bought the plan's paints, once found (#105, #245). */
  purchase?: PlanPurchase;
  /** When each filler pledge was melted or first seen gone (ms), by pledge id. */
  fillersMelted?: Record<number, number>;
  /** When the cart was worked out again for the store credit there was (ms), and from what tier. */
  recalculatedAt?: number;
  previousTier?: PaintTier;
  /** No such order showed within `PAINT_CONSULTANT.fillerCheckDays`: the plan may be given up. */
  checkEndedAt?: number;
  /** Upgraded from an older format: its way was inferred. */
  migratedFrom?: 1;
}

/** The plan as version 1 stored it (before #245). */
export interface StoredRebuyPlanV1 {
  version: 1;
  at: number;
  tier: PaintTier;
  own: { pledgeId: number; title: string; skuId: number; meltValue: number }[];
  fillers: StoredFiller[];
  cartCost: number;
  purchase?: FillerPurchase;
  checkEndedAt?: number;
}

/** What may be stored under the plan's key. */
export type AnyStoredRebuyPlan = StoredRebuyPlan | StoredRebuyPlanV1;

export const rebuyPlanItem = storage.defineItem<AnyStoredRebuyPlan | null>(
  'local:consultant.plan',
  { fallback: null },
);

/**
 * The kept plan of the demo mode (#131), apart from the real one: the demo never reads or writes
 * the account's plan. Set for the stage chosen in the demo settings (`demo/demo-running-plan.ts`).
 */
export const demoRebuyPlanItem = storage.defineItem<AnyStoredRebuyPlan | null>(
  'local:demo.consultantPlan',
  { fallback: null },
);

/** The kept plan's storage: the demo's in the demo mode, the account's otherwise. */
export const rebuyPlanItemOf = (demo: boolean) => (demo ? demoRebuyPlanItem : rebuyPlanItem);

/**
 * What the demo's running plan sees instead of RSI's cart and the store credit (#245): the demo
 * never reads the real cart. `cart: null` – not read yet; `credit` overrides the demo's store
 * credit for the running plan only, e.g. to show that it isn't enough.
 */
export interface DemoRunInputs {
  cart: CartLine[] | null;
  credit?: number;
}

export const demoRunInputsItem = storage.defineItem<DemoRunInputs | null>(
  'local:demo.consultantRun',
  { fallback: null },
);

/** The plan as it is stored when it starts, with the way chosen and the store credit there is. */
export function storedPlanOf(
  plan: PaintRebuyPlan,
  at: number,
  way: PlanWay,
  creditAtStart?: number,
): StoredRebuyPlan {
  return {
    version: REBUY_PLAN_VERSION,
    way,
    at,
    ...(creditAtStart !== undefined && { creditAtStart }),
    tier: { ...plan.tier },
    own: plan.own.map((paint) => ({
      pledgeId: paint.pledgeId,
      title: paint.title,
      skuId: paint.storePaint.id,
      meltValue: paint.meltValue,
      price: paint.storePaint.price,
    })),
    fillers: plan.fillers.map((filler) => ({
      skuId: filler.paint.id,
      name: filler.paint.name,
      quantity: filler.quantity,
      price: filler.paint.price,
    })),
    cartCost: plan.cartCost,
  };
}

/**
 * The way of a plan of version 1, which didn't keep it: an own paint gone from the hangar without
 * a copy bought since the plan's day was melted first; anything else counts as "buy first", the
 * safe default – its steps still show paints melted first as done.
 */
export function inferredWay(
  plan: StoredRebuyPlanV1,
  pledges: readonly Pick<PaintPledge, 'id' | 'title' | 'createdAt'>[],
): PlanWay {
  const inHangar = new Set(pledges.map((pledge) => pledge.id));
  const since = dayOf(plan.at);
  const keptIds = new Set(plan.own.map((paint) => paint.pledgeId));
  const copies = new Map<string, number>();
  for (const pledge of pledges) {
    if (keptIds.has(pledge.id) || (pledge.createdAt ?? '') < since) continue;
    const name = storeNameOf(pledge.title);
    copies.set(name, (copies.get(name) ?? 0) + 1);
  }
  for (const paint of plan.own) {
    if (inHangar.has(paint.pledgeId)) continue;
    const name = storeNameOf(paint.title);
    const left = copies.get(name) ?? 0;
    if (!left) return 'melt';
    copies.set(name, left - 1);
  }
  return 'buy';
}

/**
 * A plan of version 1 as version 2: the way inferred from the hangar (without it "buy first"), the
 * own paints' prices from the Pledge Store where it still sells them.
 */
export function upgradePlan(
  plan: StoredRebuyPlanV1,
  pledges?: readonly Pick<PaintPledge, 'id' | 'title' | 'createdAt'>[],
  storeItems?: readonly StoreItem[],
): StoredRebuyPlan {
  const prices = new Map((storeItems ?? []).map((item) => [item.id, item.price]));
  return {
    ...plan,
    version: REBUY_PLAN_VERSION,
    way: pledges ? inferredWay(plan, pledges) : 'buy',
    own: plan.own.map((paint) => {
      const price = prices.get(paint.skuId);
      return price === undefined ? { ...paint } : { ...paint, price };
    }),
    migratedFrom: 1,
  };
}

/**
 * Any stored value as a plan of the current version, or undefined: every reader goes through it
 * instead of comparing versions, so a plan kept before #245 keeps working.
 */
export function currentPlanOf(
  value: unknown,
  pledges?: readonly Pick<PaintPledge, 'id' | 'title' | 'createdAt'>[],
  storeItems?: readonly StoreItem[],
): StoredRebuyPlan | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const plan = value as AnyStoredRebuyPlan;
  if (!Array.isArray(plan.own) || !Array.isArray(plan.fillers)) return undefined;
  if (plan.version === REBUY_PLAN_VERSION) return plan;
  if (plan.version === 1) return upgradePlan(plan, pledges, storeItems);
  return undefined;
}

/**
 * Changes the stored plan with `change` (given the current one; the same object for no change),
 * read right before writing: several tabs may record facts of the same plan.
 */
export async function updatePlan(
  item: typeof rebuyPlanItem,
  change: (plan: StoredRebuyPlan) => StoredRebuyPlan | null,
  context: Parameters<typeof currentPlanOf>[1] = undefined,
): Promise<StoredRebuyPlan | null | undefined> {
  const stored = await item.getValue();
  const plan = currentPlanOf(stored, context);
  if (!plan) return undefined;
  const next = change(plan);
  if (next !== stored) await item.setValue(next);
  return next;
}
