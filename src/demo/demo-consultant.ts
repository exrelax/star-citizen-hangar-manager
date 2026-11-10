import type { PledgeView } from '@/hangar/pledge-view';
import { findRebought, ownPaintsOf, storePaintsOf } from '@/store/paint-consultant/calculation';
import { storeNameOf } from '@/store/items/item-prices';
import type { StoreItem } from '@/store/items/store-items';
import {
  demoRebuyPlanItem,
  REBUY_PLAN_VERSION,
  type StoredRebuyPlan,
} from '@/store/paint-consultant/rebuy-plan-storage';
import { DEMO } from '@/config';

/*
 * The kept plan of the Paint Discount Consultant in the demo (#131), so all of its states show:
 * - a paint already bought again, its old pledge left to melt (#139): the pair of the generated
 *   hangar (`generate-states.ts`), confirmed by this plan;
 * - paints melted first and left to buy again (#168): made-up pledges no longer in the hangar;
 * - filler paints bought with it (#105): the demo's marked paints, one still waiting for RSI's 24
 *   hours, one ready to melt with the sidebar's button.
 * Set once per demo hangar, never in the account's storage.
 */

/** The demo key the plan was set for. */
const seededItem = storage.defineItem<string | null>('local:demo.consultantPlanSeeded', {
  fallback: null,
});

/** The demo's kept plan for its hangar; none without the paints it needs. */
export function demoKeptPlan(
  pledges: readonly PledgeView[],
  items: readonly StoreItem[],
  fillerIds: readonly number[],
  now: number,
): StoredRebuyPlan | undefined {
  const storePaints = storePaintsOf(items);
  // The paint bought again: the consultant's own pairing, the copy with the most discount.
  const pair = findRebought(ownPaintsOf(pledges, storePaints))
    .filter((candidate) => candidate.copy.boughtOn)
    .sort((a, b) => b.copy.discount - a.copy.discount)[0];
  if (!pair) return undefined;
  const since = pair.copy.boughtOn!;
  // Melted first, left to buy: no copy of them was bought on the plan's day or later.
  const boughtSince = new Set(
    pledges
      .filter((pledge) => pledge.isPaint && (pledge.createdAt ?? '') >= since)
      .map((pledge) => storeNameOf(pledge.title)),
  );
  const melted = storePaints
    .filter(
      (paint) => paint.id !== pair.old.storePaint.id && !boughtSince.has(storeNameOf(paint.name)),
    )
    .slice(0, 2);
  return {
    version: REBUY_PLAN_VERSION,
    // Put into the cart on the day the copy was bought, so the plan confirms it.
    at: Date.parse(`${since}T00:00:00`),
    tier: { paints: 10, percent: 35 },
    own: [
      {
        pledgeId: pair.old.pledgeId,
        title: pair.old.title,
        skuId: pair.old.storePaint.id,
        meltValue: pair.old.meltValue,
      },
      ...melted.map((paint, index) => ({
        pledgeId: DEMO.idBase - 300_000 - index,
        title: `Paints - ${paint.name}`,
        skuId: paint.id,
        meltValue: Math.round(paint.price * 0.8 * 100) / 100,
      })),
    ],
    fillers: [],
    cartCost: 0,
    ...(fillerIds.length && {
      purchase: { orderId: 'DEMOFILLERS', pledgeIds: [...fillerIds], foundAt: now },
    }),
  };
}

/** Sets the demo's kept plan, once per demo key. */
export async function seedDemoPlan(key: string, plan: StoredRebuyPlan | undefined): Promise<void> {
  if ((await seededItem.getValue()) === key) return;
  await demoRebuyPlanItem.setValue(plan ?? null);
  await seededItem.setValue(key);
}

/** The kept plan set again with the next look at the demo hangar. */
export async function resetDemoPlan(): Promise<void> {
  await seededItem.removeValue();
}
