import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import type { Order, OrderDetails } from '@/orders/orders';
import { demoOrderDetails } from './generate-states';
import { computed, inject, onMounted, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import { demoMeltMarksItem } from '@/hangar/melt-marks';
import type { StarCitizenEvent } from '@/events/events';
import { locale } from '@/i18n';
import { demoEventNotes, demoEvents } from './demo-events';
import { resetDemoNotes, seedDemoNotes } from './demo-notes';
import type { StoreCredit } from '@/account/store-credit';
import { buyableShipsItem, current, shipsItem } from '@/ships/ships-storage';
import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import { demoDismissedAdvisorNotesItem } from '@/price-increases/advisor-notes';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import { useStored } from '@/storage/use-stored';
import { demoCatalog, FALLBACK_CATALOG, type DemoCatalog } from './catalog';
import type { StorageId } from '@/storage/registry';
import { HANGAR_PAGE_SIZE } from '@/config';
import { demoStoreNotes } from './demo-store-notes';
import { demoStoreData } from './demo-store';
import type { StoreData } from '@/store/warbond';
import type { StoreItem } from '@/store/items/store-items';
import {
  demoCompletedPlans,
  demoRunningPlan,
  resetDemoRunningPlan,
  seedDemoRunningPlan,
  withCopyBoughtToday,
} from './demo-running-plan';
import { localToday } from '@/orders/refund';
import type { DemoSettings } from './demo-settings';
import {
  createFakeIds,
  demoBuyback,
  demoHangar,
  generatedDemo,
  demoPurchaseTime,
  demoUpgradeLog,
  justBoughtOf,
} from './demo';
import type { UpgradeLogEntry } from '@/hangar/upgrade-log';

/** Random key of the demo, created on first use and kept only in this browser. */
const demoKeyItem = storage.defineItem<string | null>('local:demo.key', { fallback: null });

const randomKey = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

async function demoKey(): Promise<string> {
  let key = await demoKeyItem.getValue();
  if (!key) {
    key = randomKey();
    await demoKeyItem.setValue(key);
  }
  return key;
}

/**
 * A new demo hangar (#178): a new key, so another random hangar, buy back and orders appear, with
 * new marks and sample notifications.
 */
export const newDemoHangar = (): Promise<void> => demoKeyItem.setValue(randomKey());

/** Counts the resets of the demo, so its marks and running plan are set again at once. */
const demoResets = shallowRef(0);

/**
 * The demo back to its start (#178): its marks, its consultant's running plan and its sample
 * notifications as a new demo hangar has them, and the Price Increase Advisor's ones shown again.
 */
export async function resetDemoData(): Promise<void> {
  await Promise.all([
    demoMeltMarksItem.removeValue(),
    marksSeededItem.removeValue(),
    resetDemoRunningPlan(),
    resetDemoNotes(),
    // The Price Increase Advisor's notifications closed with × (#255).
    demoDismissedAdvisorNotesItem.removeValue(),
  ]);
  demoResets.value++;
}

/** The demo's sample notifications (#210, #131), in the language shown. */
const demoSampleNotes = (now: number, catalog: DemoCatalog = FALLBACK_CATALOG) => [
  ...demoStoreNotes(catalog, locale.value, now),
  ...demoEventNotes(now, locale.value),
];

/** The demo key the demo's marks were set for, so they are set once per demo hangar. */
const marksSeededItem = storage.defineItem<string | null>('local:demo.marksSeeded', {
  fallback: null,
});

/**
 * Marks to melt of a new demo hangar (#176): the pledge bought a few hours ago, still waiting for
 * RSI's 24 hours, and an older meltable one, ready to melt. Set once per key, in the demo's own
 * marks; marking and unmarking changes them as usual.
 */
/** The pledges the demo marks: the one just bought, and an older meltable paint of its own. */
function demoMarkIds(pledges: readonly PledgeView[], justBought?: number): number[] {
  const count = (title: string) => pledges.filter((pledge) => pledge.title === title).length;
  // Not one of the pair bought again (#131): its paint shows twice.
  const older = pledges.find(
    (pledge) =>
      pledge.isMeltable && pledge.id !== justBought && pledge.isPaint && count(pledge.title) === 1,
  );
  return [...(justBought === undefined ? [] : [justBought]), ...(older ? [older.id] : [])];
}

async function seedDemoMarks(key: string, ids: readonly number[]) {
  if ((await marksSeededItem.getValue()) === key) return;
  const now = Date.now();
  // The first still waiting for RSI's 24 hours (bought a few hours ago), the second ready.
  await demoMeltMarksItem.setValue(
    Object.fromEntries(ids.map((id, index) => [id, now - (index + 1) * 60 * 60 * 1000])),
  );
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
  /**
   * What the settings show of the stored data in the demo (#132): the demo's numbers of the
   * account's storages instead of the real ones, and its hangar's page count.
   */
  storage: { counts: Partial<Record<StorageId, number>>; hangarPages: number };
  /** The warbond CCUs and their history in the Pledge Store tab (#130, #297), with either source. */
  storeData: StoreData;
  /** The catalog's items, for the Paint Discount Consultant of the generated demo (#131). */
  storeItems?: readonly StoreItem[];
  /** Buy back tokens shown instead of the account's, with the generated buy back (#177). */
  tokens?: number;
  /** The store credit shown instead of the account's. */
  storeCredit: StoreCredit;
  /**
   * The expected price increases of the generated demo (#194, #255) instead of the website's, for
   * what works them out from the storage: the CCUs to secure (#253, #254).
   */
  priceIncreases?: readonly ExpectedPriceIncrease[];
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
  // Created on first use; "New demo hangar" in the settings replaces it.
  const storedKey = useStored(demoKeyItem);
  onMounted(async () => (key.value = await demoKey()));
  watch(storedKey, (value) => value && (key.value = value));

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
  // The ships RSI sells CCUs to: the demo's price increase for the CCUs to secure is one (#255).
  const buyableShips = useStored(buyableShipsItem);
  const buyable = computed(() => {
    const skus = current(buyableShips.value ?? null)?.skus;
    return skus && new Set(skus.map((sku) => sku.shipId));
  });

  const ready = computed(() => !active.value || key.value !== undefined);
  const generatedAccount = computed(() =>
    active.value && key.value && generated.value
      ? generatedDemo(catalog.value, key.value, localToday(), Date.now(), settings(), buyable.value)
      : undefined,
  );
  watch([generatedAccount, demoResets], ([account]) => {
    if (!account || !key.value) return;
    const marked = demoMarkIds(account.pledges, justBoughtOf(account.pledges));
    if (settings().states.meltMarks) void seedDemoMarks(key.value, marked);
  });
  // The demo's own sidebar notifications (#210, #131), once per key.
  watch(
    () => [active.value ? key.value : undefined, demoResets.value] as const,
    ([demoKey]) =>
      demoKey && void seedDemoNotes(demoKey, demoSampleNotes(Date.now(), catalog.value)),
    { immediate: true },
  );
  const events = computed(() => {
    if (!active.value) return [];
    const now = Date.now();
    // Without a running event (demo settings, #297) only the upcoming one shows.
    return demoEvents(now).filter(
      (event) => settings().states.runningEvent || now < event.eventStart,
    );
  });
  const demoPledges = computed(() => {
    if (!active.value || !key.value) return [];
    const list =
      generatedAccount.value?.pledges ??
      demoHangar(pledges.value, key.value, localToday(), Date.now(), settings().ownHangarPledges);
    // The running plan bought the copy a few hours ago at this stage (#303).
    return settings().runningPlanStage === 'meltOld'
      ? withCopyBoughtToday(list, catalog.value.items, localToday())
      : list;
  });
  /*
   * The consultant's running plan at the stage chosen in the settings (#303), with its completed
   * plans: made of the demo hangar and the catalog only. Its fillers are the marked paint ready to
   * melt at the stage "fillers", otherwise any other paint, so the sidebar's marks agree.
   */
  const running = computed(() => {
    if (!active.value || !key.value) return undefined;
    const pledgeList = demoPledges.value;
    const now = Date.now();
    const stage = settings().runningPlanStage;
    const older = demoMarkIds(pledgeList, justBoughtOf(pledgeList)).filter(
      (id) => id !== justBoughtOf(pledgeList),
    );
    const items = catalog.value.items;
    const plan = demoRunningPlan(stage, {
      pledges: pledgeList,
      items,
      now,
      ...(stage === 'fillers' ? { marked: older } : { avoid: older }),
      credit: settings().storeCredit,
    });
    const hangar = pledgeList.reduce((hash, { id }) => (hash * 31 + id) | 0, pledgeList.length);
    return {
      // The demo hangar, catalog and store credit it was made of: changing them sets the plan again.
      seed: `${key.value}:${hangar}:${items.length}:${settings().storeCredit}:${settings().completedPlans}`,
      stage,
      plan,
      // Without completed plans the consultant has no tab for them (#306).
      completed: settings().completedPlans ? demoCompletedPlans(items, now) : [],
    };
  });
  watch([running, demoResets], ([demo]) => {
    if (demo) void seedDemoRunningPlan(demo.seed, demo.stage, demo.plan, demo.completed);
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
    const justBoughtId = settings().states.justBought ? justBoughtOf(demoPledges.value) : undefined;
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
        storeItems: catalog.value.items,
        priceIncreases: account.priceIncreases,
      }),
      // With either source (#298): never the Pledge Store's real offers or this browser's history.
      storeData: demoStoreData(catalog.value, demoPledges.value, Date.now(), events.value),
      events: events.value,
      storage: {
        counts: {
          hangar: demoPledges.value.length,
          buyback: demoBuybackPledges.value.length,
          orders: [...demoPledges.value, ...demoBuybackPledges.value].filter((p) => p.order).length,
          storeCredit: 1,
          paintPlan: running.value?.plan?.plan ? 1 : 0,
          paintHistory: running.value?.completed.length ?? 0,
          events: events.value.length,
          ...(account && { priceIncreases: account.priceIncreases.length }),
        },
        hangarPages: Math.max(1, Math.ceil(demoPledges.value.length / HANGAR_PAGE_SIZE)),
      },
      // Set in the demo settings (#179).
      // A stage of the running plan the setting can't show has a credit of its own (#303).
      storeCredit: {
        amount: running.value?.plan?.inputs.credit ?? settings().storeCredit,
        currency: 'USD',
      },
      justBought,
    };
  });
  const demoBuybackPledges = computed(() => {
    if (!active.value || !key.value) return [];
    return (
      generatedAccount.value?.buyback ??
      demoBuyback(buyback.value, key.value, settings().buybackPledges)
    );
  });
  return {
    ready,
    context,
    pledges: computed(() => (active.value ? demoPledges.value : pledges.value)),
    buyback: computed(() => (active.value ? demoBuybackPledges.value : buyback.value)),
  };
}
