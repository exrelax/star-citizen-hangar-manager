import { describe, expect, it } from 'vitest';
import {
  COMPLETED_PLANS_KEPT,
  completedPlanOf,
  completedPlansOf,
  withCompleted,
  type CompletedPaintPlan,
} from './completed-plans';
import { REBUY_PLAN_VERSION, type StoredRebuyPlan } from './rebuy-plan-storage';

const plan: StoredRebuyPlan = {
  version: REBUY_PLAN_VERSION,
  way: 'melt',
  at: 1000,
  creditAtStart: 42,
  tier: { paints: 5, percent: 25 },
  own: [
    { pledgeId: 100, title: 'Paints - Lynx', skuId: 1, meltValue: 5, price: 5, freed: 4.8 },
    { pledgeId: 101, title: 'Paints - Polaris', skuId: 2, meltValue: 22, price: 22 },
  ],
  fillers: [{ skuId: 20, name: 'Timberline', quantity: 3, price: 3 }],
  cartCost: 27,
  purchase: { orderId: 'ORDER1', pledgeIds: [203], ownPledgeIds: [201, 202], foundAt: 1 },
};

describe('completedPlanOf', () => {
  it('keeps what was melted and bought, the result and the values before and after', () => {
    const done = completedPlanOf(plan, {
      pledges: [
        { id: 201, valueUsd: 3.75 },
        { id: 202, valueUsd: 16.5 },
      ],
      credit: 48.55,
      now: 5000,
    });
    expect(done).toMatchObject({
      way: 'melt',
      startedAt: 1000,
      completedAt: 5000,
      orderId: 'ORDER1',
      ownCount: 2,
      fillerCount: 3,
      paid: 27,
      creditBefore: 42,
      creditAfter: 48.55,
      meltBefore: 27,
      meltAfter: 20.25,
    });
    expect(done.melted.map((paint) => [paint.name, paint.count, paint.value])).toEqual([
      ['Paints - Lynx', 1, 4.8],
      ['Paints - Polaris', 1, 22],
      ['Timberline', 3, 6.75],
    ]);
    expect(done.bought.map((paint) => paint.value)).toEqual([3.75, 16.5, 6.75]);
    // $26.80 freed by the own paints − $20.25 they cost.
    expect(done.result).toBe(6.55);
    expect(done.freed).toBe(33.55);
  });

  it('works out the melt value after from the prices without the copies', () => {
    const done = completedPlanOf(plan, { pledges: [], credit: undefined, now: 1 });
    expect(done.meltAfter).toBe(20.25);
    expect(done.creditAfter).toBeUndefined();
  });
});

describe('withCompleted', () => {
  const entry = (startedAt: number): CompletedPaintPlan =>
    ({
      ...completedPlanOf(plan, { pledges: [], credit: 1, now: startedAt }),
      startedAt,
    }) as CompletedPaintPlan;

  it('adds newest first, up to the cap', () => {
    let plans: CompletedPaintPlan[] = [];
    for (let i = 1; i <= COMPLETED_PLANS_KEPT + 3; i++) plans = withCompleted(plans, entry(i));
    expect(plans).toHaveLength(COMPLETED_PLANS_KEPT);
    expect(plans[0]!.startedAt).toBe(COMPLETED_PLANS_KEPT + 3);
  });

  it("doesn't add a plan another tab kept already", () => {
    const plans = withCompleted([], entry(7));
    expect(withCompleted(plans, entry(7))).toBe(plans);
  });

  it('reads only the current version', () => {
    expect(completedPlansOf({ version: 1, plans: [entry(1)] })).toHaveLength(1);
    expect(completedPlansOf({ version: 0, plans: [entry(1)] })).toEqual([]);
    expect(completedPlansOf(null)).toEqual([]);
  });
});
