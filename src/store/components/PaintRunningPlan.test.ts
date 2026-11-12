// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { computed, createApp, h, nextTick, shallowRef, type App } from 'vue';
import { FALLBACK_CATALOG } from '@/demo/catalog';
import { generatedHangar, justBoughtOf } from '@/demo/demo';
import { DEMO_CONTEXT, type DemoContext } from '@/demo/use-demo';
import {
  demoCompletedPlans,
  demoRunningPlan,
  type RunningPlanStage,
} from '@/demo/demo-running-plan';
import type { CartState } from '../paint-consultant/running-plan';
import { runningPlanSteps } from '../paint-consultant/running-plan';
import type { RunningPlanState } from '../paint-consultant/use-running-plan';
import PaintCompletedPlans from './PaintCompletedPlans.vue';
import PaintRunningPlan from './PaintRunningPlan.vue';

/*
 * The running plan's card (#245) for each stage of the demo's plan (`demo-running-plan.ts`), and
 * the completed plans.
 */

let app: App | undefined;
beforeEach(() => {
  fakeBrowser.reset();
  // The stages are built for this time; the card's clock reads it too.
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});
afterEach(() => {
  app?.unmount();
  app = undefined;
  vi.useRealTimers();
});

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const items = FALLBACK_CATALOG.items;
const pledges = generatedHangar(FALLBACK_CATALOG, 'key-a', TODAY, NOW);
const marked = [justBoughtOf(pledges)!];

interface Calls {
  discard: number;
  refreshCart: number;
  recalculate: number;
}

/** The card's state for a stage, as `useRunningPlan` gives it, with its actions counted. */
function stateOf(
  stage: Exclude<RunningPlanStage, 'none'>,
  { bulkMelting = true, demo = false } = {},
): { state: RunningPlanState; calls: Calls } {
  const built = demoRunningPlan(stage, { pledges, items, now: NOW, marked })!;
  const plan = built.plan!;
  const cart: CartState = built.inputs.cart
    ? { status: 'read', lines: built.inputs.cart, at: 0 }
    : { status: 'unread' };
  const view = runningPlanSteps({
    plan,
    pledges,
    storeItems: items,
    credit: built.inputs.credit,
    cart,
    bulkMelting,
    useFillers: true,
    demo,
    now: NOW,
  });
  const calls: Calls = { discard: 0, refreshCart: 0, recalculate: 0 };
  const state: RunningPlanState = {
    plan: computed(() => plan),
    view: computed(() => view),
    completed: computed(() => []),
    cart: computed(() => cart),
    readingCart: shallowRef(false),
    loading: computed(() => false),
    credit: computed(() => built.inputs.credit),
    recalculation: computed(() => undefined),
    refreshCart: async () => void calls.refreshCart++,
    refreshCredit: async () => undefined,
    recordMelted: async () => undefined,
    recalculate: async () => {
      calls.recalculate++;
      return true;
    },
    discard: async () => void calls.discard++,
  };
  return { state, calls };
}

async function mount(component: object, props: Record<string, unknown>, { demo = false } = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({ setup: () => () => h(component, props) });
  // The demo mode as App.vue provides it: its buttons stay disabled.
  if (demo) app.provide(DEMO_CONTEXT, shallowRef({} as DemoContext));
  app.mount(root);
  await nextTick();
  return root;
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const states = (root: HTMLElement) =>
  [...root.querySelectorAll('.shm-run-step')].map((li) =>
    ['done', 'current', 'next', 'wait'].find((state) => li.classList.contains(`is-${state}`)),
  );
const current = (root: HTMLElement) => root.querySelector<HTMLElement>('[aria-current="step"]')!;
const buttons = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>('button')];
const button = (root: Element, label: string) =>
  buttons(root).find((b) => b.textContent?.includes(label));

describe('PaintRunningPlan (#245)', () => {
  const STATES: Record<Exclude<RunningPlanStage, 'none'>, string[]> = {
    cart: ['done', 'current', 'next', 'next'],
    credit: ['done', 'current', 'next', 'next'],
    pay: ['done', 'done', 'current', 'next'],
    meltOld: ['done', 'current', 'wait'],
    wait: ['done', 'done', 'done', 'wait'],
    fillers: ['done', 'done', 'done', 'current'],
  };

  it.each(Object.entries(STATES))(
    'shows the stage %s as one list of steps',
    async (stage, expected) => {
      const { state } = stateOf(stage as Exclude<RunningPlanStage, 'none'>);
      const root = await mount(PaintRunningPlan, { running: state, pledges });
      expect(states(root)).toEqual(expected);
      // The rail has a part per step, in the same states.
      const rail = [...root.querySelectorAll('.shm-run-rail-part')];
      expect(rail.map((part) => part.className.replace('shm-run-rail-part is-', ''))).toEqual(
        expected,
      );
      // Exactly one step is the current one for assistive technology, and it has a body.
      expect(root.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
      expect(current(root).querySelector('.shm-run-body')).not.toBeNull();
      const view = state.view.value!;
      expect(text(root.querySelector('.shm-run-title'))).toBe(
        `Running plan · ${view.way === 'buy' ? 'Buy first' : 'Melt first'}`,
      );
      expect(text(root.querySelector('.shm-run-summary'))).toContain(
        `${view.doneCount} of ${view.steps.length} steps done`,
      );
      expect(text(root.querySelector('.shm-run-number, .shm-run-num'))).toBe(
        view.way === 'buy' ? '1' : '2',
      );
    },
  );

  it('asks for the missing paints of the cart', async () => {
    const root = await mount(PaintRunningPlan, { running: stateOf('cart').state, pledges });
    const step = current(root);
    expect(text(step)).toContain('Fill the cart and check it');
    expect(text(step)).toMatch(/paints? (are|is) not in the cart/);
    expect(step.querySelector('.shm-run-paint.is-missing')).not.toBeNull();
    expect(text(button(step, 'into the cart'))).toMatch(/missing paints? into the cart/);
  });

  it('offers to recalculate when the store credit is short, and the pay button waits', async () => {
    const { state, calls } = stateOf('credit');
    const root = await mount(PaintRunningPlan, { running: state, pledges });
    const step = current(root);
    expect(text(step)).toContain('Not enough store credit');
    expect(text(step)).toContain('Store credit was spent elsewhere');
    expect(button(step, 'with store credit')?.disabled).toBe(true);
    button(step, 'Recalculate')!.click();
    await nextTick();
    expect(calls.recalculate).toBe(1);
  });

  it('opens RSI’s cart to pay, and checks nothing out', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const root = await mount(PaintRunningPlan, { running: stateOf('pay').state, pledges });
    const step = current(root);
    expect(text(step)).toContain('Store credit is enough');
    expect(text(step)).toContain('left after paying');
    expect(text(step)).toContain('finds the new paints on the next refresh');
    button(step, 'Go to the cart and pay')!.click();
    expect(open).toHaveBeenCalledWith('/store/pledge/cart', '_blank');
    open.mockRestore();
  });

  it('melts the old paints with bulk melting, or points to its setting', async () => {
    const root = await mount(PaintRunningPlan, { running: stateOf('meltOld').state, pledges });
    const step = current(root);
    expect(text(step)).toMatch(/Melt your (\d+ old paints|old paint)/);
    expect(text(step)).toContain('Only the copies bought before');
    expect(text(step)).toContain('Bulk melting (experimental)');
    // The fillers wait for RSI's cooldown, after the old paints.
    expect(text(root.querySelector('.shm-run-step.is-wait'))).toContain('ready in');
    const melt = button(step, 'Melt the')!;
    expect(melt.disabled).toBe(false);
    melt.click();
    await nextTick();
    expect(document.querySelector('.shm-action-dialog')).not.toBeNull();
    app?.unmount();

    const off = await mount(PaintRunningPlan, {
      running: stateOf('meltOld', { bulkMelting: false }).state,
      pledges,
    });
    expect(button(current(off), 'Bulk melting disabled')).toBeDefined();
    expect(text(current(off))).not.toContain('Bulk melting (experimental)');
  });

  it('counts down RSI’s cooldown of the fillers', async () => {
    const root = await mount(PaintRunningPlan, { running: stateOf('wait').state, pledges });
    const step = current(root);
    expect(step.classList.contains('is-wait')).toBe(true);
    const bar = step.querySelector('[role="progressbar"]')!;
    const value = Number(bar.getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
    expect(bar.getAttribute('aria-valuetext')).toMatch(/hr|min/);
    expect(text(step)).toContain('until RSI allows melting');
    expect(button(step, 'Melt the')?.disabled).toBe(true);
  });

  it('melts the fillers once the 24 hours are over', async () => {
    const root = await mount(PaintRunningPlan, { running: stateOf('fillers').state, pledges });
    const step = current(root);
    expect(text(step)).toContain('The 24 hours are over');
    expect(step.querySelectorAll('.shm-run-filler').length).toBeGreaterThan(0);
    expect(button(step, 'Melt the')?.disabled).toBe(false);
  });

  it('keeps the cart and pay buttons disabled in the demo', async () => {
    const pay = await mount(
      PaintRunningPlan,
      { running: stateOf('pay', { demo: true }).state, pledges },
      { demo: true },
    );
    expect(button(current(pay), 'with store credit')?.disabled).toBe(true);
    app?.unmount();

    const cart = await mount(
      PaintRunningPlan,
      { running: stateOf('cart', { demo: true }).state, pledges },
      { demo: true },
    );
    expect(button(current(cart), 'into the cart')?.disabled).toBe(true);
  });

  it('discards the plan only after asking', async () => {
    const { state, calls } = stateOf('cart');
    const root = await mount(PaintRunningPlan, { running: state, pledges });
    const discard = root.querySelector<HTMLButtonElement>('.shm-run-discard')!;
    discard.click();
    await nextTick();
    expect(text(root.querySelector('.shm-consultant-confirm'))).toContain(
      'Discard the running plan?',
    );
    // Cancel has the focus, so Return never discards by accident.
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
    button(root.querySelector('.shm-consultant-confirm')!, 'Cancel')!.click();
    await nextTick();
    expect(root.querySelector('.shm-consultant-confirm')).toBeNull();
    expect(calls.discard).toBe(0);

    discard.click();
    await nextTick();
    button(root.querySelector('.shm-consultant-confirm')!, 'Discard plan')!.click();
    await nextTick();
    expect(calls.discard).toBe(1);
    expect(root.querySelector('.shm-consultant-confirm')).toBeNull();
  });
});

describe('PaintCompletedPlans (#245)', () => {
  const plans = demoCompletedPlans(items, NOW);

  it('shows the newest plan open and opens the others on request', async () => {
    expect(plans.length).toBeGreaterThan(1);
    const root = await mount(PaintCompletedPlans, { plans });
    const toggles = [...root.querySelectorAll<HTMLButtonElement>('.shm-completed-toggle')];
    expect(toggles).toHaveLength(plans.length);
    expect(toggles.map((t) => t.getAttribute('aria-expanded'))).toEqual(
      plans.map((_, i) => String(i === 0)),
    );
    expect(root.querySelectorAll('.shm-completed-body')).toHaveLength(1);
    expect(text(root.querySelector('.shm-completed-total'))).toContain(`${plans.length} plans`);

    const body = root.querySelector('.shm-completed-body')!;
    expect(text(body)).toContain('Melted');
    expect(text(body)).toContain('Bought');
    expect(text(body)).toContain('Discount reached');
    expect(body.querySelector('.shm-choose-tier.is-chosen')).not.toBeNull();
    expect(toggles[0]!.getAttribute('aria-controls')).toBe(body.id);

    toggles[1]!.click();
    await nextTick();
    expect(toggles[1]!.getAttribute('aria-expanded')).toBe('true');
    toggles[0]!.click();
    await nextTick();
    expect(toggles[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelectorAll('.shm-completed-body')).toHaveLength(1);
  });
});
