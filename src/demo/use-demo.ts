import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import type { Order, OrderDetails } from '@/orders/orders';
import { demoOrderDetails } from './generate-states';
import { computed, inject, onMounted, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import { demoMeltMarksItem } from '@/hangar/melt-marks';
import type { StarCitizenEvent } from '@/events/events';
import { locale } from '@/i18n';
import { demoEventNotes, demoEvents } from './demo-events';
import { seedDemoNotes } from './demo-notes';
import type { StoreCredit } from '@/account/store-credit';
import { current, shipsItem } from '@/ships/ships-storage';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import { useStored } from '@/storage/use-stored';
import { demoCatalog } from './catalog';
import type { DemoSettings } from './demo-settings';
import {
  createFakeIds,
  demoBuyback,
  demoHangar,
  generatedDemo,
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

/** The demo key the demo's marks were set for, so they are set once per demo hangar. */
const marksSeededItem = storage.defineItem<string | null>('local:demo.marksSeeded', {
  fallback: null,
});

/**
 * Marks to melt of a new demo hangar (#176): the pledge bought a few hours ago, still waiting for
 * RSI's 24 hours, and an older meltable one, ready to melt. Set once per key, in the demo's own
 * marks; marking and unmarking changes them as usual.
 */
async function seedDemoMarks(key: string, pledges: readonly PledgeView[], justBought?: number) {
  if ((await marksSeededItem.getValue()) === key) return;
  const now = Date.now();
  const older = pledges.find(
    (pledge) => pledge.isMeltable && pledge.id !== justBought && pledge.isPaint,
  );
  await demoMeltMarksItem.setValue({
    ...(justBought !== undefined && { [justBought]: now - 60 * 60 * 1000 }),
    ...(older && { [older.id]: now - 2 * 60 * 60 * 1000 }),
  });
  await marksSeededItem.setValue(key);
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
  /**
   * The applied CCUs of a generated pledge (#176), instead of loading RSI's log; none for a
   * pledge of the own selection.
   */
  generatedUpgradeLog?: (pledgeId: number) => UpgradeLogEntry[] | undefined;
  /** The made-up invoice of a generated order (#176); none for an order of the own selection. */
  orderDetails?: (order: Order) => OrderDetails | undefined;
  /** The events shown in the Pledge Store tab instead of the website's (#210). */
  events: StarCitizenEvent[];
  /** Buy back tokens shown instead of the account's, with the generated buy back (#177). */
  tokens?: number;
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
 * The demo variants of the lists while `active` (the demo mode setting; only computed when it is
 * on): generated from the public catalog (#175) or a selection of the real ones, by `settings`.
 */
export function useDemo(
  active: Readonly<Ref<boolean>>,
  pledges: Ref<PledgeView[]>,
  buyback: Ref<BuybackView[]>,
  settings: () => DemoSettings,
) {
  const key = shallowRef<string>();
  onMounted(async () => (key.value = await demoKey()));

  // The public catalog the generated hangar is made of; a bundled one stands in for what isn't
  // stored yet.
  const ships = useStored(shipsItem);
  const storeItems = useStored(storeItemsItem);
  const catalog = computed(() =>
    demoCatalog(
      current(ships.value ?? null)?.ships,
      storeItems.value?.version === STORE_ITEMS_VERSION ? storeItems.value.items : undefined,
    ),
  );
  const generated = computed(() => settings().source === 'generated');

  const ready = computed(() => !active.value || key.value !== undefined);
  const generatedAccount = computed(() =>
    active.value && key.value && generated.value
      ? generatedDemo(catalog.value, key.value)
      : undefined,
  );
  watch(generatedAccount, (account) => {
    if (!account || !key.value) return;
    void seedDemoMarks(key.value, account.pledges, justBoughtOf(account.pledges));
  });
  // The demo's own sidebar notifications (#210), once per key.
  watch(
    () => (active.value ? key.value : undefined),
    (demoKey) => demoKey && void seedDemoNotes(demoKey, demoEventNotes(Date.now(), locale.value)),
    { immediate: true },
  );
  const events = computed(() => (active.value ? demoEvents(Date.now()) : []));
  const demoPledges = computed(() => {
    if (!active.value || !key.value) return [];
    return generatedAccount.value?.pledges ?? demoHangar(pledges.value, key.value);
  });
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
    const account = generatedAccount.value;
    // The generated orders by their made-up ids, with what their invoices list.
    const generatedOrders = new Map(
      [
        ...(account?.pledges ?? []).map((pledge) => ({
          order: pledge.order,
          title: pledge.originalName ?? pledge.title,
          total: pledge.valueUsd,
        })),
        ...(account?.buyback ?? []).map((pledge) => ({
          order: pledge.order,
          title: pledge.title,
          total: pledge.price?.amount ?? 0,
        })),
      ].flatMap((entry) => (entry.order ? [[entry.order.id, entry] as const] : [])),
    );
    return {
      fakeId,
      realOrder,
      upgradeLog,
      ...(account && {
        generatedUpgradeLog: (pledgeId: number) => account.account.upgradeLogs.get(pledgeId),
        orderDetails: (order: Order) => {
          const entry = generatedOrders.get(order.id);
          return entry ? demoOrderDetails(order, [entry.title], entry.total) : undefined;
        },
        tokens: account.generatedBuyback.tokens,
      }),
      events: events.value,
      storeCredit: demoStoreCredit(demoKey),
      justBought,
    };
  });
  const demoBuybackPledges = computed(() => {
    if (!active.value || !key.value) return [];
    return generatedAccount.value?.buyback ?? demoBuyback(buyback.value, key.value);
  });
  return {
    ready,
    context,
    pledges: computed(() => (active.value ? demoPledges.value : pledges.value)),
    buyback: computed(() => (active.value ? demoBuybackPledges.value : buyback.value)),
  };
}
