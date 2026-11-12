import { storePaintsOf, type PaintPledge, type PaintTier } from './calculation';
import type { StoreItem } from '../items/store-items';
import type { PlanWay, StoredRebuyPlan } from './rebuy-plan-storage';
import { planResultOf } from './running-plan';

/*
 * The plans of the Paint Discount Consultant that ended on their own (#245): once nothing is left
 * of a running plan, it is kept here – what was melted and bought, the tier reached, the store
 * credit and the melt value before and after – and the running plan goes. A discarded plan isn't
 * kept. Newest first, the last `COMPLETED_PLANS_KEPT` only; in this browser only, like the plan.
 */

/** Format version of the stored completed plans; others are ignored. */
export const COMPLETED_PLANS_VERSION = 1;

/** Completed plans kept: enough for the list, without growing for ever. */
export const COMPLETED_PLANS_KEPT = 20;

/** A paint melted or bought by a completed plan: one own paint, or the fillers of one SKU. */
export interface CompletedPaint {
  skuId: number;
  name: string;
  count: number;
  /** What melting gave (melted) or what it cost in the cart (bought), in USD. */
  value: number;
  filler: boolean;
}

export interface CompletedPaintPlan {
  way: PlanWay;
  /** When it started and ended, in ms. */
  startedAt: number;
  completedAt: number;
  /** The tier reached (after a recalculation, the new one). */
  tier: PaintTier;
  orderId?: string;
  ownCount: number;
  fillerCount: number;
  melted: CompletedPaint[];
  bought: CompletedPaint[];
  /** Store credit freed by melting, paid for the cart, and what the plan gained, in USD. */
  freed: number;
  paid: number;
  result: number;
  /** The account's store credit at the start (unknown for plans kept before #245) and the end. */
  creditBefore?: number;
  creditAfter?: number;
  /** Melt value of the own paints before (the old pledges) and after (their new copies). */
  meltBefore: number;
  meltAfter: number;
}

export interface CompletedPlansSnapshot {
  version: number;
  plans: CompletedPaintPlan[];
}

export const completedPlansItem = storage.defineItem<CompletedPlansSnapshot | null>(
  'local:consultant.history',
  { fallback: null },
);

/** The completed plans of the demo mode (#131): the demo never reads or writes the account's. */
export const demoCompletedPlansItem = storage.defineItem<CompletedPlansSnapshot | null>(
  'local:demo.consultantHistory',
  { fallback: null },
);

export const completedPlansItemOf = (demo: boolean) =>
  demo ? demoCompletedPlansItem : completedPlansItem;

/** The completed plans of a stored value, newest first; none of another version. */
export const completedPlansOf = (
  snapshot: CompletedPlansSnapshot | null | undefined,
): CompletedPaintPlan[] => (snapshot?.version === COMPLETED_PLANS_VERSION ? snapshot.plans : []);

const cents = (usd: number) => Math.round(usd * 100);
const usd = (cents: number) => cents / 100;
const keep = (price: number, tier: PaintTier) => Math.round((price * (100 - tier.percent)) / 100);

/**
 * A finished plan as it is kept: from the stored facts, and the hangar for the new copies' melt
 * value (read right at the end, before they change). `credit` is the store credit now.
 */
export function completedPlanOf(
  plan: StoredRebuyPlan,
  input: {
    pledges: readonly Pick<PaintPledge, 'id' | 'valueUsd'>[];
    storeItems?: readonly StoreItem[];
    credit: number | undefined;
    now: number;
  },
): CompletedPaintPlan {
  const names = new Map((input.storeItems ?? []).map((item) => [item.id, item.name]));
  const store = new Map(storePaintsOf(input.storeItems ?? []).map((paint) => [paint.id, paint]));
  const fillerCount = plan.fillers.reduce((sum, filler) => sum + filler.quantity, 0);

  // What the fillers cost in the cart, and melted for again.
  const fillers = plan.fillers.map((filler) => ({
    skuId: filler.skuId,
    name: filler.name,
    count: filler.quantity,
    value: usd(keep(cents(filler.price) * filler.quantity, plan.tier)),
    filler: true,
  }));
  const fillerCents = fillers.reduce((sum, filler) => sum + cents(filler.value), 0);
  // The own paints' price in the cart: kept, or today's, or the rest of the cart.
  const prices = plan.own.map((paint) => paint.price ?? store.get(paint.skuId)?.price);
  const rest = plan.own.length
    ? Math.round((cents(plan.cartCost) - fillerCents) / plan.own.length)
    : 0;
  const ownBought = plan.own.map((paint, i) => ({
    skuId: paint.skuId,
    name: names.get(paint.skuId) ?? paint.title,
    count: 1,
    value: usd(prices[i] === undefined ? rest : keep(cents(prices[i]!), plan.tier)),
    filler: false,
  }));
  const ownMelted = plan.own.map((paint) => ({
    skuId: paint.skuId,
    name: names.get(paint.skuId) ?? paint.title,
    count: 1,
    value: paint.freed ?? paint.meltValue,
    filler: false,
  }));
  const melted = [...ownMelted, ...fillers];
  const freed = usd(melted.reduce((sum, paint) => sum + cents(paint.value), 0));
  const result = planResultOf(plan, input.storeItems);

  // The new copies' melt value; without them, what they cost.
  const values = new Map(input.pledges.map((pledge) => [pledge.id, pledge.valueUsd]));
  const copies = (plan.purchase?.ownPledgeIds ?? [])
    .map((id) => values.get(id))
    .filter((value): value is number => value !== undefined);
  const meltAfter = copies.length
    ? usd(copies.reduce((sum, value) => sum + cents(value), 0))
    : usd(ownBought.reduce((sum, paint) => sum + cents(paint.value), 0));

  return {
    way: plan.way,
    startedAt: plan.at,
    completedAt: input.now,
    tier: { ...plan.tier },
    ...(plan.purchase && { orderId: plan.purchase.orderId }),
    ownCount: plan.own.length,
    fillerCount,
    melted,
    bought: [...ownBought, ...fillers],
    freed,
    paid: plan.cartCost,
    result,
    ...(plan.creditAtStart !== undefined && { creditBefore: plan.creditAtStart }),
    ...(input.credit !== undefined && { creditAfter: input.credit }),
    meltBefore: usd(plan.own.reduce((sum, paint) => sum + cents(paint.meltValue), 0)),
    meltAfter,
  };
}

/**
 * The completed plans with one more, newest first and capped. A plan kept already (by another tab
 * that saw it end too, by its start) isn't added again: the same array then.
 */
export function withCompleted(
  plans: readonly CompletedPaintPlan[],
  plan: CompletedPaintPlan,
): CompletedPaintPlan[] {
  if (plans.some((kept) => kept.startedAt === plan.startedAt && kept.way === plan.way)) {
    return plans as CompletedPaintPlan[];
  }
  return [plan, ...plans]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, COMPLETED_PLANS_KEPT);
}
