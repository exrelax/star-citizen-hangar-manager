import type { PaintRebuyPlan, PaintTier } from './calculation';

/*
 * The plan of the Paint Discount Consultant whose paints were put into the cart (#103), kept on
 * its own: which own paints were to be bought again and which filler paints were probably bought
 * with them. #105 compares it with the hangar later, to tell when the filler paints can be melted.
 * Kept in this browser only.
 */

/** Format version of the stored plan; others are ignored. */
export const REBUY_PLAN_VERSION = 1;

export interface StoredRebuyPlan {
  version: number;
  /** When the paints were put into the cart, in ms. */
  at: number;
  tier: PaintTier;
  /** Own paints to melt and buy again. */
  own: { pledgeId: number; title: string; skuId: number; meltValue: number }[];
  /** Filler paints put into the cart, to melt again after 24 hours. */
  fillers: { skuId: number; name: string; quantity: number; price: number }[];
  /** What the cart was worked out to cost after the volume discount, in USD. */
  cartCost: number;
  /** The order that bought the plan's filler paints, once found (#105). */
  purchase?: FillerPurchase;
  /** No such order showed within `PAINT_CONSULTANT.fillerCheckDays`: no longer looked for (ms). */
  checkEndedAt?: number;
}

/** The filler paints of a plan as bought (#105). */
export interface FillerPurchase {
  orderId: string;
  /** When the order created them, as the pledge log shows it ("2026-11-09T19:55"), if known. */
  boughtAt?: string;
  /** The pledges of the filler paints this order created – never others of the same name. */
  pledgeIds: number[];
  /** When the order was found, in ms. */
  foundAt: number;
  /** When the browser notification about them was shown, in ms. */
  notifiedAt?: number;
}

export const rebuyPlanItem = storage.defineItem<StoredRebuyPlan | null>('local:consultant.plan', {
  fallback: null,
});

/**
 * The kept plan of the demo mode (#131), apart from the real one: the demo never reads or writes
 * the account's plan. Set for each demo hangar (`demo/demo-consultant.ts`).
 */
export const demoRebuyPlanItem = storage.defineItem<StoredRebuyPlan | null>(
  'local:demo.consultantPlan',
  { fallback: null },
);

/** The kept plan's storage: the demo's in the demo mode, the account's otherwise. */
export const rebuyPlanItemOf = (demo: boolean) => (demo ? demoRebuyPlanItem : rebuyPlanItem);

/** The plan as it is stored. */
export function storedPlanOf(plan: PaintRebuyPlan, at: number): StoredRebuyPlan {
  return {
    version: REBUY_PLAN_VERSION,
    at,
    tier: { ...plan.tier },
    own: plan.own.map((paint) => ({
      pledgeId: paint.pledgeId,
      title: paint.title,
      skuId: paint.storePaint.id,
      meltValue: paint.meltValue,
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
