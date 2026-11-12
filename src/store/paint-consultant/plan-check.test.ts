import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { meltMarksItem } from '@/hangar/melt-marks';
import { ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import type { StoreItem } from '../items/store-items';
import type { PaintPledge } from './calculation';
import { completedPlansItem } from './completed-plans';
import { checkRunningPlan } from './plan-check';
import {
  currentPlanOf,
  rebuyPlanItem,
  REBUY_PLAN_VERSION,
  type StoredRebuyPlan,
} from './rebuy-plan-storage';

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
  way: 'buy',
  at: PLAN_AT,
  creditAtStart: 10,
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

const OLD = paint(100, 'Lynx - Moonrise Paint', '2025-01-01');
const COPY = paint(201, 'Lynx - Moonrise Paint');
const FILLERS = [
  paint(202, '100 Series - Timberline Paint'),
  paint(203, '100 Series - Timberline Paint'),
  paint(204, 'Arrow - Light Green and Grey Paint'),
];

function ordersOf(): OrdersSnapshot {
  const link = { orderId: 'ORDER1', buyback: false, createdAt: '2026-11-09T11:30' };
  return {
    version: ORDERS_SNAPSHOT_VERSION,
    syncedAt: '2026-11-09T12:00:00Z',
    pledgeOrders: { 201: link, 202: link, 203: link, 204: link },
    orders: { ORDER1: { id: 'ORDER1', amount: '$0.00 USD', placedAt: '2026-11-09' } },
    recentLogEntries: [],
  };
}

const NOW = PLAN_AT + 3 * 60 * 60 * 1000;
const orders = ordersOf();

describe('checkRunningPlan', () => {
  it('keeps the purchase with the plan and marks the fillers to melt', async () => {
    await rebuyPlanItem.setValue(plan);
    await checkRunningPlan({ pledges: [OLD, COPY, ...FILLERS], orders, storeItems, now: NOW });
    const kept = currentPlanOf(await rebuyPlanItem.getValue());
    expect(kept?.purchase).toMatchObject({ pledgeIds: [202, 203, 204], ownPledgeIds: [201] });
    expect(await meltMarksItem.getValue()).toEqual({ 202: NOW, 203: NOW, 204: NOW });
  });

  it('may give up after a few days without an order, but keeps the plan', async () => {
    await rebuyPlanItem.setValue(plan);
    const later = PLAN_AT + 8 * 24 * 60 * 60 * 1000;
    await checkRunningPlan({ pledges: [OLD], orders, storeItems, now: later });
    const kept = currentPlanOf(await rebuyPlanItem.getValue());
    expect(kept?.checkEndedAt).toBe(later);
    expect(kept?.own[0]?.pledgeId).toBe(100);
    expect(await meltMarksItem.getValue()).toEqual({});
  });

  it('notes the paints gone from the hangar', async () => {
    await rebuyPlanItem.setValue({ ...plan, way: 'melt' });
    await checkRunningPlan({ pledges: [], orders, storeItems, now: NOW });
    const kept = currentPlanOf(await rebuyPlanItem.getValue());
    expect(kept?.own[0]).toMatchObject({ meltedAt: NOW, seenGone: true });
  });

  it('writes a plan kept before #245 back in the current format', async () => {
    const v1: Partial<StoredRebuyPlan> = { ...plan };
    delete v1.way;
    delete v1.creditAtStart;
    Object.assign(v1, { version: 1 });
    await rebuyPlanItem.setValue(v1 as never);
    await checkRunningPlan({ pledges: [OLD], orders: undefined, storeItems, now: NOW });
    expect(await rebuyPlanItem.getValue()).toMatchObject({
      version: REBUY_PLAN_VERSION,
      way: 'buy',
      migratedFrom: 1,
    });
  });

  it('keeps a finished plan with the completed ones and ends it', async () => {
    await storeCreditItem.setValue({
      version: STORE_CREDIT_VERSION,
      credit: { amount: 11.25, currency: 'USD' },
    } as never);
    await rebuyPlanItem.setValue({
      ...plan,
      purchase: {
        orderId: 'ORDER1',
        pledgeIds: [202, 203, 204],
        ownPledgeIds: [201],
        skus: { 201: 1, 202: 20, 203: 20, 204: 21 },
        foundAt: NOW,
      },
    });
    // The old pledge and the fillers melted, the copy is left.
    await checkRunningPlan({ pledges: [COPY], orders, storeItems, now: NOW });
    await checkRunningPlan({ pledges: [COPY], orders, storeItems, now: NOW + 1 });
    expect(await rebuyPlanItem.getValue()).toBeNull();
    const history = await completedPlansItem.getValue();
    expect(history?.plans).toHaveLength(1);
    expect(history?.plans[0]).toMatchObject({
      way: 'buy',
      orderId: 'ORDER1',
      creditBefore: 10,
      creditAfter: 11.25,
      meltAfter: 3,
    });
  });
});
