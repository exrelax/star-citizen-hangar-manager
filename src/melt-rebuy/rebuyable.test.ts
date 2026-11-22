import { describe, expect, it } from 'vitest';
import type { PledgeView } from '@/hangar/pledge-view';
import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { Ship, ShipSku } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import {
  createRebuyJudge,
  freedCreditOf,
  insuranceOfName,
  rebuyables,
  type RebuyContext,
  type RebuyPledge,
  type RebuyReasonCode,
} from './rebuyable';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const TODAY = '2026-11-22';

const ships: Ship[] = [
  { id: 1, name: 'Aurora MR', msrp: 25 },
  { id: 2, name: 'Avenger Titan', msrp: 55 },
  { id: 3, name: 'Cutlass Black', msrp: 110 },
  { id: 4, name: 'Carrack', msrp: 600 },
  { id: 5, name: 'Polaris', msrp: 975 },
  { id: 6, name: 'Perseus', msrp: 950 },
];
const buyable: ShipSku[] = [
  { shipId: 2, skuId: 20, title: 'Standard Edition', price: 55 },
  { shipId: 3, skuId: 30, title: 'Standard Edition', price: 110 },
  { shipId: 4, skuId: 40, title: 'Standard Edition', price: 600 },
  { shipId: 6, skuId: 60, title: 'Standard Edition', price: 950 },
  // The Polaris only as a warbond edition.
  { shipId: 5, skuId: 51, title: 'Warbond Edition', price: 900 },
];
const warbonds = [{ shipId: 5, skuId: 51, price: 900 }];

const storeItem = (
  id: number,
  name: string,
  price: number,
  overrides: Partial<StoreItem> = {},
): StoreItem => ({
  id,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
  ...overrides,
});
const standalone = { category: 'Standalone Ships' };
const items: StoreItem[] = [
  storeItem(100, 'Cutlass - Black Cherry Paint', 10),
  storeItem(101, 'Carrack - Ghost Paint', 20, { available: false }),
  storeItem(102, 'Polaris - Warbond Paint', 30, { isWarbond: true }),
  storeItem(200, 'Avenger Titan - 10 Year', 55, standalone),
  storeItem(201, 'Aurora MR - LTI', 25, standalone),
  storeItem(202, 'Cutlass Black', 110, standalone),
  storeItem(203, 'Carrack - 6 Month', 600, standalone),
  storeItem(204, 'Carrack - 120 Month Insurance', 620, standalone),
];

const alwaysAvailable = new Map([
  [1, true],
  [2, true],
  [3, true],
  [4, true],
  [5, false],
  [6, true],
]);

const context = (overrides: Partial<RebuyContext> = {}): RebuyContext => ({
  catalog: { ships, buyable, warbonds, items },
  alwaysAvailable: (id) => alwaysAvailable.get(id),
  removals: new Map(),
  purchases: new Map(),
  now: NOW,
  today: TODAY,
  ...overrides,
});

const base = (overrides: Partial<PledgeView>): RebuyPledge =>
  ({
    id: 1,
    title: 'Test',
    valueUsd: 10,
    createdAt: '2026-10-01',
    protectedGames: [],
    isPaint: false,
    isCcu: false,
    hasGameAccess: false,
    isGamePackage: false,
    isGiftable: false,
    isMeltable: true,
    isUpgraded: false,
    items: [],
    ...overrides,
  }) as RebuyPledge;

const paint = (overrides: Partial<PledgeView> = {}) =>
  base({
    title: 'Paints - Cutlass - Black Cherry Paint',
    valueUsd: 10,
    isPaint: true,
    items: [{ title: 'Cutlass - Black Cherry Paint', kind: 'Skin' }],
    ...overrides,
  });

const titan = (overrides: Partial<PledgeView> = {}) =>
  base({
    id: 2,
    title: 'Standalone Ships - Avenger Titan - 10 Year',
    valueUsd: 55,
    insurance: { lifetime: false, months: 120 },
    items: [
      { title: 'Avenger Titan', kind: 'Ship' },
      { title: '120 Month Insurance', kind: 'Insurance' },
    ],
    ...overrides,
  });

const ccu = (from: string, to: string, value: number, overrides: Partial<PledgeView> = {}) =>
  base({
    id: 3,
    title: `Upgrade - ${from} to ${to} Standard Edition`,
    valueUsd: value,
    isCcu: true,
    upgrade: {
      matchItems: [{ id: 11, name: from }],
      targetItems: [{ id: 12, name: to }],
      type: 'R',
    },
    ...overrides,
  });

const judge = (pledge: RebuyPledge, overrides: Partial<RebuyContext> = {}) =>
  createRebuyJudge(context(overrides))(pledge);
const codes = (pledge: RebuyPledge, overrides: Partial<RebuyContext> = {}): RebuyReasonCode[] =>
  judge(pledge, overrides).reasons.map((reason) => reason.code);

const increase = (id: number, name: string, confirmed = false): ExpectedPriceIncrease => ({
  ship: { id, name },
  priceIncreaseAt: { at: NOW + 10 * DAY },
  ...(confirmed && { confirmed: true }),
});
const removal = (id: number, name: string): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at: NOW + 5 * DAY, dayOnly: true },
  source: 'https://example.com',
});

describe('rebuyable pledges (#528)', () => {
  it('rebuys a single paint for its store price', () => {
    expect(judge(paint())).toEqual({
      pledgeId: 1,
      rebuyable: true,
      reasons: [],
      freedCredit: 10,
      rebuyPrice: 10,
      item: { kind: 'storePaint', skuId: 100, name: 'Cutlass - Black Cherry Paint', price: 10 },
    });
  });

  it('rebuys a solo ship with the insurance the store item names', () => {
    expect(judge(titan())).toEqual({
      pledgeId: 2,
      rebuyable: true,
      reasons: [],
      freedCredit: 55,
      rebuyPrice: 55,
      item: {
        kind: 'storeShip',
        shipId: 2,
        insurance: 120,
        skuId: 200,
        name: 'Avenger Titan - 10 Year',
        price: 55,
      },
    });
  });

  it('rebuys a CCU of the upgrade tool for the msrp difference', () => {
    expect(judge(ccu('Cutlass Black', 'Carrack', 490))).toEqual({
      pledgeId: 3,
      rebuyable: true,
      reasons: [],
      freedCredit: 490,
      rebuyPrice: 490,
      item: {
        kind: 'storeCcu',
        fromShipId: 3,
        toShipId: 4,
        fromName: 'Cutlass Black',
        toName: 'Carrack',
        price: 490,
      },
    });
  });

  it('rebuys a pledge worth more than today’s price', () => {
    const result = judge(paint({ valueUsd: 12 }));
    expect(result.rebuyable).toBe(true);
    expect(result).toMatchObject({ freedCredit: 12, rebuyPrice: 10 });
  });

  it('builds the result of every pledge by its id', () => {
    const result = rebuyables([paint(), titan(), ccu('Cutlass Black', 'Carrack', 490)], context());
    expect([...result.keys()]).toEqual([1, 2, 3]);
    expect(freedCreditOf(result.values())).toBe(555);
  });

  it('adds up only the rebuyable ones', () => {
    const result = rebuyables([paint(), titan({ isGiftable: true })], context());
    expect(freedCreditOf(result.values())).toBe(10);
  });

  describe('meltable now', () => {
    it('not with protected game access', () => {
      expect(codes(titan({ protectedGames: ['SC'], isMeltable: false }))).toEqual(['protected']);
    });

    it('not a reward', () => {
      expect(codes(paint({ reward: 'event', valueUsd: 0, isMeltable: false }))).toEqual([
        'reward',
        'discount',
      ]);
    });

    it('not without RSI’s exchange', () => {
      expect(codes(paint({ isMeltable: false }))).toEqual(['notMeltable']);
    });

    it('not within 24 hours of the purchase, by the pledge log’s time', () => {
      const at = '2026-11-22T02:00';
      const purchases = new Map([[1, { on: '2026-11-22', at }]]);
      const result = judge(paint({ createdAt: '2026-11-22' }), { purchases });
      expect(result.reasons).toEqual([
        { code: 'tooRecent', meltableAt: expect.any(Number) as number },
      ]);
      const reason = result.reasons[0] as { meltableAt: number };
      expect(reason.meltableAt).toBeGreaterThan(NOW);
    });

    it('a day after the purchase', () => {
      const purchases = new Map([[1, { on: '2026-11-20', at: '2026-11-20T10:00' }]]);
      expect(codes(paint({ createdAt: '2026-11-20' }), { purchases })).toEqual([]);
    });

    it('by the list’s date without the pledge log', () => {
      expect(codes(paint({ createdAt: '2026-11-22' }))).toEqual(['tooRecent']);
      expect(codes(paint({ createdAt: '2026-11-20' }))).toEqual([]);
    });

    it('says "too recent" instead of "not meltable" while RSI waits', () => {
      expect(codes(paint({ createdAt: '2026-11-22', isMeltable: false }))).toEqual(['tooRecent']);
    });
  });

  it('not giftable', () => {
    expect(codes(titan({ isGiftable: true }))).toEqual(['giftable']);
  });

  it('not in the refund period of a purchase with money', () => {
    const order = { id: 'X', amount: '$55.00 USD', placedAt: '2026-11-10', buyback: false };
    const result = judge(titan({ order }));
    expect(result.reasons).toEqual([{ code: 'refundPeriod', daysLeft: 18, until: '2026-12-10' }]);
    const old = { ...order, placedAt: '2026-09-01' };
    expect(codes(titan({ order: old }))).toEqual([]);
  });

  describe('one plain item', () => {
    it('not a package with game access', () => {
      const items = [
        { title: 'Avenger Titan', kind: 'Ship' },
        { title: 'Star Citizen Digital Download', kind: 'Download' },
      ];
      expect(codes(titan({ hasGameAccess: true, isGamePackage: true, items }))).toEqual([
        'package',
      ]);
    });

    it('not a ship pack', () => {
      const items = [
        { title: 'Avenger Titan', kind: 'Ship' },
        { title: 'Cutlass Black', kind: 'Ship' },
      ];
      expect(codes(titan({ items, title: 'Packs - Duo' }))).toEqual(['pack']);
    });

    it('not upgraded', () => {
      expect(codes(titan({ isUpgraded: true }))).toEqual(['upgraded']);
    });

    it('not a ship with extra items', () => {
      const items = [
        { title: 'Avenger Titan', kind: 'Ship' },
        { title: 'Avenger - Stormbringer Paint', kind: 'Skin' },
        { title: 'Takuetsu Aegis Model', kind: 'Hangar decoration' },
      ];
      expect(codes(titan({ items }))).toEqual(['extraItems']);
    });

    it('a ship with what comes with it', () => {
      const items = [
        { title: 'Avenger Titan', kind: 'Ship' },
        { title: '120 Month Insurance', kind: 'Insurance' },
        { title: 'Aegis Poster', kind: 'Hangar decoration' },
      ];
      expect(codes(titan({ items }))).toEqual([]);
    });

    it('not several paints', () => {
      const items = [
        { title: 'Cutlass - Black Cherry Paint', kind: 'Skin' },
        { title: 'Carrack - Ghost Paint', kind: 'Skin' },
      ];
      expect(codes(paint({ items, title: 'Paints - Pack' }))).toEqual(['extraItems']);
    });

    it('not a CCU with extras', () => {
      const upgrade = {
        matchItems: [{ id: 11, name: 'Cutlass Black' }],
        targetItems: [
          { id: 12, name: 'Carrack' },
          { id: 13, name: 'Carrack - Best in Show Paint' },
        ],
        type: 'R',
      };
      expect(codes(ccu('Cutlass Black', 'Carrack', 490, { upgrade }))).toEqual(['extraItems']);
    });

    it('not gear or other items', () => {
      const gear = base({ title: 'Gear - Helmet', items: [{ title: 'ORC-mkX Helmet' }] });
      expect(codes(gear)).toEqual(['otherKind']);
    });
  });

  describe('on sale now as exactly this item', () => {
    it('not a paint the store doesn’t sell', () => {
      const items = [{ title: 'Hull C - Event Paint', kind: 'Skin' }];
      const result = judge(paint({ title: 'Paints - Hull C - Event Paint', items }));
      expect(result.reasons).toEqual([{ code: 'notOnSale' }]);
      expect(result.rebuyPrice).toBeUndefined();
      expect(result.item).toBeUndefined();
    });

    it('not a paint out of stock or only as warbond', () => {
      const ghost = [{ title: 'Carrack - Ghost Paint', kind: 'Skin' }];
      expect(codes(paint({ title: 'Paints - Carrack - Ghost Paint', items: ghost }))).toEqual([
        'notOnSale',
      ]);
      const warbond = [{ title: 'Polaris - Warbond Paint', kind: 'Skin' }];
      expect(codes(paint({ title: 'Paints - Polaris - Warbond Paint', items: warbond }))).toEqual([
        'notOnSale',
      ]);
    });

    it('not a ship without a standalone item in the store', () => {
      const items = [{ title: 'Perseus', kind: 'Ship' }];
      expect(
        codes(titan({ title: 'Standalone Ships - Perseus', items, insurance: undefined })),
      ).toEqual(['notOnSale']);
    });

    it('finds a ship’s item by the ship, whatever the pledge’s title', () => {
      const result = judge(titan({ title: 'Avenger Titan - Warbond' }));
      expect(result.rebuyable).toBe(true);
      expect(result.item).toMatchObject({ kind: 'storeShip', skuId: 200 });
    });

    it('not a CCU whose target isn’t on sale as standard edition', () => {
      const result = judge(ccu('Carrack', 'Polaris', 375));
      expect(result.reasons).toEqual([
        { code: 'notOnSale' },
        { code: 'notAlwaysAvailable', ship: 'Polaris' },
      ]);
      // Its price is known all the same.
      expect(result.rebuyPrice).toBe(375);
    });

    it('not a CCU whose base costs as much as its target or more', () => {
      const result = judge(ccu('Polaris', 'Perseus', 50));
      expect(result.reasons).toEqual([{ code: 'notOnSale' }]);
      expect(result.item).toBeUndefined();
    });
  });

  describe('same price or less', () => {
    it('not a discounted ship', () => {
      expect(judge(titan({ valueUsd: 45 })).reasons).toEqual([
        { code: 'discount', amount: 10, percent: (10 / 55) * 100, price: 55 },
      ]);
    });

    it('not a warbond CCU', () => {
      expect(judge(ccu('Cutlass Black', 'Carrack', 440)).reasons).toEqual([
        { code: 'discount', amount: 50, percent: (50 / 490) * 100, price: 490 },
      ]);
    });

    it('not a paint with a volume discount, rounded to its tier', () => {
      expect(judge(paint({ valueUsd: 7.51 })).reasons).toEqual([
        { code: 'paintVolumeDiscount', amount: 2.49, percent: 25, price: 10 },
      ]);
    });

    it('not a paint on sale apart from the tiers', () => {
      expect(codes(paint({ valueUsd: 9 }))).toEqual(['discount']);
    });

    it('ignores less than a cent', () => {
      expect(codes(paint({ valueUsd: 9.996 }))).toEqual([]);
    });
  });

  describe('same insurance or better', () => {
    const carrack = (months: number | 'lti', title = 'Standalone Ships - Carrack') =>
      titan({
        title,
        valueUsd: 600,
        insurance: months === 'lti' ? { lifetime: true } : { lifetime: false, months },
        items: [{ title: 'Carrack', kind: 'Ship' }],
      });

    it('takes the cheapest item with the insurance or a better one', () => {
      const result = judge(carrack(6));
      expect(result.rebuyable).toBe(true);
      expect(result.item).toMatchObject({ skuId: 203, insurance: 6, price: 600 });
      const better = judge(carrack(24));
      expect(better.item).toMatchObject({ skuId: 204, insurance: 120, price: 620 });
      // The better insurance costs more than the pledge's value.
      expect(better.reasons.map((reason) => reason.code)).toEqual(['discount']);
    });

    it('not an LTI ship without an LTI item', () => {
      const result = judge(carrack('lti'));
      expect(result.reasons).toEqual([
        {
          code: 'insurance',
          insurance: { lifetime: true },
          offered: { lifetime: false, months: 120 },
        },
      ]);
      // The cheapest item, for its price.
      expect(result.rebuyPrice).toBe(600);
    });

    it('an LTI ship with an LTI item', () => {
      const aurora = titan({
        title: 'Standalone Ships - Aurora MR - LTI',
        valueUsd: 25,
        insurance: { lifetime: true },
        items: [
          { title: 'Aurora MR', kind: 'Ship' },
          { title: 'Lifetime Insurance', kind: 'Insurance' },
        ],
      });
      // The Aurora MR isn't always available here.
      expect(judge(aurora, { alwaysAvailable: () => true })).toMatchObject({
        rebuyable: true,
        item: { insurance: 'lti', skuId: 201 },
      });
    });

    it('not known where the store item names no insurance', () => {
      const cutlass = titan({
        title: 'Standalone Ships - Cutlass Black',
        valueUsd: 110,
        items: [{ title: 'Cutlass Black', kind: 'Ship' }],
      });
      const result = judge(cutlass);
      expect(result.reasons).toEqual([{ code: 'unknown', missing: 'insurance' }]);
      expect(result.rebuyPrice).toBe(110);
      expect(result.item).toMatchObject({ skuId: 202 });
      expect(result.item).not.toHaveProperty('insurance');
    });

    it('a ship without an insurance with any item', () => {
      const cutlass = titan({
        title: 'Standalone Ships - Cutlass Black',
        valueUsd: 110,
        insurance: undefined,
        items: [{ title: 'Cutlass Black', kind: 'Ship' }],
      });
      expect(codes(cutlass)).toEqual([]);
    });

    it('not a CCU that brings an insurance', () => {
      const insurance = { lifetime: false, months: 120 } as const;
      expect(judge(ccu('Cutlass Black', 'Carrack', 490, { insurance })).reasons).toEqual([
        { code: 'insurance', insurance },
      ]);
    });
  });

  describe('still available in a few days', () => {
    it('not a ship whose price rises, confirmed or expected', () => {
      const confirmed = { increase: increase(2, 'Avenger Titan', true), reason: 'ship' as const };
      expect(judge(titan({ priceIncrease: confirmed })).reasons).toEqual([
        { code: 'priceIncrease', ship: 'Avenger Titan', at: NOW + 10 * DAY, confirmed: true },
      ]);
      const expected = { increase: increase(2, 'Avenger Titan'), reason: 'ship' as const };
      expect(judge(titan({ priceIncrease: expected })).reasons).toMatchObject([
        { code: 'priceIncrease', confirmed: false },
      ]);
    });

    it('not a CCU whose base or target rises, each ship once', () => {
      const target = increase(4, 'Carrack');
      const result = judge(
        ccu('Cutlass Black', 'Carrack', 490, {
          ccuPriceChange: { base: increase(3, 'Cutlass Black'), target, direction: 'mixed' },
          priceIncrease: { increase: target, reason: 'ccu' },
        }),
      );
      expect(result.reasons.map((reason) => (reason as { ship: string }).ship)).toEqual([
        'Cutlass Black',
        'Carrack',
      ]);
    });

    it('not a ship leaving the Pledge Store', () => {
      const removals = new Map([[2, removal(2, 'Avenger Titan')]]);
      expect(judge(titan(), { removals }).reasons).toEqual([
        { code: 'removal', ship: 'Avenger Titan', removedAt: { at: NOW + 5 * DAY, dayOnly: true } },
      ]);
    });

    it('not a CCU whose base or target leaves', () => {
      const removals = new Map([
        [3, removal(3, 'Cutlass Black')],
        [4, removal(4, 'Carrack')],
      ]);
      expect(codes(ccu('Cutlass Black', 'Carrack', 490), { removals })).toEqual([
        'removal',
        'removal',
      ]);
    });

    it('not a ship or a CCU target that isn’t always available', () => {
      const limited = { alwaysAvailable: (id: number) => id !== 2 && id !== 4 };
      expect(judge(titan(), limited).reasons).toEqual([
        { code: 'notAlwaysAvailable', ship: 'Avenger Titan' },
      ]);
      expect(codes(ccu('Cutlass Black', 'Carrack', 490), limited)).toEqual(['notAlwaysAvailable']);
    });

    it('a CCU from a base that isn’t always available', () => {
      const limited = { alwaysAvailable: (id: number) => id !== 3 };
      expect(codes(ccu('Cutlass Black', 'Carrack', 490), limited)).toEqual([]);
    });

    it('not known without the ships’ facts', () => {
      expect(codes(titan(), { alwaysAvailable: () => undefined })).toEqual(['unknown']);
    });
  });

  describe('unknown data', () => {
    it('counts the store not read yet as not known', () => {
      const catalog = { ships, buyable, warbonds };
      expect(judge(paint(), { catalog }).reasons).toEqual([{ code: 'unknown', missing: 'price' }]);
      expect(judge(titan(), { catalog }).reasons).toEqual([{ code: 'unknown', missing: 'price' }]);
    });

    it('counts a CCU without the upgrade tool’s ships as not known', () => {
      const result = judge(ccu('Cutlass Black', 'Carrack', 490), { catalog: { items } });
      expect(result.reasons).toEqual([{ code: 'unknown', missing: 'price' }]);
      expect(result.rebuyPrice).toBeUndefined();
    });

    it('counts a CCU without the ships on sale as not known', () => {
      const result = judge(ccu('Cutlass Black', 'Carrack', 490), {
        catalog: { ships, items },
      });
      expect(result.reasons).toEqual([{ code: 'unknown', missing: 'onSale' }]);
      expect(result.rebuyPrice).toBe(490);
    });

    it('counts a ship the upgrade tool doesn’t know as not known', () => {
      const result = judge(titan(), { catalog: { items } });
      expect(result.reasons).toEqual([{ code: 'unknown', missing: 'availability' }]);
      // The store item by name, but no watchlist item without the ship's id.
      expect(result.rebuyPrice).toBe(55);
      expect(result.item).toBeUndefined();
    });

    it('counts a CCU of an unknown ship as not known', () => {
      expect(codes(ccu('Nox', 'Carrack', 490))).toEqual(['unknown']);
    });
  });

  it('lists every reason at once', () => {
    const order = { id: 'X', amount: '$45.00 USD', placedAt: '2026-11-10', buyback: false };
    const removals = new Map([[2, removal(2, 'Avenger Titan')]]);
    const priceIncrease = { increase: increase(2, 'Avenger Titan'), reason: 'ship' as const };
    expect(
      codes(titan({ valueUsd: 45, isGiftable: true, isMeltable: false, order, priceIncrease }), {
        removals,
        alwaysAvailable: () => false,
      }),
    ).toEqual([
      'notMeltable',
      'giftable',
      'refundPeriod',
      'discount',
      'priceIncrease',
      'removal',
      'notAlwaysAvailable',
    ]);
  });

  it('lists the kind’s reasons with the others, but no price for them', () => {
    const result = judge(titan({ isGiftable: true, isUpgraded: true }));
    expect(result.reasons.map((reason) => reason.code)).toEqual(['giftable', 'upgraded']);
    expect(result.rebuyPrice).toBeUndefined();
  });
});

describe('insuranceOfName', () => {
  it('reads the insurance a store item names', () => {
    expect(insuranceOfName('LTI')).toEqual({ lifetime: true });
    expect(insuranceOfName('Lifetime Insurance')).toEqual({ lifetime: true });
    expect(insuranceOfName('10 Year')).toEqual({ lifetime: false, months: 120 });
    expect(insuranceOfName('6 Month')).toEqual({ lifetime: false, months: 6 });
    expect(insuranceOfName('120 Month Insurance')).toEqual({ lifetime: false, months: 120 });
    expect(insuranceOfName('ILW')).toBeUndefined();
  });
});
