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
  const all = { ...DEFAULT_SETTINGS, ...settings };
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

    it('waits until the paints were put into the cart', async () => {
      const pledges = await storeExample();
      const root = await render(pledges, { bulkMelting: true });
      expect(meltButton(root)?.disabled).toBe(true);
      app?.unmount();

      await storePlan(pledges.map((pledge) => pledge.id));
      const ready = await render(pledges, { bulkMelting: true });
      expect(meltButton(ready)?.disabled).toBe(false);
      expect(meltButton(ready)?.textContent).toContain('Melt the 5 own paints');
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
});
