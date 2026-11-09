// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, h, nextTick, type App } from 'vue';
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView } from '@/hangar/pledge-view';
import { DEFAULT_SETTINGS, type Settings } from '@/settings/settings';
import { storeItemsItem, STORE_ITEMS_VERSION } from '../items/store-items-storage';
import type { StoreItem } from '../items/store-items';
import { providePaintConsultant } from '../paint-consultant/use-paint-consultant';
import { rebuyPlanItem, REBUY_PLAN_VERSION } from '../paint-consultant/rebuy-plan-storage';
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

async function render(pledges: ReturnType<typeof paint>[], settings: Partial<Settings> = {}) {
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
      });
      return () => h(PaintConsultant, { settings: all });
    },
  });
  app.mount(root);
  // The stored values are read asynchronously.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
  return root;
}

/** The plan kept when the paints were put into the cart (#103). */
const storePlan = (pledgeIds: number[], at = Date.now()) =>
  rebuyPlanItem.setValue({
    version: REBUY_PLAN_VERSION,
    at,
    tier: { paints: 10, percent: 35 },
    own: pledgeIds.map((pledgeId) => ({ pledgeId, title: '', skuId: 1, meltValue: 5 })),
    fillers: [],
    cartCost: 0,
  });

const text = (root: HTMLElement) => root.textContent?.replace(/\s+/g, ' ') ?? '';

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

  describe('melting the own paints (#104)', () => {
    const meltButton = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLButtonElement>('.shm-consultant-cart button')].find((b) =>
        b.textContent?.includes('Melt the'),
      );

    it('is only offered with bulk melting on, otherwise a button leads to the setting', async () => {
      const root = await render(await storeExample());
      expect(meltButton(root)).toBeUndefined();
      const toSetting = [...root.querySelectorAll('.shm-consultant-cart button')].find((b) =>
        b.textContent?.includes('Bulk melting disabled'),
      );
      expect(toSetting).toBeDefined();
    });

    it('melts after the cart was filled, or first with its own acknowledgement (#168)', async () => {
      const pledges = await storeExample();
      const first = await render(pledges, { bulkMelting: true });
      expect(meltButton(first)?.disabled).toBe(false);
      expect(meltButton(first)?.textContent).toContain('Melt the 5 own paints first');
      meltButton(first)!.click();
      await nextTick();
      expect(document.querySelector('.shm-action-dialog')?.textContent).toContain(
        'I melt these paints before buying them again',
      );
      app?.unmount();

      await storePlan(pledges.map((pledge) => pledge.id));
      const ready = await render(pledges, { bulkMelting: true });
      expect(meltButton(ready)?.textContent?.trim()).toBe('Melt the 5 own paints');
    });

    it('asks to confirm the checked cart in the dialog, besides the other acknowledgements', async () => {
      const pledges = await storeExample();
      await storePlan(pledges.map((pledge) => pledge.id));
      const root = await render(pledges, { bulkMelting: true });
      meltButton(root)!.click();
      await nextTick();
      const dialog = document.querySelector('.shm-action-dialog')!;
      expect(dialog.textContent).toContain('checked it there');
      const submit = dialog.querySelector<HTMLButtonElement>('.shm-action-submit')!;
      // Without every acknowledgement and the password nothing can be sent.
      expect(submit.disabled).toBe(true);
    });
  });

  it('shows paints bought again with the melt step left open (#139)', async () => {
    const pledges = await storeExample();
    // The first own paint ($5) was bought again with 35 %: a younger copy for $3.25.
    const copy = paint(999, 'Own 0 Paint', 3.25);
    // Confirmed by the plan kept when its paints were put into the cart.
    await storePlan([pledges[0]!.id], new Date(2026, 10, 9).getTime());
    const root = await render([...pledges, { ...copy, createdAt: '2026-11-09' }]);
    const section = root.querySelector('.shm-consultant-rebought');
    expect(section?.textContent).toContain('Bought again, left to melt (1)');
    expect(section?.textContent).toContain('Bought with the volume discount on 2026-11-09');
    expect(section?.textContent).toContain('Melt the old paint without the discount: $5');
    // Bulk melting is off by default: a button leads to the setting.
    expect(section?.textContent).toContain('Bulk melting disabled');
    // The old pledge isn't planned again: the plan has the other four.
    expect(text(root)).toContain('Your paints to melt and buy again (4)');
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

  it('lists the paints melted first that are left to buy again (#168)', async () => {
    const pledges = await storeExample(40);
    // Two own paints of a kept plan are gone from the hangar: melted first.
    await storePlan(pledges.map((pledge) => pledge.id));
    const root = await render(pledges.slice(2));
    const section = root.querySelector('.shm-consultant-pending');
    expect(section?.textContent).toContain('Melted, left to buy again (2)');
    // $40 of store credit: 2 × $5 + 8 cheap paints × $3 at 35 % = $22.10.
    expect(section?.textContent).toContain(
      'Buy them again with 35% discount: 10 paints for $22.10',
    );
    expect(section?.querySelector('.shm-consultant-cart button')?.textContent).toContain(
      'Put the 10 paints into the cart',
    );
  });
  describe('both ways side by side (the default layout)', () => {
    const cards = { paintConsultant: DEFAULT_SETTINGS.paintConsultant };
    const way = (root: HTMLElement, kind: 'buy' | 'melt') =>
      root.querySelector<HTMLElement>(`.shm-way.is-${kind}`)!;
    const buttons = (root: HTMLElement) => [...root.querySelectorAll<HTMLButtonElement>('button')];

    it('is the default and shows the same result for both ways', async () => {
      expect(DEFAULT_SETTINGS.paintConsultant.layout).toBe('ways');
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
      expect(text(way(root, 'buy'))).toContain('Put the 5 paints into the cart');
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
      expect(text(way(root, 'melt'))).toContain('Fill the cart and save the plan');
    });

    it('offers melting first only after the cart was filled', async () => {
      const pledges = await storeExample(1);
      const settings = { ...cards, bulkMelting: true };
      const before = await render(pledges, settings);
      expect(buttons(way(before, 'melt')).some((b) => b.textContent?.includes('Melt the'))).toBe(
        false,
      );
      app?.unmount();

      await storePlan(pledges.map((pledge) => pledge.id));
      const after = await render(pledges, settings);
      const melt = buttons(way(after, 'melt')).find((b) => b.textContent?.includes('Melt the 5'));
      melt!.click();
      await nextTick();
      expect(document.querySelector('.shm-action-dialog')?.textContent).toContain(
        'checked it there',
      );
    });
  });
});
