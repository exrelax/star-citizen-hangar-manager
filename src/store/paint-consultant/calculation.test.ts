import { describe, expect, it } from 'vitest';
import type { StoreItem } from '../items/store-items';
import {
  findRebought,
  ownPaintsOf,
  planPaintRebuy,
  planPendingRebuy,
  storePaintsOf,
  type PaintPledge,
} from './calculation';

let nextId = 1;

const storeItem = (name: string, price: number, overrides: Partial<StoreItem> = {}): StoreItem => ({
  id: nextId++,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
  ...overrides,
});

const paintPledge = (
  name: string,
  valueUsd: number,
  overrides: Partial<PaintPledge> = {},
): PaintPledge => ({
  id: nextId++,
  title: `Paints - ${name}`,
  valueUsd,
  isMeltable: true,
  isGiftable: false,
  items: [{ title: name, kind: 'Skin' }],
  ...overrides,
});

/** Cheap paints of the Pledge Store, $3 each, as many as needed. */
const cheapPaints = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    storeItem(`Cheap ${String(i).padStart(2, '0')} Paint`, 3),
  );

describe('storePaintsOf', () => {
  it('keeps the single paints that can be bought with store credit', () => {
    const items = [
      storeItem('Arrow - Tan and Green Paint', 3),
      storeItem('Intrepid - Oblivion', 5),
      storeItem('Old Paint', 4, { available: false }),
      storeItem('Warbond Paint', 4, { isWarbond: true }),
      storeItem('Creature Feature - 3 Paint Pack', 27, { discountedPrice: 21.6 }),
      storeItem('Racing Paint Collection', 50),
      storeItem('Some Gear', 3, { category: 'Gear' }),
    ];
    expect(storePaintsOf(items).map((paint) => paint.name)).toEqual([
      'Arrow - Tan and Green Paint',
      'Intrepid - Oblivion',
    ]);
  });
});

describe('ownPaintsOf', () => {
  const store = storePaintsOf([
    storeItem('Paladin - Shadowfall Paint', 10),
    storeItem('Sabre - Ashcloud Paint', 6),
  ]);

  it('finds own single paints and their discount', () => {
    const paints = ownPaintsOf([paintPledge('Paladin - Shadowfall Paint', 7.5)], store);
    expect(paints).toMatchObject([
      { title: 'Paints - Paladin - Shadowfall Paint', meltValue: 7.5, discount: 25 },
    ]);
    expect(paints[0]!.storePaint.name).toBe('Paladin - Shadowfall Paint');
  });

  it('rounds the discount to the tiers', () => {
    // $3.90 of $6 is 35 %; $3.91 is 34.83 %, rounded to 35 % as well.
    const [paint] = ownPaintsOf([paintPledge('Sabre - Ashcloud Paint', 3.91)], store);
    expect(paint!.discount).toBe(35);
  });

  it('leaves out what can’t be melted and bought again on its own', () => {
    const pledges = [
      // Not meltable (not exchangeable, or protected by the game access).
      paintPledge('Paladin - Shadowfall Paint', 10, { isMeltable: false }),
      paintPledge('Paladin - Shadowfall Paint', 0),
      // A paint next to other items, and a pack of two paints.
      paintPledge('Paladin - Shadowfall Paint', 10, {
        items: [
          { title: 'Paladin - Shadowfall Paint', kind: 'Skin' },
          { title: 'Poster', kind: 'Hangar decoration' },
        ],
      }),
      paintPledge('Paladin - Shadowfall Paint', 10, {
        items: [
          { title: 'Paladin - Shadowfall Paint', kind: 'Skin' },
          { title: 'Sabre - Ashcloud Paint', kind: 'Skin' },
        ],
      }),
      // Not sold in the store any more.
      paintPledge('Hornet - Gone Paint', 10),
    ];
    expect(ownPaintsOf(pledges, store)).toEqual([]);
  });
});

describe('planPaintRebuy', () => {
  it('turns melt value into store credit (the example of #95)', () => {
    // 5 own paints at $5 without discount, the cheapest paints of the store at $3.
    const own = Array.from({ length: 5 }, (_, i) => `Own ${i} Paint`);
    const storeItems = [...own.map((name) => storeItem(name, 5)), ...cheapPaints(5)];
    const pledges = own.map((name) => paintPledge(name, 5));

    const { plan, next } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 1,
      useFillers: true,
      skipGiftable: false,
    });

    expect(plan).toMatchObject({
      tier: { paints: 10, percent: 35 },
      cartPrice: 40,
      // (5 × $5 + 5 × $3) × 0.65
      cartCost: 26,
      meltValue: 25,
      storeCreditNeeded: 1,
      // $25 of melt value, the own paints cost 5 × $3.25 again; the fillers melt for $9.75.
      storeCreditFreed: 8.75,
    });
    expect(plan!.own).toHaveLength(5);
    expect(plan!.fillers.reduce((sum, filler) => sum + filler.quantity, 0)).toBe(5);
    expect(next).toBeUndefined();
  });

  it('fills the cart with the cheapest paints, up to 5 of the same', () => {
    // One own paint at $5 needs 9 fillers for 35 %: 5 × Arrow and 4 × ROC at $3 each.
    const storeItems = [
      storeItem('Own Paint', 5),
      storeItem('ROC - Harvester Paint', 3),
      storeItem('Arrow - Tan and Green Paint', 3),
      storeItem('Avenger - Expensive Paint', 9),
    ];
    const pledges = [paintPledge('Own Paint', 5)];

    const { plan } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 100,
      useFillers: true,
      skipGiftable: false,
    });

    expect(plan!.tier.percent).toBe(35);
    expect(plan!.fillers.map((f) => [f.paint.name, f.quantity])).toEqual([
      ['Arrow - Tan and Green Paint', 5],
      ['ROC - Harvester Paint', 4],
    ]);
    // $27 of fillers cost $17.55; with the own paint, (5 + 27) × 0.65.
    expect(plan!.cartCost).toBe(20.8);
    expect(plan!.storeCreditNeeded).toBe(15.8);
    expect(plan!.storeCreditFreed).toBe(1.75);
  });

  it('takes a lower tier when the store credit doesn’t pay the best one', () => {
    const own = Array.from({ length: 5 }, (_, i) => `Own ${i} Paint`);
    const storeItems = [...own.map((name) => storeItem(name, 5)), ...cheapPaints(5)];
    const pledges = own.map((name) => paintPledge(name, 5));

    const { plan, next } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 0,
      useFillers: true,
      skipGiftable: false,
    });

    // 30 %: 5 own + 2 fillers, (25 + 6) × 0.7 = $21.70, paid by the $25 of melt value.
    expect(plan).toMatchObject({ tier: { percent: 30 }, storeCreditNeeded: 0 });
    expect(plan!.storeCreditFreed).toBe(7.5);
    expect(next).toEqual({ tier: { paints: 10, percent: 35 }, missing: 1 });
  });

  it('counts only own paints without filler paints', () => {
    const storeItems = [storeItem('A Paint', 10), storeItem('B Paint', 10), ...cheapPaints(10)];
    const pledges = [paintPledge('A Paint', 10), paintPledge('B Paint', 10)];

    const { plan } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 0,
      useFillers: false,
      skipGiftable: false,
    });

    expect(plan).toMatchObject({ tier: { paints: 2, percent: 15 }, fillers: [] });
    expect(plan!.storeCreditFreed).toBe(3);
  });

  it('leaves out own paints that already have the discount of the tier', () => {
    // Bought at 25 % ($4.50 of $6): no gain at 25 %, 10 points at 35 %.
    const storeItems = [storeItem('Discounted Paint', 6), ...cheapPaints(10)];
    const pledges = [paintPledge('Discounted Paint', 4.5)];

    const atBest = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 100,
      useFillers: true,
      skipGiftable: false,
    });
    expect(atBest.plan).toMatchObject({ tier: { percent: 35 }, storeCreditFreed: 0.6 });

    const without = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 100,
      useFillers: false,
      skipGiftable: false,
    });
    expect(without.plan).toBeUndefined();
  });

  it('keeps out paints within the rounding of the tier', () => {
    // 34.83 % counts as 35 %: nothing to gain.
    const storeItems = [storeItem('Almost Paint', 6), ...cheapPaints(10)];
    const pledges = [paintPledge('Almost Paint', 3.91)];
    expect(
      planPaintRebuy({
        pledges,
        storeItems,
        storeCredit: 100,
        useFillers: true,
        skipGiftable: false,
      }),
    ).toEqual({
      giftableSkipped: 0,
      rebought: [],
      probablyRebought: [],
      plan: undefined,
      next: undefined,
    });
  });

  it('puts at most 5 of the same paint into the cart', () => {
    const storeItems = [storeItem('Same Paint', 5), ...cheapPaints(10)];
    const pledges = Array.from({ length: 6 }, () => paintPledge('Same Paint', 5));

    const { plan } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 100,
      useFillers: true,
      skipGiftable: false,
    });

    expect(plan!.own).toHaveLength(5);
    expect(plan!.fillers.reduce((sum, filler) => sum + filler.quantity, 0)).toBe(5);
  });

  it('counts own paints toward the limit of 5 for fillers of the same paint', () => {
    // The own paint is also the cheapest one: only 4 more of it fit as fillers.
    const others = cheapPaints(10).map((item) => ({ ...item, price: 3.5 }));
    const storeItems = [storeItem('Cheap Own Paint', 3), ...others];
    const pledges = [paintPledge('Cheap Own Paint', 3)];

    const { plan } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 100,
      useFillers: true,
      skipGiftable: false,
    });

    const sameAsOwn = plan!.fillers.find((f) => f.paint.name === 'Cheap Own Paint');
    expect(sameAsOwn?.quantity).toBe(4);
  });

  it('puts more than 10 own paints into the 35 % cart', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Own ${String(i).padStart(2, '0')} Paint`);
    const storeItems = names.map((name) => storeItem(name, 5));
    const pledges = names.map((name) => paintPledge(name, 5));

    const { plan } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 0,
      useFillers: true,
      skipGiftable: false,
    });

    expect(plan).toMatchObject({ tier: { percent: 35 }, fillers: [], storeCreditFreed: 21 });
    expect(plan!.own).toHaveLength(12);
  });

  it('says what is missing when no tier can be paid', () => {
    // A $3 paint bought at full price, no store credit: every tier needs some.
    const storeItems = [storeItem('Own Paint', 3), storeItem('Filler Paint', 3)];
    const pledges = [paintPledge('Own Paint', 3)];

    const { plan, next } = planPaintRebuy({
      pledges,
      storeItems,
      storeCredit: 0,
      useFillers: true,
      skipGiftable: false,
    });

    expect(plan).toBeUndefined();
    // 15 % needs the least: one filler, ($3 + $3) × 0.85 − $3 of melt value = $2.10.
    expect(next).toEqual({ tier: { paints: 2, percent: 15 }, missing: 2.1 });
  });

  it('leaves out giftable paints if asked to', () => {
    const storeItems = [
      storeItem('Gift Paint', 5),
      storeItem('Bound Paint', 5),
      ...cheapPaints(10),
    ];
    const pledges = [
      paintPledge('Gift Paint', 5, { isGiftable: true }),
      paintPledge('Bound Paint', 5),
    ];
    const input = { pledges, storeItems, storeCredit: 100, useFillers: true };

    const withGifts = planPaintRebuy({ ...input, skipGiftable: false });
    expect(withGifts.plan!.own.map((paint) => [paint.storePaint.name, paint.giftable])).toEqual([
      ['Gift Paint', true],
      ['Bound Paint', false],
    ]);
    expect(withGifts.giftableSkipped).toBe(0);

    const without = planPaintRebuy({ ...input, skipGiftable: true });
    expect(without.plan!.own.map((paint) => paint.storePaint.name)).toEqual(['Bound Paint']);
    expect(without.giftableSkipped).toBe(1);
  });
});

describe('findRebought (#139)', () => {
  const store = storePaintsOf([
    storeItem('Polaris - Quasar Paint', 22),
    storeItem('Lynx - Moonrise Paint', 5),
  ]);
  const own = (pledges: PaintPledge[]) => ownPaintsOf(pledges, store);

  it('pairs a younger copy bought with a higher discount with the old pledge', () => {
    const old = paintPledge('Polaris - Quasar Paint', 22);
    const copy = paintPledge('Polaris - Quasar Paint', 14.3, { createdAt: '2026-11-09' });
    const [pair, ...others] = findRebought(own([old, copy]));
    expect(others).toEqual([]);
    expect(pair!.old.pledgeId).toBe(old.id);
    expect(pair!.copy.pledgeId).toBe(copy.id);
    expect(pair!.copy.discount).toBe(35);
    expect(pair!.copy.boughtOn).toBe('2026-11-09');
  });

  it('pairs several copies of the same paint, each with one old pledge, the oldest first', () => {
    const olds = [paintPledge('Lynx - Moonrise Paint', 5), paintPledge('Lynx - Moonrise Paint', 5)];
    const third = paintPledge('Lynx - Moonrise Paint', 5);
    const copies = [
      paintPledge('Lynx - Moonrise Paint', 3.25),
      paintPledge('Lynx - Moonrise Paint', 3.25),
    ];
    const pairs = findRebought(own([...olds, third, ...copies]));
    expect(pairs.map((pair) => pair.old.pledgeId)).toEqual(olds.map((pledge) => pledge.id));
    expect(pairs.map((pair) => pair.copy.pledgeId).sort()).toEqual(
      copies.map((pledge) => pledge.id).sort(),
    );
  });

  it('leaves a copy without an old partner as a normal own paint', () => {
    const copy = paintPledge('Lynx - Moonrise Paint', 3.25);
    expect(findRebought(own([copy]))).toEqual([]);
    // Older than the pledge without the discount: bought on sale once, not bought again.
    const later = paintPledge('Lynx - Moonrise Paint', 5);
    expect(findRebought(own([copy, later]))).toEqual([]);
  });

  it('finds nothing once the old pledge is melted', () => {
    const copy = paintPledge('Polaris - Quasar Paint', 14.3);
    expect(findRebought(own([copy]))).toEqual([]);
  });

  describe('with a kept plan or as a guess', () => {
    const setup = () => {
      const old = paintPledge('Polaris - Quasar Paint', 22);
      const copy = paintPledge('Polaris - Quasar Paint', 14.3, { createdAt: '2026-11-09' });
      const other = paintPledge('Lynx - Moonrise Paint', 5);
      const plan = (input: Partial<Parameters<typeof planPaintRebuy>[0]>) =>
        planPaintRebuy({
          pledges: [old, copy, other],
          storeItems: [
            storeItem('Polaris - Quasar Paint', 22, { id: store[0]!.id }),
            storeItem('Lynx - Moonrise Paint', 5, { id: store[1]!.id }),
            ...cheapPaints(10),
          ],
          storeCredit: 100,
          useFillers: true,
          skipGiftable: false,
          ...input,
        });
      return { old, copy, other, plan };
    };
    const at = new Date(2026, 10, 9, 10).getTime();

    it('keeps confirmed pairs out of a new plan, next to other paints', () => {
      const { old, other, plan } = setup();
      const result = plan({ keptPlan: { at, ownPledgeIds: [old.id] } });
      expect(result.rebought.map((pair) => pair.old.pledgeId)).toEqual([old.id]);
      expect(result.plan?.own.map((paint) => paint.pledgeId)).toEqual([other.id]);
    });

    it('confirms nothing without a kept plan, or with a copy bought before it', () => {
      const { old, plan } = setup();
      expect(plan({}).rebought).toEqual([]);
      const later = new Date(2026, 10, 10).getTime();
      expect(plan({ keptPlan: { at: later, ownPledgeIds: [old.id] } }).rebought).toEqual([]);
      // Another paint was in the plan, not this one.
      expect(plan({ keptPlan: { at, ownPledgeIds: [12345] } }).rebought).toEqual([]);
    });

    it('shows unconfirmed pairs as a guess, which stay in the plan', () => {
      const { old, plan } = setup();
      expect(plan({}).probablyRebought).toEqual([]);
      const result = plan({ guessRebought: true });
      expect(result.probablyRebought.map((pair) => pair.old.pledgeId)).toEqual([old.id]);
      expect(result.rebought).toEqual([]);
      expect(result.plan?.own.map((paint) => paint.pledgeId)).toContain(old.id);
    });
  });
});

describe('planPendingRebuy (#168)', () => {
  const at = new Date(2026, 10, 9, 10).getTime();
  const setup = () => {
    const quasar = storeItem('Polaris - Quasar Paint', 22);
    const moonrise = storeItem('Lynx - Moonrise Paint', 5);
    const storeItems = [quasar, moonrise, ...cheapPaints(10)];
    const kept = {
      at,
      tier: { paints: 10, percent: 35 },
      own: [
        { pledgeId: 101, title: 'Paints - Polaris - Quasar Paint', skuId: quasar.id },
        { pledgeId: 102, title: 'Paints - Lynx - Moonrise Paint', skuId: moonrise.id },
      ],
    };
    return { quasar, moonrise, storeItems, kept };
  };

  it('lists the melted paints left to buy, at the tier the store credit pays', () => {
    const { storeItems, kept } = setup();
    const pending = planPendingRebuy({
      kept,
      pledges: [],
      storeItems,
      storeCredit: 100,
      useFillers: true,
    });
    expect(pending?.toBuy.map((paint) => paint.pledgeId)).toEqual([101, 102]);
    expect(pending?.plan?.tier.percent).toBe(35);
    // (22 + 5 + 8 × 3) × 0.65
    expect(pending?.plan?.cartCost).toBe(33.15);
    expect(pending?.missing).toBeUndefined();
  });

  it('takes a lower tier when the store credit is short, and says what the planned one misses', () => {
    const { storeItems, kept } = setup();
    const pending = planPendingRebuy({
      kept,
      pledges: [],
      storeItems,
      storeCredit: 25,
      useFillers: true,
    });
    expect(pending?.plan?.tier.percent).toBeLessThan(35);
    expect(pending?.plan && pending.plan.cartCost <= 25).toBe(true);
    expect(pending?.missing).toEqual({ tier: { paints: 10, percent: 35 }, missing: 8.15 });
  });

  it('skips paints still in the hangar and paints bought again since the plan', () => {
    const { storeItems, kept } = setup();
    const notMelted = paintPledge('Polaris - Quasar Paint', 22, { id: 101 });
    const copy = paintPledge('Lynx - Moonrise Paint', 3.25, { createdAt: '2026-11-09' });
    expect(
      planPendingRebuy({
        kept,
        pledges: [notMelted, copy],
        storeItems,
        storeCredit: 100,
        useFillers: true,
      }),
    ).toBeUndefined();
  });

  it('doesn’t count a copy bought before the plan', () => {
    const { storeItems, kept } = setup();
    const older = paintPledge('Lynx - Moonrise Paint', 3.25, { createdAt: '2026-10-22' });
    const pending = planPendingRebuy({
      kept,
      pledges: [older],
      storeItems,
      storeCredit: 100,
      useFillers: true,
    });
    expect(pending?.toBuy.map((paint) => paint.pledgeId)).toEqual([101, 102]);
  });

  it('names melted paints the store doesn’t sell any more', () => {
    const { kept } = setup();
    const pending = planPendingRebuy({
      kept,
      pledges: [],
      storeItems: cheapPaints(10),
      storeCredit: 100,
      useFillers: true,
    });
    expect(pending?.toBuy).toEqual([]);
    expect(pending?.unavailable).toEqual([
      'Paints - Polaris - Quasar Paint',
      'Paints - Lynx - Moonrise Paint',
    ]);
  });
});
