import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { meltMarksItem } from '@/hangar/melt-marks';
import type { OrdersSnapshot } from '@/orders/orders';
import type { StoreItem } from '../items/store-items';
import type { PaintPledge } from './calculation';
import {
  COMPLETED_PLANS_VERSION,
  completedPlanOf,
  completedPlansItem,
  completedPlansOf,
  withCompleted,
} from './completed-plans';
import {
  findPlanPurchase,
  isFillerCheckOver,
  isPurchaseCheckOpen,
  withFillerMarks,
  type HangarPledge,
} from './filler-purchase';
import {
  currentPlanOf,
  rebuyPlanItem,
  REBUY_PLAN_VERSION,
  type PlanPurchase,
} from './rebuy-plan-storage';
import { planProgress, withSeenGone } from './running-plan';

/*
 * Keeps the running plan of the Paint Discount Consultant up to date with the real hangar and
 * orders (#105, #245), in the content script whenever they or the Pledge Store items change –
 * never in the demo. A plan kept before #245 is written back in the current format; the order that
 * bought the plan is looked for, and once found its filler paints are marked to melt; pledges of
 * the plan gone from the hangar are noted; after `fillerCheckDays` without the order the plan can
 * be given up. Once nothing is left, the plan is kept with the completed ones and goes. Several
 * tabs may do this at once: every write reads the plan right before.
 */

type CheckedPledge = HangarPledge & Pick<PaintPledge, 'valueUsd'>;

export async function checkRunningPlan(input: {
  pledges: readonly CheckedPledge[];
  orders: OrdersSnapshot | null | undefined;
  storeItems: readonly StoreItem[];
  now?: number;
}): Promise<PlanPurchase | undefined> {
  const now = input.now ?? Date.now();
  const stored = await rebuyPlanItem.getValue();
  const kept = currentPlanOf(stored, input.pledges, input.storeItems);
  if (!kept) return undefined;
  let plan = kept;

  let found: PlanPurchase | undefined;
  if (isPurchaseCheckOpen(plan)) {
    found = findPlanPurchase({ ...input, plan, now });
    if (found) {
      if (found.pledgeIds.length) {
        await meltMarksItem.setValue(withFillerMarks(await meltMarksItem.getValue(), found, now));
      }
      plan = { ...plan, purchase: found };
    } else if (plan.checkEndedAt === undefined && isFillerCheckOver(plan, now)) {
      plan = { ...plan, checkEndedAt: now };
    }
  }
  plan = withSeenGone(plan, input.pledges, now);

  const pledges = input.pledges;
  if (planProgress(plan, pledges, input.storeItems).complete) {
    const credit = await storeCreditItem.getValue();
    const amount =
      credit?.version === STORE_CREDIT_VERSION && credit.credit.currency === 'USD'
        ? credit.credit.amount
        : undefined;
    const completed = completedPlanOf(plan, {
      pledges,
      storeItems: input.storeItems,
      credit: amount,
      now,
    });
    const history = await completedPlansItem.getValue();
    const plans = completedPlansOf(history);
    const next = withCompleted(plans, completed);
    if (next !== plans)
      await completedPlansItem.setValue({ version: COMPLETED_PLANS_VERSION, plans: next });
    // Only the plan seen ending goes: another tab may have started a new one meanwhile.
    const current = await rebuyPlanItem.getValue();
    if (current?.at === plan.at) await rebuyPlanItem.setValue(null);
    return found;
  }
  if (plan !== stored) {
    // Another tab may have recorded something meanwhile: only the facts of this check are added.
    const current = currentPlanOf(await rebuyPlanItem.getValue(), input.pledges, input.storeItems);
    if (current?.at !== plan.at) return found;
    const merged = withSeenGone(
      {
        ...current,
        ...(!current.purchase && plan.purchase && { purchase: plan.purchase }),
        ...(current.checkEndedAt === undefined &&
          plan.checkEndedAt !== undefined && { checkEndedAt: plan.checkEndedAt }),
      },
      input.pledges,
      now,
    );
    await rebuyPlanItem.setValue({ ...merged, version: REBUY_PLAN_VERSION });
  }
  return found;
}
