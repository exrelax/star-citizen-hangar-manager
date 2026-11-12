import { describe, expect, it } from 'vitest';
import type { StoreItem } from '../items/store-items';
import type { PaintPledge } from './calculation';
import { REBUY_PLAN_VERSION, type StoredRebuyPlan } from './rebuy-plan-storage';
import {
  planProgress,
  recalculatedPlan,
  runningPlanSteps,
  withMelted,
  withSeenGone,
  type CartState,
  type RunningPlanInput,
  type RunAction,
  type RunStep,
} from './running-plan';

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
  item(2, 'Polaris - Quasar Paint', 22),
  item(20, '100 Series - Timberline Paint', 3),
  item(21, 'Arrow - Light Green and Grey Paint', 3),
];

const PLAN_AT = new Date(2026, 10, 9, 10, 0).getTime();
const HOUR = 60 * 60 * 1000;
const FOUND_AT = PLAN_AT + HOUR;

const paint = (id: number, name: string, createdAt = '2026-11-09', isMeltable = true) =>
  ({
    id,
    title: `Paints - ${name}`,
    valueUsd: name.startsWith('Polaris') ? 22 : name.startsWith('Lynx') ? 5 : 2.25,
    isMeltable,
    isGiftable: false,
    items: [{ title: name, kind: 'Skin' }],
    createdAt,
  }) as PaintPledge;

const OLD = [
  paint(100, 'Lynx - Moonrise Paint', '2025-01-01'),
  paint(101, 'Polaris - Quasar Paint', '2025-01-01'),
];
const COPIES = [paint(201, 'Lynx - Moonrise Paint'), paint(202, 'Polaris - Quasar Paint')];
const FILLERS = [
  paint(203, '100 Series - Timberline Paint'),
  paint(204, '100 Series - Timberline Paint'),
  paint(205, 'Arrow - Light Green and Grey Paint'),
];

/** 2 own paints and 3 fillers at 25 %: ($27 + $9) × 0.75 = $27. */
const plan = (way: 'buy' | 'melt', changes: Partial<StoredRebuyPlan> = {}): StoredRebuyPlan => ({
  version: REBUY_PLAN_VERSION,
  way,
  at: PLAN_AT,
  creditAtStart: 40,
  tier: { paints: 5, percent: 25 },
  own: [
    { pledgeId: 100, title: 'Paints - Lynx - Moonrise Paint', skuId: 1, meltValue: 5, price: 5 },
    { pledgeId: 101, title: 'Paints - Polaris - Quasar Paint', skuId: 2, meltValue: 22, price: 22 },
  ],
  fillers: [
    { skuId: 20, name: '100 Series - Timberline Paint', quantity: 2, price: 3 },
    { skuId: 21, name: 'Arrow - Light Green and Grey Paint', quantity: 1, price: 3 },
  ],
  cartCost: 27,
  ...changes,
});

const purchase = {
  orderId: 'ORDER1',
  pledgeIds: [203, 204, 205],
  ownPledgeIds: [201, 202],
  skus: { 201: 1, 202: 2, 203: 20, 204: 20, 205: 21 },
  foundAt: FOUND_AT,
};

const FULL_CART: CartState = {
  status: 'read',
  at: 0,
  lines: [
    { skuId: 1, qty: 1 },
    { skuId: 2, qty: 1 },
    { skuId: 20, qty: 2 },
    { skuId: 21, qty: 1 },
  ],
};

function view(input: Partial<RunningPlanInput> & { plan: StoredRebuyPlan }) {
  return runningPlanSteps({
    pledges: OLD,
    storeItems,
    credit: 30,
    cart: { status: 'unread' },
    bulkMelting: true,
    useFillers: true,
    demo: false,
    now: PLAN_AT + 2 * HOUR,
    ...input,
  });
}

const states = (steps: RunStep[]) => steps.map((step) => `${step.kind}:${step.state}`);
const action = (step: RunStep, kind: RunAction['kind']) =>
  step.body?.actions.find((candidate) => candidate.kind === kind);
const check = (step: RunStep, kind: string) =>
  step.body?.checks.find((candidate) => candidate.kind === kind);

describe('runningPlanSteps: buy first', () => {
  it('starts with buying, the cart not read yet', () => {
    const result = view({ plan: plan('buy') });
    expect(states(result.steps)).toEqual(['buy:current', 'meltOld:next', 'fillers:next']);
    expect(result.steps.map((step) => step.ariaCurrent)).toEqual([true, false, false]);
    expect(result).toMatchObject({ way: 'buy', doneCount: 0, currentIndex: 0, needsCart: true });
    // $27 melt value of the own paints − $20.25 they cost in the cart.
    expect(result.result).toBe(6.75);
    expect(check(result.steps[0]!, 'cartUnknown')?.ok).toBeUndefined();
    expect(result.steps[0]!.amount).toBe(-27);
    expect(result.steps[2]!.status.kind).toBe('after24h');
    expect(result.steps[2]!.body).toBeUndefined();
  });

  it('offers to put only the missing paints into the cart', () => {
    const cart: CartState = {
      status: 'read',
      at: 0,
      lines: [
        { skuId: 1, qty: 1 },
        { skuId: 20, qty: 1 },
      ],
    };
    const buy = view({ plan: plan('buy'), cart }).steps[0]!;
    expect(check(buy, 'cart')).toMatchObject({
      ok: false,
      values: { inCart: 2, total: 5, missing: 3 },
    });
    expect(action(buy, 'fillCart')).toMatchObject({
      enabled: true,
      count: 3,
      lines: [
        { skuId: 2, qty: 1 },
        { skuId: 20, qty: 1 },
        { skuId: 21, qty: 1 },
      ],
    });
    expect(buy.body!.paints.map((row) => row.state)).toEqual([
      'ok',
      'missing',
      'missing',
      'missing',
    ]);
  });

  it('lets the cart be paid when it holds the plan and the store credit pays it', () => {
    const buy = view({ plan: plan('buy'), cart: FULL_CART }).steps[0]!;
    expect(check(buy, 'credit')).toMatchObject({
      ok: true,
      values: { credit: 30, cost: 27, left: 3 },
    });
    expect(action(buy, 'pay')).toEqual({ kind: 'pay', role: 'cta', enabled: true, amount: 27 });
    expect(buy.body!.note?.kind).toBe('afterPay');
  });

  it('disables paying without enough store credit and offers to recalculate', () => {
    const buy = view({ plan: plan('buy'), cart: FULL_CART, credit: 24 }).steps[0]!;
    expect(check(buy, 'credit')).toMatchObject({ ok: false, values: { missing: 3 } });
    expect(action(buy, 'pay')?.enabled).toBe(false);
    expect(action(buy, 'recalculate')).toMatchObject({ role: 'ghost', enabled: true });
    expect(buy.body!.note?.kind).toBe('creditSpent');
  });

  it('tells about other items in the cart and sends to the cart', () => {
    const cart: CartState = {
      status: 'read',
      at: 0,
      lines: [...(FULL_CART.status === 'read' ? FULL_CART.lines : []), { skuId: 99, qty: 2 }],
    };
    const buy = view({ plan: plan('buy'), cart }).steps[0]!;
    expect(check(buy, 'otherItems')).toMatchObject({ ok: false, values: { count: 2 } });
    expect(action(buy, 'openCart')?.enabled).toBe(true);
    expect(action(buy, 'pay')).toBeUndefined();
  });

  it("shows a cart that can't be read as unknown, never as complete", () => {
    const cart: CartState = { status: 'failed', reason: 'Not signed in', at: 0 };
    const buy = view({ plan: plan('buy'), cart }).steps[0]!;
    expect(check(buy, 'cartUnread')).toMatchObject({
      ok: undefined,
      values: { reason: 'Not signed in' },
    });
    expect(action(buy, 'readCart')?.role).toBe('ghost');
    expect(action(buy, 'openCart')).toBeDefined();
    expect(action(buy, 'pay')).toBeUndefined();
  });

  it('offers to read an unknown store credit again', () => {
    const buy = view({ plan: plan('buy'), cart: FULL_CART, credit: undefined }).steps[0]!;
    expect(check(buy, 'creditUnknown')?.ok).toBeUndefined();
    expect(action(buy, 'readCredit')).toBeDefined();
    // RSI checks the store credit itself.
    expect(action(buy, 'pay')?.enabled).toBe(true);
  });

  it('tells changed prices and paints no longer sold', () => {
    const pricier = storeItems.map((i) => (i.id === 20 ? { ...i, price: 4 } : i));
    const changed = view({ plan: plan('buy'), cart: FULL_CART, storeItems: pricier }).steps[0]!;
    expect(check(changed, 'price')).toMatchObject({ values: { cost: 28.5, planned: 27 } });
    const gone = storeItems.filter((i) => i.id !== 2);
    const unavailable = view({ plan: plan('buy'), cart: FULL_CART, storeItems: gone }).steps[0]!;
    expect(check(unavailable, 'unavailable')).toMatchObject({ values: { count: 1 } });
    expect(unavailable.body!.paints[1]).toMatchObject({ state: 'missing', reason: 'unavailable' });
  });

  it('melts the old paints once bought, the fillers waiting for 24 hours', () => {
    const result = view({
      plan: plan('buy', { purchase }),
      pledges: [...OLD, ...COPIES, ...FILLERS],
    });
    expect(states(result.steps)).toEqual(['buy:done', 'meltOld:current', 'fillers:wait']);
    expect(result.steps[0]!.status).toMatchObject({ kind: 'paid', at: FOUND_AT });
    const melt = result.steps[1]!;
    expect(action(melt, 'melt')).toMatchObject({
      target: 'old',
      enabled: true,
      pledgeIds: [100, 101],
      amount: 27,
      bulk: true,
    });
    expect(melt.body!.note).toMatchObject({ kind: 'onlyOldCopies', values: { day: '2026-11-09' } });
    expect(result.steps[2]!.status).toEqual({ kind: 'readyAt', at: FOUND_AT + 24 * HOUR });
    // Not the earliest open step: no body.
    expect(result.steps[2]!.body).toBeUndefined();
    expect(result.needsCart).toBe(false);
  });

  it('counts down for the fillers once the old paints are melted', () => {
    const result = view({ plan: plan('buy', { purchase }), pledges: [...COPIES, ...FILLERS] });
    expect(states(result.steps)).toEqual(['buy:done', 'meltOld:done', 'fillers:wait']);
    const fillers = result.steps[2]!;
    expect(fillers.ariaCurrent).toBe(true);
    expect(fillers.body!.countdown).toEqual({ endsAt: FOUND_AT + 24 * HOUR, startedAt: FOUND_AT });
    expect(fillers.body!.paints.map((row) => [row.state, row.count, row.was, row.value])).toEqual([
      ['wait', 2, 2.25, 4.5],
      ['wait', 1, 2.25, 2.25],
    ]);
    expect(action(fillers, 'melt')?.enabled).toBe(false);
    expect(fillers.amount).toBe(6.75);
  });

  it('lets both be done when the fillers are ready while old paints are left', () => {
    const result = view({
      plan: plan('buy', { purchase }),
      pledges: [...OLD, ...COPIES, ...FILLERS],
      now: FOUND_AT + 25 * HOUR,
    });
    expect(states(result.steps)).toEqual(['buy:done', 'meltOld:current', 'fillers:current']);
    expect(result.steps.filter((step) => step.ariaCurrent)).toHaveLength(1);
    expect(result.steps[1]!.ariaCurrent).toBe(true);
    const fillers = result.steps[2]!;
    expect(check(fillers, 'cooldownOver')?.ok).toBe(true);
    expect(action(fillers, 'melt')).toMatchObject({ enabled: true, pledgeIds: [203, 204, 205] });
  });

  it('shows fillers partly melted, and bulk melting turned off', () => {
    const result = view({
      plan: plan('buy', { purchase }),
      pledges: [...COPIES, FILLERS[0]!],
      now: FOUND_AT + 25 * HOUR,
      bulkMelting: false,
    });
    const fillers = result.steps[2]!;
    expect(fillers.amountDone).toBe(4.5);
    expect(fillers.body!.paints.map((row) => [row.state, row.count])).toEqual([
      ['ok', 1],
      ['melt', 1],
      ['ok', 1],
    ]);
    expect(action(fillers, 'melt')).toMatchObject({ pledgeIds: [203], bulk: false });
  });

  it('is complete once nothing is left', () => {
    const result = view({ plan: plan('buy', { purchase }), pledges: COPIES });
    expect(result.complete).toBe(true);
    expect(result.doneCount).toBe(3);
    expect(result.currentIndex).toBe(-1);
  });

  it('has no fillers step without fillers, and finds the copies without an order', () => {
    const result = view({ plan: plan('buy', { fillers: [] }), pledges: [...OLD, ...COPIES] });
    expect(states(result.steps)).toEqual(['buy:done', 'meltOld:current']);
    expect(result.steps[0]!.status).toEqual({ kind: 'paid', day: '2026-11-09' });
  });

  it("marks old paints that can't be melted", () => {
    const pledges = [OLD[0]!, { ...OLD[1]!, isMeltable: false }, ...COPIES];
    const melt = view({ plan: plan('buy', { purchase }), pledges }).steps[1]!;
    expect(melt.body!.paints.map((row) => row.state)).toEqual(['melt', 'missing']);
    expect(check(melt, 'notMeltable')).toMatchObject({ values: { count: 1 } });
    expect(action(melt, 'melt')).toMatchObject({ pledgeIds: [100] });
  });

  it('can be given up when no order showed', () => {
    const buy = view({ plan: plan('buy', { checkEndedAt: PLAN_AT + 8 * 24 * HOUR }) }).steps[0]!;
    expect(buy.body!.note?.kind).toBe('notFound');
    expect(action(buy, 'discard')).toMatchObject({ role: 'ghost', enabled: true });
  });

  it('disables the actions in the demo, but recalculating and discarding', () => {
    const buy = view({ plan: plan('buy'), cart: FULL_CART, credit: 24, demo: true }).steps[0]!;
    expect(action(buy, 'pay')?.enabled).toBe(false);
    expect(action(buy, 'recalculate')?.enabled).toBe(true);
  });
});

describe('runningPlanSteps: melt first', () => {
  it('starts with melting the own paints', () => {
    const result = view({ plan: plan('melt') });
    expect(states(result.steps)).toEqual([
      'meltOwn:current',
      'cart:next',
      'pay:next',
      'fillers:next',
    ]);
    expect(action(result.steps[0]!, 'melt')).toMatchObject({
      target: 'own',
      pledgeIds: [100, 101],
    });
    expect(result.needsCart).toBe(false);
  });

  it('shows the paints melted so far', () => {
    const own = plan('melt').own.map((p, i) => (i ? p : { ...p, meltedAt: PLAN_AT, freed: 5 }));
    const melt = view({ plan: plan('melt', { own }), pledges: [OLD[1]!] }).steps[0]!;
    expect(melt.amountDone).toBe(5);
    expect(melt.body!.paints.map((row) => row.state)).toEqual(['ok', 'melt']);
    expect(action(melt, 'melt')).toMatchObject({ pledgeIds: [101], amount: 22 });
  });

  it('fills the cart once melted', () => {
    const cart: CartState = { status: 'read', at: 0, lines: [{ skuId: 1, qty: 1 }] };
    const result = view({ plan: plan('melt'), pledges: [], cart });
    expect(states(result.steps)).toEqual([
      'meltOwn:done',
      'cart:current',
      'pay:next',
      'fillers:next',
    ]);
    expect(result.needsCart).toBe(true);
    expect(action(result.steps[1]!, 'fillCart')).toMatchObject({ count: 4 });
    expect(result.steps[1]).toMatchObject({ amount: 27, signed: false });
  });

  it('keeps the cart open while the store credit is short', () => {
    const result = view({ plan: plan('melt'), pledges: [], cart: FULL_CART, credit: 14.2 });
    expect(states(result.steps).slice(1, 3)).toEqual(['cart:current', 'pay:next']);
    const cartStep = result.steps[1]!;
    expect(check(cartStep, 'cart')?.ok).toBe(true);
    expect(action(cartStep, 'pay')?.enabled).toBe(false);
    expect(cartStep.body!.note?.kind).toBe('creditSpent');
    // No tier of the two paints left to buy fits $14.20.
    expect(action(cartStep, 'recalculate')?.enabled).toBe(false);
  });

  it('is ready to pay with the cart checked', () => {
    const result = view({ plan: plan('melt'), pledges: [], cart: FULL_CART });
    expect(states(result.steps)).toEqual([
      'meltOwn:done',
      'cart:done',
      'pay:current',
      'fillers:next',
    ]);
    expect(result.steps[1]!.status.kind).toBe('checked');
    expect(action(result.steps[2]!, 'pay')).toMatchObject({ enabled: true, amount: 27 });
  });

  it('waits for the order after the cart was emptied', () => {
    const cart: CartState = { status: 'read', at: 0, lines: [], emptiedAfterComplete: true };
    const result = view({ plan: plan('melt'), pledges: [], cart });
    const pay = result.steps[2]!;
    expect(pay).toMatchObject({ state: 'current', status: { kind: 'checking' } });
    expect(pay.body!.note?.kind).toBe('purchaseNextRefresh');
    expect(result.needsCart).toBe(false);
  });

  it('waits for the fillers, then melts them', () => {
    const bought = plan('melt', { purchase });
    const waiting = view({ plan: bought, pledges: [...COPIES, ...FILLERS] });
    expect(states(waiting.steps)).toEqual([
      'meltOwn:done',
      'cart:done',
      'pay:done',
      'fillers:wait',
    ]);
    expect(waiting.steps[3]!.body?.countdown).toBeDefined();
    const ready = view({ plan: bought, pledges: FILLERS, now: FOUND_AT + 25 * HOUR });
    expect(ready.steps[3]!.state).toBe('current');
  });

  it('shows what is left of a plan paid before melting', () => {
    const result = view({ plan: plan('melt', { purchase }), pledges: [...OLD, ...COPIES] });
    expect(states(result.steps)).toEqual([
      'meltOwn:current',
      'cart:done',
      'pay:done',
      'fillers:done',
    ]);
  });
});

describe('planProgress', () => {
  it('assigns the fillers of a purchase kept before #245 to the planned SKUs', () => {
    const old = { orderId: 'O', pledgeIds: [203, 204, 205], foundAt: FOUND_AT };
    const progress = planProgress(plan('buy', { purchase: old }), [], storeItems);
    expect(progress.fillers.map((filler) => filler.skuId)).toEqual([20, 20, 21]);
    expect(progress.bought).toBe(true);
  });
});

describe('recalculatedPlan', () => {
  const input = { storeItems, useFillers: true, now: 99 };

  it('melt first: the tier the store credit pays now for the melted paints', () => {
    const next = recalculatedPlan(plan('melt'), { ...input, pledges: [], credit: 25 })!;
    expect(next.tier.percent).toBe(20);
    expect(next.cartCost).toBe(24);
    expect(next.own.map((paint) => paint.pledgeId)).toEqual([100, 101]);
    expect(next).toMatchObject({ way: 'melt', recalculatedAt: 99, previousTier: { percent: 25 } });
    expect(recalculatedPlan(plan('melt'), { ...input, pledges: [], credit: 10 })).toBeUndefined();
    // Not before every own paint is melted.
    expect(recalculatedPlan(plan('melt'), { ...input, pledges: OLD, credit: 25 })).toBeUndefined();
  });

  it('buy first: the best tier the store credit pays before melting', () => {
    const next = recalculatedPlan(plan('buy'), { ...input, pledges: OLD, credit: 24 })!;
    expect(next.tier.percent).toBe(20);
    expect(next.cartCost).toBe(24);
    expect(next.way).toBe('buy');
    expect(recalculatedPlan(plan('buy'), { ...input, pledges: OLD, credit: 1 })).toBeUndefined();
  });

  it('never once paid', () => {
    const paid = plan('buy', { purchase });
    expect(recalculatedPlan(paid, { ...input, pledges: OLD, credit: 24 })).toBeUndefined();
  });
});

describe('withMelted and withSeenGone', () => {
  it('records melts exactly, replacing a time only seen', () => {
    const seen = withSeenGone(plan('buy', { purchase }), [OLD[1]!, FILLERS[0]!], 50);
    expect(seen.own[0]).toMatchObject({ meltedAt: 50, seenGone: true });
    expect(seen.fillersMelted).toEqual({ 204: 50, 205: 50 });
    expect(withSeenGone(seen, [OLD[1]!, FILLERS[0]!], 60)).toBe(seen);

    const melted = withMelted(seen, [100, 101, 203], new Map([[100, 4.9]]), 70);
    expect(melted.own[0]).toEqual({ ...plan('buy').own[0], meltedAt: 70, freed: 4.9 });
    expect(melted.own[1]).toMatchObject({ meltedAt: 70 });
    expect(melted.fillersMelted).toEqual({ 203: 70, 204: 50, 205: 50 });
    expect(withMelted(melted, [999], new Map(), 80)).toBe(melted);
  });
});
