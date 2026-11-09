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
}

export const rebuyPlanItem = storage.defineItem<StoredRebuyPlan | null>('local:consultant.plan', {
  fallback: null,
});

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
