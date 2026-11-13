// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, h, nextTick, shallowRef, type App } from 'vue';
import { DEMO_CONTEXT, type DemoContext } from '@/demo/use-demo';
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView } from '@/hangar/pledge-view';
import { DEFAULT_SETTINGS, settingsItem, type Settings } from '@/settings/settings';
import { storeItemsItem, STORE_ITEMS_VERSION } from '../items/store-items-storage';
import type { StoreItem } from '../items/store-items';
import { providePaintConsultant } from '../paint-consultant/use-paint-consultant';
import {
  demoRebuyPlanItem,
  rebuyPlanItem,
  REBUY_PLAN_VERSION,
} from '../paint-consultant/rebuy-plan-storage';
import PaintConsultant from './PaintConsultant.vue';

let app: App | undefined;
afterEach(() => app?.unmount());
beforeEach(() => fakeBrowser.reset());

const item = (id: number, name: string, price: number): StoreItem => ({
  id,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
});

const paint = (id: number, name: string, valueUsd: number, isGiftable = false) =>
  toPledgeView({
    id,
    name: `Paints - ${name}`,
    title: `Paints - ${name}`,
    value: `$${valueUsd} USD`,
    valueUsd,
    isExchangeable: true,
    isGiftable,
    isUpgraded: false,
    items: [{ title: name, kind: 'Skin' }],
  } as unknown as Pledge);

/** The example of #95: 5 own paints at $5 without discount, cheap paints at $3. */
async function storeExample(credit = 1) {
  const own = Array.from({ length: 5 }, (_, i) => item(i + 1, `Own ${i} Paint`, 5));
  const cheap = Array.from({ length: 5 }, (_, i) => item(i + 10, `Cheap ${i} Paint`, 3));
  await storeItemsItem.setValue({ version: STORE_ITEMS_VERSION, items: [...own, ...cheap] });
  await storeCreditItem.setValue({
    version: STORE_CREDIT_VERSION,
    credit: { amount: credit, currency: 'USD' },
  } as never);
  return own.map((paintItem) => paint(100 + paintItem.id, paintItem.name, 5));
}

async function render(
  pledges: ReturnType<typeof paint>[],
  settings: Partial<Settings> = {},
  withoutNewPlan = false,
  /** In the demo mode: its context, with nothing but what the consultant needs. */
  demo = false,
) {
  const root = document.createElement('div');
  // The tests below see the table layout unless they ask for the cards.
  const all = {
    ...DEFAULT_SETTINGS,
    paintConsultant: { ...DEFAULT_SETTINGS.paintConsultant, layout: 'table' as const },
    ...settings,
  };
  // As App.vue does: the result is provided to the consultant.
  app = createApp({
    setup() {
      providePaintConsultant({
        pledges: () => pledges,
        settings: () => all,
        demoStoreCredit: () => undefined,
        demoWithoutNewPlan: () => withoutNewPlan,
      });
      return () => h(PaintConsultant, { settings: all });
    },
  });
  if (demo) app.provide(DEMO_CONTEXT, shallowRef({ events: [] } as unknown as DemoContext));
  app.mount(root);
  // The stored values are read asynchronously.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
  return root;
}

/** The plan kept when the paints were put into the cart (#103). */
const storePlan = (pledgeIds: number[], at = Date.now(), way: 'buy' | 'melt' = 'melt') =>
  rebuyPlanItem.setValue({
    version: REBUY_PLAN_VERSION,
    way,
    at,
    tier: { paints: 10, percent: 35 },
    own: pledgeIds.map((pledgeId) => ({ pledgeId, title: '', skuId: 1, meltValue: 5 })),
    fillers: [],
    cartCost: 0,
  });

const text = (root: Element) => root.textContent?.replace(/\s+/g, ' ') ?? '';

describe('PaintConsultant', () => {
  it('shows the plan with the real values', async () => {
    const root = await render(await storeExample());

    expect(text(root)).toContain('35% for 10 paints');
    expect(text(root)).toContain('$8.75 (35% of the melt value)');
    expect(text(root)).toContain('× 0.65 = $26');
    expect(root.querySelectorAll('.shm-consultant-table')).toHaveLength(2);
    expect(root.querySelector('a[href*="Reclaim-a-Pledge"]')).not.toBeNull();
  });

  it('counts only the own paints without filler paints', async () => {
    const pledges = await storeExample();
    const root = await render(pledges, {
      paintConsultant: {
        useStoreCredit: true,
        useFillers: false,
        skipGiftable: true,
        reboughtDetection: 'plan',
        layout: 'table',
      },
    });
    // Without fillers, 5 own paints reach 25 % and the melt value pays for it.
    expect(text(root)).toContain('25% for 5 paints');
  });

  it('hides everything while the melt value is hidden', async () => {
    const root = await render(await storeExample(), { hideMeltValue: true });
    expect(root.querySelector('.shm-consultant-plan')).toBeNull();
    expect(text(root)).toContain('Hide melt value');
  });

  it('offers to read the Pledge Store when its paints are missing', async () => {
    const root = await render([paint(1, 'Own Paint', 5)]);
    expect(root.querySelector('.shm-consultant-state button')).not.toBeNull();
  });

  it('leaves out giftable paints by default, or marks them', async () => {
    const pledges = (await storeExample()).map((view, i) => ({ ...view, isGiftable: i < 2 }));

    const skipped = await render(pledges);
    expect(text(skipped)).toContain('2 giftable paints that would gain are left out');
    expect(skipped.querySelector('.shm-consultant-tag')).toBeNull();
    app?.unmount();

    const marked = await render(pledges, {
      paintConsultant: {
        useStoreCredit: true,
        useFillers: true,
        skipGiftable: false,
        reboughtDetection: 'plan',
        layout: 'table',
      },
    });
    expect(marked.querySelectorAll('.shm-consultant-tag')).toHaveLength(2);
  });

  describe('starting a plan (#317)', () => {
    const buttonsOf = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLButtonElement>('#shm-consultant-panel-new button')].map(
        (button) => text(button).trim(),
      );
    const startButton = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLButtonElement>('.shm-consultant-cart button')].find((b) =>
        b.textContent?.includes('Start plan'),
      );

    it('offers only "Start plan", no cart or melt button, and no plan runs before', async () => {
      const root = await render(await storeExample(), { bulkMelting: true });
      expect(startButton(root)).toBeDefined();
      expect(buttonsOf(root).some((label) => /cart|Melt the/i.test(label))).toBe(false);
      expect(await rebuyPlanItem.getValue()).toBeNull();
      expect(root.querySelector('.shm-run')).toBeNull();
    });

    it('keeps the plan with its way and store credit, and runs it from its first step', async () => {
      const pledges = await storeExample(40);
      const root = await render(pledges);
      startButton(root)!.click();
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await nextTick();
      }
      const stored = await rebuyPlanItem.getValue();
      expect(stored).toMatchObject({ way: 'melt', creditAtStart: 40 });
      expect(stored?.own.map((paint) => paint.pledgeId).sort()).toEqual(
        pledges.map((pledge) => pledge.id).sort(),
      );
      // The running plan of melting first, at its first step with nothing done yet.
      expect(text(root.querySelector('.shm-run-title')!)).toBe('Running plan · Melt first');
      const steps = [...root.querySelectorAll('.shm-run-step')];
      expect(steps[0]?.getAttribute('aria-current')).toBe('step');
      expect(text(steps[0] as HTMLElement)).toContain('Melt your 5 paints');
    });

    it('keeps only the demo’s own plan in the demo (#131)', async () => {
      const pledges = await storeExample(40);
      const root = await render(pledges, {}, false, true);
      startButton(root)!.click();
      await new Promise((resolve) => setTimeout(resolve));
      expect(await rebuyPlanItem.getValue()).toBeNull();
      expect((await demoRebuyPlanItem.getValue())?.own).toHaveLength(5);
    });
  });

  it('shows paints bought again as the running plan with the melt step left (#139, #245)', async () => {
    const pledges = await storeExample();
    // The first own paint ($5) was bought again with 35 %: a younger copy for $3.25.
    const copy = paint(999, 'Own 0 Paint', 3.25);
    // Confirmed by the plan kept when its paints were put into the cart (buying first).
    await storePlan([pledges[0]!.id], new Date(2026, 10, 9).getTime(), 'buy');
    const root = await render([...pledges, { ...copy, createdAt: '2026-11-09' }]);
    const card = root.querySelector('.shm-run')!;
    expect(text(card.querySelector('.shm-run-title')!)).toBe('Running plan · Buy first');
    const steps = [...card.querySelectorAll('.shm-run-step')];
    expect(steps.map((step) => step.className)).toEqual([
      'shm-run-step is-done',
      'shm-run-step is-current has-body',
    ]);
    expect(text(steps[1] as HTMLElement)).toContain('Melt your old paint');
    expect(text(steps[1] as HTMLElement)).toContain('Only the copies bought before');
    // Bulk melting is off by default: a button leads to the setting.
    expect(text(steps[1] as HTMLElement)).toContain('Bulk melting disabled');
    // The old blocks are gone: the running plan is one list of steps.
    expect(root.querySelector('.shm-consultant-rebought')).toBeNull();
    // The running plan and the new plan are tabs (#244), the running one shown first.
    const tabs = [...root.querySelectorAll('.shm-consultant-tabs .shm-tab')];
    expect(tabs.map((tab) => text(tab).trim())).toEqual(['Running plan', 'New plan']);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('.shm-consultant-section-title')).toBeNull();
    // The old pledge isn't planned again: the new plan has the other four, in its hidden tab.
    const newPanel = root.querySelector<HTMLElement>('#shm-consultant-panel-new')!;
    expect(newPanel.style.display).toBe('none');
    expect(text(newPanel)).toContain('Your paints to melt and buy again (4)');
    (tabs[1] as HTMLElement).click();
    await nextTick();
    expect(newPanel.style.display).toBe('');
    expect(root.querySelector<HTMLElement>('#shm-consultant-panel-running')!.style.display).toBe(
      'none',
    );
  });

  it('shows a single tab as a heading, and none without a plan (#244, #306)', async () => {
    const pledges = await storeExample();
    const copy = { ...paint(999, 'Own 0 Paint', 3.25), createdAt: '2026-11-09' };
    await storePlan([pledges[0]!.id], new Date(2026, 10, 9).getTime(), 'buy');
    // The demo without a new plan: only the running plan, under its heading.
    const running = await render([...pledges, copy], {}, true);
    expect(running.querySelector('.shm-consultant-tabs')).toBeNull();
    expect(text(running.querySelector('.shm-consultant-section-title')!)).toBe('Running plan');
    expect(running.querySelector('.shm-run')).not.toBeNull();
    app?.unmount();

    // No plan of any kind: no tab, no heading, the reason instead.
    await rebuyPlanItem.setValue(null);
    const none = await render(pledges, {}, true);
    expect(none.querySelector('.shm-consultant-tabs')).toBeNull();
    expect(none.querySelector('.shm-consultant-section-title')).toBeNull();
    expect(none.querySelector('.shm-consultant-state')).not.toBeNull();
  });

  it('shows a pair without a kept plan only as a guess, with that setting', async () => {
    const pledges = await storeExample();
    const copy = { ...paint(999, 'Own 0 Paint', 3.25), createdAt: '2026-11-09' };
    const safe = await render([...pledges, copy]);
    expect(safe.querySelector('.shm-consultant-rebought')).toBeNull();
    expect(text(safe)).not.toContain('look bought again');
    app?.unmount();

    const guessing = await render([...pledges, copy], {
      paintConsultant: { ...DEFAULT_SETTINGS.paintConsultant, reboughtDetection: 'guess' },
    });
    expect(guessing.querySelector('.shm-consultant-rebought')).toBeNull();
    expect(text(guessing)).toContain('1 paint looks bought again');
  });

  it('shows the paints melted first with the cart left to fill (#168, #245)', async () => {
    const pledges = await storeExample(40);
    // Two own paints of a kept plan are gone from the hangar: melted first.
    await storePlan(pledges.map((pledge) => pledge.id));
    const root = await render(pledges.slice(2), { bulkMelting: true });
    const card = root.querySelector('.shm-run')!;
    expect(text(card.querySelector('.shm-run-title')!)).toBe('Running plan · Melt first');
    const current = card.querySelector<HTMLElement>('[aria-current="step"]')!;
    // Step 1 is partly done: two melted, three left.
    expect(text(current)).toContain('Melt your 5 paints');
    expect(current.querySelectorAll('.shm-run-paint.is-ok')).toHaveLength(2);
    expect(current.querySelectorAll('.shm-run-paint.is-melt')).toHaveLength(3);
    expect(text(current)).toContain('Melt the 3 own paints');
    expect(root.querySelector('.shm-consultant-pending')).toBeNull();
  });

  it('hides the running plan while the melt value is hidden', async () => {
    const pledges = await storeExample();
    await storePlan(pledges.map((pledge) => pledge.id));
    const root = await render(pledges, { hideMeltValue: true });
    expect(root.querySelector('.shm-run')).toBeNull();
  });

  it('asks before a new plan replaces the running plan (#245, #317)', async () => {
    const pledges = await storeExample(40);
    const choose = { paintConsultant: DEFAULT_SETTINGS.paintConsultant };
    const startButton = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLButtonElement>('.shm-choose-detail button')].find((b) =>
        b.textContent?.includes('Start plan'),
      )!;
    // Without a running plan: a single tab, its heading instead of tabs (#244).
    const free = await render(pledges, choose);
    expect(free.querySelector('.shm-run')).toBeNull();
    expect(free.querySelector('.shm-consultant-tabs')).toBeNull();
    expect(text(free.querySelector('.shm-consultant-section-title')!)).toBe('New plan');
    app?.unmount();

    await storePlan([pledges[0]!.id], Date.now(), 'buy');
    const root = await render(pledges, choose);
    const tabs = [...root.querySelectorAll<HTMLElement>('.shm-consultant-tabs .shm-tab')];
    tabs.find((tab) => text(tab).includes('New plan'))!.click();
    await nextTick();
    startButton(root).click();
    await nextTick();
    const confirm = () => root.querySelector('.shm-choose-detail .shm-consultant-confirm');
    expect(text(confirm()!)).toContain('Starting this new plan discards it');
    expect(startButton(root).disabled).toBe(true);
    [...confirm()!.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Cancel'))!
      .click();
    await nextTick();
    expect(confirm()).toBeNull();
    expect((await rebuyPlanItem.getValue())?.own).toHaveLength(1);

    startButton(root).click();
    await nextTick();
    [...confirm()!.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Discard it and start'))!
      .click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(await rebuyPlanItem.getValue()).toMatchObject({ way: 'buy' });
    expect((await rebuyPlanItem.getValue())?.own).toHaveLength(5);
  });

  it('has the option to leave out giftable paints as a switch next to the title', async () => {
    const root = await render(await storeExample(40), {
      paintConsultant: DEFAULT_SETTINGS.paintConsultant,
    });
    const toggle = root.querySelector<HTMLInputElement>(
      '.shm-consultant-head-side input[role="switch"]',
    )!;
    expect(toggle.classList.contains('shm-switch')).toBe(true);
    expect(toggle.checked).toBe(DEFAULT_SETTINGS.paintConsultant.skipGiftable);
    expect(text(toggle.closest('label')!)).toBe('Leave out giftable paints');
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve));
    const stored = await settingsItem.getValue();
    expect(stored?.paintConsultant?.skipGiftable).toBe(
      !DEFAULT_SETTINGS.paintConsultant.skipGiftable,
    );
  });

  describe('both ways side by side', () => {
    const cards = {
      paintConsultant: { ...DEFAULT_SETTINGS.paintConsultant, layout: 'ways' as const },
    };
    const way = (root: HTMLElement, kind: 'buy' | 'melt') =>
      root.querySelector<HTMLElement>(`.shm-way.is-${kind}`)!;
    const buttons = (root: HTMLElement) => [...root.querySelectorAll<HTMLButtonElement>('button')];

    it('shows the same result for both ways', async () => {
      const root = await render(await storeExample(40), cards);
      expect(root.querySelector('.shm-consultant-table')).toBeNull();
      expect(text(root)).toContain('Same result on both ways');
      expect(text(root)).toContain('Two ways to the same +$8.75');
      expect(root.querySelectorAll('.shm-ways-paint')).toHaveLength(10);
      expect(text(way(root, 'buy'))).toContain('Recommended');
      // Paid first: $40 − $26, then the melt value and the fillers: $48.75 in the end.
      expect(text(way(root, 'buy'))).toContain('$14');
      expect(text(way(root, 'buy'))).toContain('$48.75');
      expect(text(way(root, 'melt'))).toContain('No advantage here');
      expect(root.querySelector('.shm-ways-why')).toBeNull();
      expect(root.querySelector('.shm-ways-chart svg')).not.toBeNull();
    });

    it('buys first at a lower tier when the store credit pays only that one', async () => {
      // $20: the 35 % cart costs $26, the 25 % one ($25 × 0.75) $18.75.
      const root = await render(await storeExample(20), cards);
      expect(text(root)).toContain('Two ways – with $20 both work, at different discounts');
      expect(text(way(root, 'buy'))).toContain('25%');
      expect(text(way(root, 'buy'))).toContain('Start plan');
      expect(text(way(root, 'melt'))).toContain('35%');
      expect(root.querySelectorAll('.shm-ways-formulas > span')).toHaveLength(2);
      expect(text(root.querySelector('.shm-ways-why')!)).toContain('35% would cost $26');
    });

    it("can't buy first without enough store credit", async () => {
      const root = await render(await storeExample(1), cards);
      expect(text(root)).toContain('Two ways – with $1 only one works');
      expect(text(way(root, 'buy'))).toContain('Not possible');
      const needs = buttons(way(root, 'buy')).find((b) => b.textContent?.includes('Needs $25'));
      expect(needs?.disabled).toBe(true);
      expect(text(way(root, 'melt'))).toContain('Fill the cart and check it');
    });

    it('offers "Start plan" on each way that works, no cart or melt button (#317)', async () => {
      const pledges = await storeExample(1);
      await storePlan(pledges.map((pledge) => pledge.id));
      const root = await render(pledges, { ...cards, bulkMelting: true });
      const labels = (kind: 'buy' | 'melt') =>
        buttons(way(root, kind)).map((button) => text(button).trim());
      expect(labels('melt')).toEqual(['Start plan']);
      expect(labels('buy')).toEqual(['Needs $25 more store credit']);
    });
  });

  describe('choosing a way (the default layout, #246)', () => {
    const choose = { paintConsultant: DEFAULT_SETTINGS.paintConsultant };
    const choice = (root: HTMLElement, kind: 'buy' | 'melt') =>
      root.querySelector<HTMLButtonElement>(`.shm-choose-way.is-${kind}`)!;
    const detail = (root: HTMLElement) => root.querySelector<HTMLElement>('.shm-choose-detail')!;
    const cart = (root: HTMLElement) => text(root.querySelector('#shm-choose-cart-title')!);

    it('is the default and chooses buying first where it works', async () => {
      expect(DEFAULT_SETTINGS.paintConsultant.layout).toBe('choose');
      const root = await render(await storeExample(40), choose);
      expect(root.querySelector('.shm-consultant-table')).toBeNull();
      expect(root.querySelector('.shm-way')).toBeNull();
      expect(text(root.querySelector('.shm-consultant-credit')!)).toContain('$40');
      expect(choice(root, 'buy').getAttribute('aria-pressed')).toBe('true');
      expect(choice(root, 'melt').getAttribute('aria-pressed')).toBe('false');
      expect(text(choice(root, 'buy'))).toContain('Recommended');
      expect(text(choice(root, 'buy'))).toContain('+$8.75');
      expect(text(choice(root, 'buy'))).toContain('35% · 10 paints · $26 upfront');
      // Paid first: $40 − $26, then the melt value and the fillers: $48.75 in the end.
      expect(text(detail(root))).toContain('Pay with store credit');
      expect(text(detail(root))).toContain('$14');
      expect(text(detail(root))).toContain('$48.75 · +$8.75');
      expect(text(detail(root))).toContain('Start plan');
      expect(text(detail(root))).not.toContain('into the cart');
      expect(cart(root)).toBe('Cart · 10 paints at 35%');
      expect(root.querySelectorAll('.shm-ways-paint')).toHaveLength(10);
    });

    it('shows the steps, the cart and its paints of the way chosen', async () => {
      // $20: the 35 % cart costs $26, the 25 % one ($25 × 0.75) $18.75.
      const root = await render(await storeExample(20), choose);
      expect(cart(root)).toBe('Cart · 5 paints at 25%');
      expect(root.querySelectorAll('.shm-ways-paint.is-out')).toHaveLength(5);
      expect(root.querySelector('.shm-choose-tier.is-other')?.textContent).toContain('35%');

      choice(root, 'melt').click();
      await nextTick();
      expect(choice(root, 'melt').getAttribute('aria-pressed')).toBe('true');
      expect(cart(root)).toBe('Cart · 10 paints at 35%');
      expect(root.querySelectorAll('.shm-ways-paint.is-out')).toHaveLength(0);
      expect(text(detail(root))).toContain('Fill the cart and check it');
      expect(text(detail(root))).toContain('Your paints leave the hangar first');
      expect(root.querySelector('.shm-choose-tier.is-other')?.textContent).toContain('25%');
    });

    it("can't choose buying first without enough store credit and says why", async () => {
      const root = await render(await storeExample(1), choose);
      expect(choice(root, 'buy').disabled).toBe(true);
      expect(text(choice(root, 'buy'))).toContain('Not possible');
      expect(text(choice(root, 'buy'))).toContain('Needs $25 more store credit');
      expect(choice(root, 'melt').getAttribute('aria-pressed')).toBe('true');
      expect(text(detail(root))).toContain('Fill the cart and check it');
    });

    it('offers "Start plan" only, also with bulk melting on (#317)', async () => {
      const pledges = await storeExample(1);
      await storePlan(pledges.map((pledge) => pledge.id));
      const root = await render(pledges, { ...choose, bulkMelting: true });
      const labels = [...detail(root).querySelectorAll('.shm-way-actions button')].map((b) =>
        text(b).trim(),
      );
      expect(labels).toEqual(['Start plan']);
    });
  });
});
