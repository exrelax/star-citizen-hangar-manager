import { describe, expect, it } from 'vitest';
import type { Rebuy, RebuyItem } from './rebuyable';
import { rebuyWatchPlan } from './rebuy-watchlist';

const paint: RebuyItem = { kind: 'storePaint', skuId: 7, name: 'Dusk Paint', price: 10 };
const ship: RebuyItem = {
  kind: 'storeShip',
  shipId: 2,
  insurance: 'lti',
  skuId: 21,
  name: 'Cutlass Black - LTI',
  price: 110,
};
const ccu: RebuyItem = {
  kind: 'storeCcu',
  fromShipId: 1,
  toShipId: 2,
  fromName: 'Aurora',
  toName: 'Cutlass Black',
  price: 85,
};

const rebuy = (pledgeId: number, item: RebuyItem | undefined, rebuyable = true): Rebuy => ({
  pledgeId,
  rebuyable,
  reasons: rebuyable ? [] : [{ code: 'giftable' }],
  freedCredit: item ? item.price + 1 : 20,
  ...(item && { rebuyPrice: item.price, item }),
});
const rebuys = new Map(
  [
    rebuy(1, paint),
    rebuy(2, paint),
    rebuy(3, ship),
    rebuy(4, ccu),
    rebuy(5, paint, false),
    rebuy(6, undefined),
  ].map((entry) => [entry.pledgeId, entry]),
);
const ccuName = (from: string, to: string) => `Upgrade - ${from} to ${to}`;

describe('pledges on a watchlist to rebuy (#531)', () => {
  it('puts each rebuyable pledge on it as its store item, several of one as its count', () => {
    const plan = rebuyWatchPlan([1, 3, 2, 4], rebuys, ccuName)!;
    expect(plan.items).toEqual([
      { kind: 'storePaint', skuId: 7, name: 'Dusk Paint', value: 10, count: 2 },
      {
        kind: 'storeShip',
        shipId: 2,
        insurance: 'lti',
        name: 'Cutlass Black - LTI',
        value: 110,
        count: 1,
      },
      {
        kind: 'storeCcu',
        fromShipId: 1,
        toShipId: 2,
        name: 'Upgrade - Aurora to Cutlass Black',
        value: 85,
        count: 1,
      },
    ]);
    expect(plan.pledgeIds).toEqual([1, 3, 2, 4]);
    expect(plan.skipped).toBe(0);
    // 10 + 110 + 10 + 85, and each frees $1 more than it costs here.
    expect(plan.total).toBe(215);
    expect(plan.freedCredit).toBe(219);
  });

  it('leaves out and counts pledges not rebuyable, without a store item or unknown', () => {
    const plan = rebuyWatchPlan([1, 5, 6, 99], rebuys, ccuName)!;
    expect(plan.items.map((item) => item.count)).toEqual([1]);
    expect(plan.pledgeIds).toEqual([1]);
    expect(plan.skipped).toBe(3);
    expect(plan.total).toBe(10);
  });

  it('is none while not one of them can be rebought', () => {
    expect(rebuyWatchPlan([5, 6], rebuys, ccuName)).toBeUndefined();
    expect(rebuyWatchPlan([], rebuys, ccuName)).toBeUndefined();
  });

  it('keeps a ship without an insurance apart from one with it', () => {
    const plain: RebuyItem = { ...ship, insurance: undefined };
    delete (plain as { insurance?: unknown }).insurance;
    const map = new Map([
      [1, rebuy(1, ship)],
      [2, rebuy(2, plain)],
    ]);
    const plan = rebuyWatchPlan([1, 2], map, ccuName)!;
    expect(plan.items.map((item) => item.kind === 'storeShip' && item.insurance)).toEqual([
      'lti',
      undefined,
    ]);
  });
});
