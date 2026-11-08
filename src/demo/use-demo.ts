import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import type { Order } from '@/orders/orders';
import { computed, inject, onMounted, shallowRef, type InjectionKey, type Ref } from 'vue';
import type { StoreCredit } from '@/account/store-credit';
import {
  createFakeIds,
  demoBuyback,
  demoHangar,
  demoPurchaseTime,
  demoStoreCredit,
  demoUpgradeLog,
  justBoughtOf,
} from './demo';
import type { UpgradeLogEntry } from '@/hangar/upgrade-log';

/** Random key of the demo, created on first use and kept only in this browser. */
const demoKeyItem = storage.defineItem<string | null>('local:demo.key', { fallback: null });

async function demoKey(): Promise<string> {
  let key = await demoKeyItem.getValue();
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    key = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    await demoKeyItem.setValue(key);
  }
  return key;
}

/** What the rows need to know in the demo; `null` outside of it. */
export interface DemoContext {
  /** Made-up id for a real pledge or order id, e.g. of an applied CCU. */
  fakeId: (id: number | string) => string;
  /**
   * The real order behind a made-up order id, to load its details. Only kept in memory: the
   * details are anonymized before they are shown (see `anonymizeOrderDetails`).
   */
  realOrder: (fakeOrderId: string) => Order | undefined;
  /** The applied CCUs of a pledge with made-up dates after its demo purchase date. */
  upgradeLog: (
    pledgeId: number,
    createdAt: string | undefined,
    entries: readonly UpgradeLogEntry[],
  ) => UpgradeLogEntry[];
  /** The store credit shown instead of the account's. */
  storeCredit: StoreCredit;
  /**
   * The pledge shown as bought a few hours ago (see `justBoughtOf`) and its made-up purchase time
   * ("2026-11-08T15:00"), for the countdown of a mark to melt.
   */
  justBought?: { pledgeId: number; at: string };
}

export const DEMO_CONTEXT: InjectionKey<Ref<DemoContext | null>> = Symbol('shm-demo');

/** The demo context provided by the manager view (`null` outside the demo). */
export function useDemoContext(): Ref<DemoContext | null> {
  return inject(DEMO_CONTEXT, shallowRef(null));
}

/**
 * The demo variants of the lists, built from the real ones while `active` (the demo mode
 * setting; the selection is only computed when it is on).
 */
export function useDemo(
  active: Readonly<Ref<boolean>>,
  pledges: Ref<PledgeView[]>,
  buyback: Ref<BuybackView[]>,
) {
  const key = shallowRef<string>();
  onMounted(async () => (key.value = await demoKey()));

  const ready = computed(() => !active.value || key.value !== undefined);
  const demoPledges = computed(() => (key.value ? demoHangar(pledges.value, key.value) : []));
  const context = computed<DemoContext | null>(() => {
    if (!active.value || !key.value) return null;
    const fakeId = createFakeIds(key.value);
    // Built on first use: most demo visits never open an order.
    let orders: Map<string, Order> | undefined;
    const realOrder = (fakeOrderId: string) => {
      orders ??= new Map(
        [...pledges.value, ...buyback.value]
          .flatMap((pledge) => (pledge.order ? [pledge.order] : []))
          .map((order) => [fakeId(order.id), order]),
      );
      return orders.get(fakeOrderId);
    };
    const demoKey = key.value;
    const upgradeLog: DemoContext['upgradeLog'] = (pledgeId, createdAt, entries) =>
      demoUpgradeLog(entries, pledgeId, createdAt, demoKey);
    const justBoughtId = justBoughtOf(demoPledges.value);
    const justBought =
      justBoughtId === undefined ? undefined : { pledgeId: justBoughtId, at: demoPurchaseTime() };
    return { fakeId, realOrder, upgradeLog, storeCredit: demoStoreCredit(demoKey), justBought };
  });
  const demoBuybackPledges = computed(() =>
    key.value ? demoBuyback(buyback.value, key.value) : [],
  );
  return {
    ready,
    context,
    pledges: computed(() => (active.value ? demoPledges.value : pledges.value)),
    buyback: computed(() => (active.value ? demoBuybackPledges.value : buyback.value)),
  };
}
