import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { StoreItem } from '../items/store-items';
import {
  currentPlanOf,
  inferredWay,
  rebuyPlanItem,
  REBUY_PLAN_VERSION,
  updatePlan,
  type StoredRebuyPlanV1,
} from './rebuy-plan-storage';

beforeEach(() => fakeBrowser.reset());

const PLAN_AT = new Date(2026, 10, 9, 10, 0).getTime();
const v1: StoredRebuyPlanV1 = {
  version: 1,
  at: PLAN_AT,
  tier: { paints: 5, percent: 25 },
  own: [
    { pledgeId: 100, title: 'Paints - Lynx - Moonrise Paint', skuId: 1, meltValue: 5 },
    { pledgeId: 101, title: 'Paints - Polaris - Quasar Paint', skuId: 2, meltValue: 22 },
  ],
  fillers: [{ skuId: 20, name: 'Cheap', quantity: 3, price: 3 }],
  cartCost: 27,
  purchase: { orderId: 'O', pledgeIds: [203], foundAt: PLAN_AT, notifiedAt: 5 },
};
const pledge = (id: number, title: string, createdAt = '2025-01-01') => ({ id, title, createdAt });
const storeItems = [{ id: 1, name: 'Lynx - Moonrise Paint', price: 5 }] as StoreItem[];

describe('inferredWay (plans kept before #245)', () => {
  it('is "melt first" when an own paint is gone without a copy since the plan', () => {
    expect(inferredWay(v1, [pledge(100, v1.own[0]!.title)])).toBe('melt');
  });

  it('is "buy first" when the own paints are there, or gone with a copy', () => {
    const both = [pledge(100, v1.own[0]!.title), pledge(101, v1.own[1]!.title)];
    expect(inferredWay(v1, both)).toBe('buy');
    const copy = [pledge(100, v1.own[0]!.title), pledge(300, v1.own[1]!.title, '2026-11-09')];
    expect(inferredWay(v1, copy)).toBe('buy');
  });
});

describe('currentPlanOf', () => {
  it('upgrades version 1, keeping its purchase for the notifications', () => {
    const plan = currentPlanOf(v1, [], storeItems)!;
    expect(plan).toMatchObject({ version: REBUY_PLAN_VERSION, way: 'melt', migratedFrom: 1 });
    expect(plan.own[0]).toMatchObject({ pledgeId: 100, price: 5 });
    expect(plan.own[1]!.price).toBeUndefined();
    expect(plan.purchase).toEqual(v1.purchase);
    expect(plan.creditAtStart).toBeUndefined();
    // Without the hangar: the safe default.
    expect(currentPlanOf(v1)!.way).toBe('buy');
  });

  it('keeps the current version as it is, and ignores anything else', () => {
    const plan = currentPlanOf(v1)!;
    expect(currentPlanOf(plan)).toBe(plan);
    expect(currentPlanOf(null)).toBeUndefined();
    expect(currentPlanOf({ ...v1, version: 9 })).toBeUndefined();
    expect(currentPlanOf({ version: 2 })).toBeUndefined();
  });
});

describe('updatePlan', () => {
  it('writes a plan of version 1 back upgraded, and nothing without a plan', async () => {
    await rebuyPlanItem.setValue(v1);
    await updatePlan(rebuyPlanItem, (plan) => plan, []);
    expect(await rebuyPlanItem.getValue()).toMatchObject({ version: 2, way: 'melt' });

    await rebuyPlanItem.setValue(null);
    expect(await updatePlan(rebuyPlanItem, () => null)).toBeUndefined();
  });

  it("doesn't write an unchanged plan", async () => {
    const plan = currentPlanOf(v1)!;
    await rebuyPlanItem.setValue(plan);
    let writes = 0;
    const unwatch = rebuyPlanItem.watch(() => writes++);
    await updatePlan(rebuyPlanItem, (current) => current);
    unwatch();
    expect(writes).toBe(0);
  });
});
