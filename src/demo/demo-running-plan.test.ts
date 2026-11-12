import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { demoCompletedPlansItem } from '@/store/paint-consultant/completed-plans';
import {
  currentPlanOf,
  demoRebuyPlanItem,
  demoRunInputsItem,
  rebuyPlanItem,
} from '@/store/paint-consultant/rebuy-plan-storage';
import { runningPlanSteps } from '@/store/paint-consultant/running-plan';
import { FALLBACK_CATALOG } from './catalog';
import { generatedHangar, justBoughtOf } from './demo';
import {
  demoCompletedPlans,
  demoRunningPlan,
  seedDemoRunningPlan,
  type RunningPlanStage,
} from './demo-running-plan';

beforeEach(() => fakeBrowser.reset());

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const items = FALLBACK_CATALOG.items;

const EXPECTED: Record<Exclude<RunningPlanStage, 'none'>, string[]> = {
  cart: ['meltOwn:done', 'cart:current', 'pay:next', 'fillers:next'],
  credit: ['meltOwn:done', 'cart:current', 'pay:next', 'fillers:next'],
  pay: ['meltOwn:done', 'cart:done', 'pay:current', 'fillers:next'],
  meltOld: ['buy:done', 'meltOld:current', 'fillers:wait'],
  wait: ['meltOwn:done', 'cart:done', 'pay:done', 'fillers:wait'],
  fillers: ['meltOwn:done', 'cart:done', 'pay:done', 'fillers:current'],
};

describe.each(['key-a', 'key-b', 'key-c'])('the running plan of the demo %s (#245)', (key) => {
  const pledges = generatedHangar(FALLBACK_CATALOG, key, TODAY, NOW);
  const marked = [justBoughtOf(pledges)!];

  const stepsOf = (stage: RunningPlanStage) => {
    const built = demoRunningPlan(stage, { pledges, items, now: NOW, marked })!;
    expect(built.plan).not.toBeNull();
    return runningPlanSteps({
      plan: built.plan!,
      pledges,
      storeItems: items,
      credit: built.inputs.credit,
      cart: built.inputs.cart
        ? { status: 'read', lines: built.inputs.cart, at: 0 }
        : { status: 'unread' },
      bulkMelting: true,
      useFillers: true,
      demo: true,
      now: NOW,
    });
  };

  it.each(Object.entries(EXPECTED))('shows the stage %s', (stage, states) => {
    const view = stepsOf(stage as RunningPlanStage);
    expect(view.steps.map((step) => `${step.kind}:${step.state}`)).toEqual(states);
    expect(view.complete).toBe(false);
  });

  it('has paints missing in the cart, and too little store credit', () => {
    const cart = stepsOf('cart').steps[1]!;
    expect(cart.body?.checks.find((check) => check.kind === 'cart')?.ok).toBe(false);
    expect(cart.body?.actions.find((action) => action.kind === 'fillCart')).toBeDefined();
    const credit = stepsOf('credit').steps[1]!;
    expect(credit.body?.checks.find((check) => check.kind === 'credit')?.ok).toBe(false);
    expect(credit.body?.note?.kind).toBe('creditSpent');
  });

  it('counts down for the fillers', () => {
    const fillers = stepsOf('wait').steps[3]!;
    expect(fillers.body?.countdown?.endsAt).toBeGreaterThan(NOW);
  });

  it('has no plan at the stage none', () => {
    expect(demoRunningPlan('none', { pledges, items, now: NOW })?.plan).toBeNull();
  });
});

describe('the completed plans of the demo (#245)', () => {
  it('has one of each way, newest first, with the store credit before and after', () => {
    const plans = demoCompletedPlans(items, NOW);
    expect(plans.map((plan) => plan.way)).toEqual(['melt', 'buy']);
    expect(plans[0]!.completedAt).toBeGreaterThan(plans[1]!.completedAt);
    for (const plan of plans) {
      expect(plan.result).toBeGreaterThan(0);
      expect(plan.creditAfter).toBeCloseTo(plan.creditBefore! + plan.result, 2);
    }
  });
});

describe('seedDemoRunningPlan', () => {
  it("sets the demo's storage once per key and stage, never the account's", async () => {
    const pledges = generatedHangar(FALLBACK_CATALOG, 'key-a', TODAY, NOW);
    const built = demoRunningPlan('pay', { pledges, items, now: NOW });
    await seedDemoRunningPlan('key-a', 'pay', built, demoCompletedPlans(items, NOW));
    expect(currentPlanOf(await demoRebuyPlanItem.getValue())?.way).toBe('melt');
    expect((await demoRunInputsItem.getValue())?.cart?.length).toBeGreaterThan(0);
    expect((await demoCompletedPlansItem.getValue())?.plans).toHaveLength(2);
    expect(await rebuyPlanItem.getValue()).toBeNull();

    await demoRebuyPlanItem.setValue(null);
    await seedDemoRunningPlan('key-a', 'pay', built, []);
    expect(await demoRebuyPlanItem.getValue()).toBeNull();
    await seedDemoRunningPlan(
      'key-a',
      'none',
      demoRunningPlan('none', { pledges, items, now: NOW }),
      [],
    );
    expect(await demoRebuyPlanItem.getValue()).toBeNull();
  });
});
