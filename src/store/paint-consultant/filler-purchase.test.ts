import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { meltMarksItem } from '@/hangar/melt-marks';
import { ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import type { StoreItem } from '../items/store-items';
import type { PaintPledge } from './calculation';
import {
  checkFillerPurchase,
  findFillerPurchase,
  isFillerCheckOpen,
  withFillerMarks,
} from './filler-purchase';
import { REBUY_PLAN_VERSION, rebuyPlanItem, type StoredRebuyPlan } from './rebuy-plan-storage';

beforeEach(() => fakeBrowser.reset());

const item = (id: number, name: string, price: number): StoreItem => ({
  id,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
});
const storeItems = [
  item(1, 'Lynx - Moonrise Paint', 5),
  item(20, '100 Series - Timberline Paint', 3),
  item(21, 'Arrow - Light Green and Grey Paint', 3),
];

const PLAN_AT = new Date(2026, 10, 9, 10, 0).getTime();
const plan: StoredRebuyPlan = {
  version: REBUY_PLAN_VERSION,
  at: PLAN_AT,
  tier: { paints: 5, percent: 25 },
  own: [{ pledgeId: 100, title: 'Paints - Lynx - Moonrise Paint', skuId: 1, meltValue: 5 }],
  fillers: [
    { skuId: 20, name: '100 Series - Timberline Paint', quantity: 2, price: 3 },
    { skuId: 21, name: 'Arrow - Light Green and Grey Paint', quantity: 1, price: 3 },
  ],
  cartCost: 6.75,
};

const paint = (id: number, name: string, createdAt = '2026-11-09'): PaintPledge => ({
  id,
  title: `Paints - ${name}`,
  valueUsd: 3,
  isMeltable: true,
  isGiftable: false,
  items: [{ title: name, kind: 'Skin' }],
  createdAt,
});

/** The hangar after buying: the old Lynx, an older Timberline and the new pledges of one order. */
const pledges = [
  paint(100, 'Lynx - Moonrise Paint', '2025-01-01'),
  paint(50, '100 Series - Timberline Paint', '2025-06-01'),
  paint(201, 'Lynx - Moonrise Paint'),
  paint(202, '100 Series - Timberline Paint'),
  paint(203, '100 Series - Timberline Paint'),
  paint(204, 'Arrow - Light Green and Grey Paint'),
];

function ordersOf(amount = '$0.00 USD', createdAt = '2026-11-09T11:30'): OrdersSnapshot {
  const link = { orderId: 'ORDER1', buyback: false, createdAt };
  return {
    version: ORDERS_SNAPSHOT_VERSION,
    syncedAt: '2026-11-09T12:00:00Z',
    pledgeOrders: {
      50: { orderId: 'OLD', buyback: false, createdAt: '2025-06-01T09:00' },
      201: link,
      202: link,
      203: link,
      204: link,
    },
    orders: {
      ORDER1: { id: 'ORDER1', amount, placedAt: '2026-11-09' },
      OLD: { id: 'OLD', amount: '$3.00 USD', placedAt: '2025-06-01' },
    },
    recentLogEntries: [],
  };
}

const NOW = PLAN_AT + 3 * 60 * 60 * 1000;

describe('findFillerPurchase', () => {
  it("finds the plan's order and only the filler pledges it created", () => {
    const purchase = findFillerPurchase({
      plan,
      pledges,
      orders: ordersOf(),
      storeItems,
      now: NOW,
    });
    expect(purchase).toEqual({
      orderId: 'ORDER1',
      boughtAt: '2026-11-09T11:30',
      // Not the older Timberline (50), not the own paint bought again (201).
      pledgeIds: [202, 203, 204],
      foundAt: NOW,
    });
  });

  it('ignores an order paid with money', () => {
    const orders = ordersOf('$8.93 USD');
    expect(findFillerPurchase({ plan, pledges, orders, storeItems, now: NOW })).toBeUndefined();
  });

  it('ignores orders before the plan was made', () => {
    const orders = ordersOf('$0.00 USD', '2026-11-08T23:00');
    const before = pledges.map((pledge) => ({ ...pledge, createdAt: '2026-11-08' }));
    expect(
      findFillerPurchase({ plan, pledges: before, orders, storeItems, now: NOW }),
    ).toBeUndefined();
  });

  it('needs a paint of the plan of its own in the order', () => {
    const fillersOnly = pledges.filter((pledge) => pledge.id !== 201);
    expect(
      findFillerPurchase({ plan, pledges: fillersOnly, orders: ordersOf(), storeItems, now: NOW }),
    ).toBeUndefined();
  });

  it('takes no more fillers of a paint than the plan bought', () => {
    const one = { ...plan, fillers: [{ ...plan.fillers[0]!, quantity: 1 }] };
    const purchase = findFillerPurchase({
      plan: one,
      pledges,
      orders: ordersOf(),
      storeItems,
      now: NOW,
    });
    // The youngest pledge of it.
    expect(purchase?.pledgeIds).toEqual([203]);
  });
});

describe('withFillerMarks', () => {
  it('marks the fillers, keeping the time of those marked already', () => {
    const purchase = { orderId: 'O', pledgeIds: [1, 2], foundAt: 0 };
    expect(withFillerMarks({ 2: 5 }, purchase, 9)).toEqual({ 1: 9, 2: 5 });
    const marks = { 1: 1, 2: 2 };
    expect(withFillerMarks(marks, purchase, 9)).toBe(marks);
  });
});

describe('checkFillerPurchase', () => {
  it('keeps the purchase with the plan and marks the fillers to melt', async () => {
    await rebuyPlanItem.setValue(plan);
    await checkFillerPurchase({ pledges, orders: ordersOf(), storeItems, now: NOW });
    const kept = await rebuyPlanItem.getValue();
    expect(kept?.purchase?.pledgeIds).toEqual([202, 203, 204]);
    expect(await meltMarksItem.getValue()).toEqual({ 202: NOW, 203: NOW, 204: NOW });
    expect(isFillerCheckOpen(kept)).toBe(false);
  });

  it('stops looking after a few days without an order, but keeps the plan', async () => {
    await rebuyPlanItem.setValue(plan);
    const later = PLAN_AT + 8 * 24 * 60 * 60 * 1000;
    await checkFillerPurchase({ pledges: [], orders: ordersOf(), storeItems, now: later });
    const kept = await rebuyPlanItem.getValue();
    expect(kept?.checkEndedAt).toBe(later);
    expect(kept?.own).toEqual(plan.own);
    expect(await meltMarksItem.getValue()).toEqual({});
  });
});
