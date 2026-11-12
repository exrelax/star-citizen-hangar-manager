// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file -- a provider and the card below it, as in App.vue */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, defineComponent, h, nextTick, type App } from 'vue';
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView } from '@/hangar/pledge-view';
import { DEFAULT_SETTINGS } from '@/settings/settings';
import { storeItemsItem, STORE_ITEMS_VERSION } from '../items/store-items-storage';
import type { StoreItem } from '../items/store-items';
import { readCart } from './cart';
import {
  currentPlanOf,
  rebuyPlanItem,
  REBUY_PLAN_VERSION,
  type StoredRebuyPlan,
} from './rebuy-plan-storage';
import { providePaintConsultant } from './use-paint-consultant';
import { useRunningPlan, type RunningPlanState } from './use-running-plan';

vi.mock('./cart', async (original) => ({
  ...(await original<typeof import('./cart')>()),
  readCart: vi.fn(),
}));

let app: App | undefined;
afterEach(() => app?.unmount());
beforeEach(() => {
  fakeBrowser.reset();
  vi.mocked(readCart).mockReset();
});

const item = (id: number, name: string, price: number): StoreItem => ({
  id,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
});

const paint = (id: number, name: string, valueUsd: number) =>
  toPledgeView({
    id,
    name: `Paints - ${name}`,
    title: `Paints - ${name}`,
    value: `${valueUsd} USD`,
    valueUsd,
    isExchangeable: true,
    isGiftable: false,
    isUpgraded: false,
    items: [{ title: name, kind: 'Skin' }],
    createdAt: '2025-01-01',
  } as unknown as Pledge);

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount(pledges: ReturnType<typeof paint>[], active = true) {
  await storeItemsItem.setValue({
    version: STORE_ITEMS_VERSION,
    items: [item(1, 'Own Paint', 5), item(20, 'Cheap Paint', 3)],
  });
  await storeCreditItem.setValue({
    version: STORE_CREDIT_VERSION,
    credit: { amount: 20, currency: 'USD' },
  } as never);
  let state: RunningPlanState | undefined;
  // As in the manager: the consultant is provided above the card.
  const Card = defineComponent({
    setup() {
      state = useRunningPlan({ settings: () => DEFAULT_SETTINGS, active: () => active });
      return () => null;
    },
  });
  app = createApp({
    setup() {
      providePaintConsultant({
        pledges: () => pledges,
        settings: () => DEFAULT_SETTINGS,
        demoStoreCredit: () => undefined,
      });
      return () => h(Card);
    },
  });
  app.mount(document.createElement('div'));
  await settle();
  return state!;
}

const plan: StoredRebuyPlan = {
  version: REBUY_PLAN_VERSION,
  way: 'buy',
  at: Date.now(),
  tier: { paints: 2, percent: 15 },
  own: [{ pledgeId: 100, title: 'Paints - Own Paint', skuId: 1, meltValue: 5, price: 5 }],
  fillers: [{ skuId: 20, name: 'Cheap Paint', quantity: 1, price: 3 }],
  cartCost: 6.8,
};

describe('useRunningPlan', () => {
  it('reads the cart once while a step needs it and the tab is shown', async () => {
    vi.mocked(readCart).mockResolvedValue([{ skuId: 1, qty: 1 }]);
    await rebuyPlanItem.setValue(plan);
    const state = await mount([paint(100, 'Own Paint', 5)]);
    await wait(450);
    await settle();
    expect(readCart).toHaveBeenCalledTimes(1);
    expect(state.cart.value).toMatchObject({ status: 'read', lines: [{ skuId: 1, qty: 1 }] });
    expect(state.view.value?.steps[0]?.body?.actions[0]).toMatchObject({ kind: 'fillCart' });
  });

  it("doesn't read the cart while the tab is hidden; a failed read becomes a state", async () => {
    vi.mocked(readCart).mockRejectedValue(new Error('Not signed in'));
    await rebuyPlanItem.setValue(plan);
    const state = await mount([paint(100, 'Own Paint', 5)], false);
    await wait(450);
    expect(readCart).not.toHaveBeenCalled();
    await state.refreshCart();
    expect(state.cart.value).toMatchObject({ status: 'failed', reason: 'Not signed in' });
  });

  it('records melts and discards the plan without keeping it', async () => {
    await rebuyPlanItem.setValue(plan);
    const state = await mount([paint(100, 'Own Paint', 4.5)], false);
    await state.recordMelted([100]);
    expect(currentPlanOf(await rebuyPlanItem.getValue())?.own[0]).toMatchObject({ freed: 4.5 });
    await state.discard();
    expect(await rebuyPlanItem.getValue()).toBeNull();
    await settle();
    expect(state.view.value).toBeUndefined();
  });
});
