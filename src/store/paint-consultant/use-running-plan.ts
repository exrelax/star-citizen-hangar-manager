import { storeCreditMeta } from '@/account/store-credit-storage';
import { refreshStoreCredit } from '@/account/sync-store-credit';
import { useDemoContext } from '@/demo/use-demo';
import { hangarMeta } from '@/hangar/hangar-storage';
import type { Settings } from '@/settings/settings';
import { useStored } from '@/storage/use-stored';
import { useNow } from '@/shared/use-now';
import {
  computed,
  onScopeDispose,
  shallowRef,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue';
import { storeItemsMeta } from '../items/store-items-storage';
import { cartCheckOf, readCart } from './cart';
import {
  completedPlansItem,
  completedPlansOf,
  demoCompletedPlansItem,
  type CompletedPaintPlan,
} from './completed-plans';
import {
  currentPlanOf,
  demoRebuyPlanItem,
  demoRunInputsItem,
  rebuyPlanItem,
  rebuyPlanItemOf,
  updatePlan,
  type StoredRebuyPlan,
} from './rebuy-plan-storage';
import {
  planLinesOf,
  recalculatedPlan,
  runningPlanSteps,
  withMelted,
  type CartState,
  type RunningPlanView,
} from './running-plan';
import { usePaintConsultant } from './use-paint-consultant';

/*
 * The running plan of the Paint Discount Consultant for its card (#245): the stored plan (the
 * demo's own in the demo mode) worked out into steps with the hangar, the Pledge Store, the store
 * credit and RSI's cart, and what the card can do with it. RSI's cart is read – read-only – only
 * while a step needs it and the Pledge Store tab is shown: when the tab opens and after every
 * refresh of the store data, at most once per trigger. Never in the demo, which has a made-up cart
 * of its own. The facts the content script can't see (melted with the bulk melting) are recorded
 * here; the rest – the purchase, pledges gone, the end of the plan – by `checkRunningPlan`.
 * Needs `providePaintConsultant` above.
 */

/**
 * Whether filling RSI's cart replaces a running plan (#245): provided by the consultant for the
 * cart buttons of a new plan, which ask first then (`PaintCartButton`); the running plan's own
 * buttons provide `() => false`.
 */
export const REPLACES_RUNNING_PLAN: InjectionKey<() => boolean> = Symbol('shm-replaces-plan');

/** Waits this long for more triggers before reading the cart once. */
const CART_READ_DELAY_MS = 400;

export interface RunningPlanState {
  /** The running plan as stored (upgraded from an older format), if any. */
  plan: ComputedRef<StoredRebuyPlan | undefined>;
  /** Its steps; undefined without a plan or before the Pledge Store items are known. */
  view: ComputedRef<RunningPlanView | undefined>;
  /** The completed plans, newest first. */
  completed: ComputedRef<readonly CompletedPaintPlan[]>;
  /** RSI's cart as last read (the demo's made-up one). */
  cart: ComputedRef<CartState>;
  readingCart: Readonly<Ref<boolean>>;
  /** The plan or the Pledge Store items aren't read yet. */
  loading: ComputedRef<boolean>;
  /** The store credit the running plan works with, in USD (all of it, whatever the setting). */
  credit: ComputedRef<number | undefined>;
  /** The plan worked out again for the store credit there is ("Recalculate"), if one fits. */
  recalculation: ComputedRef<StoredRebuyPlan | undefined>;
  /** Reads RSI's cart now, e.g. after `PaintCartButton`'s `filled` or for "Read again". */
  refreshCart(): Promise<void>;
  /** Reads the store credit again ("Read again" of an unknown store credit). */
  refreshCredit(): Promise<void>;
  /** Records pledges melted by `BulkExchangeOverlay` (its `exchanged` event). */
  recordMelted(ids: readonly number[]): Promise<void>;
  /** Keeps the recalculated plan; false when none fits. Never changes the cart. */
  recalculate(): Promise<boolean>;
  /** Removes the running plan without keeping it as completed; melts, buys or unmarks nothing. */
  discard(): Promise<void>;
}

export function useRunningPlan({
  settings,
  active,
}: {
  settings: () => Settings;
  /** The Pledge Store tab is shown: only then the cart is read. */
  active: () => boolean;
}): RunningPlanState {
  const { pledges, storeItems, accountCredit } = usePaintConsultant();
  const demo = useDemoContext();
  const isDemo = () => !!demo.value;
  const now = useNow();

  // The demo never reads or writes the account's plan, cart or completed plans (#131).
  const realPlan = useStored(rebuyPlanItem);
  const demoPlan = useStored(demoRebuyPlanItem);
  const demoInputs = useStored(demoRunInputsItem);
  const realHistory = useStored(completedPlansItem);
  const demoHistory = useStored(demoCompletedPlansItem);

  const stored = computed(() => (isDemo() ? demoPlan.value : realPlan.value));
  const plan = computed(() => currentPlanOf(stored.value, pledges.value, storeItems.value));
  const completed = computed(() =>
    completedPlansOf(isDemo() ? demoHistory.value : realHistory.value),
  );
  const credit = computed(() =>
    isDemo() ? (demoInputs.value?.credit ?? accountCredit.value) : accountCredit.value,
  );

  const realCart = shallowRef<CartState>({ status: 'unread' });
  const readingCart = shallowRef(false);
  const cart = computed<CartState>(() => {
    if (!isDemo()) return realCart.value;
    const lines = demoInputs.value?.cart;
    return lines ? { status: 'read', lines, at: 0 } : { status: 'unread' };
  });

  const view = computed(() => {
    if (!plan.value || !storeItems.value) return undefined;
    const options = settings();
    return runningPlanSteps({
      plan: plan.value,
      pledges: pledges.value,
      storeItems: storeItems.value,
      credit: credit.value,
      cart: cart.value,
      bulkMelting: options.bulkMelting,
      useFillers: options.paintConsultant.useFillers,
      demo: isDemo(),
      now: now.value,
    });
  });
  const loading = computed(() => stored.value === undefined || !storeItems.value);

  // ---- RSI's cart ----

  /** The last read held the whole plan: an empty cart after it means it was probably paid. */
  let lastComplete = false;
  let lastPlanAt: number | undefined;
  async function refreshCart() {
    if (isDemo() || readingCart.value || !plan.value) return;
    const current = plan.value;
    readingCart.value = true;
    try {
      const lines = await readCart();
      if (lastPlanAt !== current.at) lastComplete = false;
      lastPlanAt = current.at;
      const emptied = lastComplete && !lines.length;
      lastComplete = cartCheckOf(planLinesOf(current, storeItems.value), lines).complete;
      realCart.value = {
        status: 'read',
        lines,
        at: Date.now(),
        ...((emptied ||
          (realCart.value.status === 'read' &&
            realCart.value.emptiedAfterComplete &&
            !lines.length)) && { emptiedAfterComplete: true }),
      };
    } catch (failure) {
      // Signed out, or RSI's error: shown in the step, never treated as a complete cart.
      realCart.value = {
        status: 'failed',
        reason: failure instanceof Error ? failure.message : String(failure),
        at: Date.now(),
      };
    } finally {
      readingCart.value = false;
    }
  }

  const needsCart = computed(() => !isDemo() && !!view.value?.needsCart);
  const storeChecked = useStored(storeItemsMeta);
  const creditChecked = useStored(storeCreditMeta);
  const hangarChecked = useStored(hangarMeta);
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(
    () =>
      [
        active() && needsCart.value,
        storeChecked.value?.checkedAt,
        creditChecked.value?.checkedAt,
        hangarChecked.value?.checkedAt,
      ] as const,
    ([wanted]) => {
      clearTimeout(timer);
      if (wanted) timer = setTimeout(() => void refreshCart(), CART_READ_DELAY_MS);
    },
    { immediate: true },
  );
  onScopeDispose(() => clearTimeout(timer));

  // ---- What the card does ----

  const recalculation = computed(() =>
    plan.value
      ? recalculatedPlan(plan.value, {
          pledges: pledges.value,
          storeItems: storeItems.value,
          credit: credit.value,
          useFillers: settings().paintConsultant.useFillers,
          now: now.value,
        })
      : undefined,
  );

  async function recalculate() {
    const next = recalculation.value;
    if (!next) return false;
    await rebuyPlanItemOf(isDemo()).setValue({ ...next, recalculatedAt: Date.now() });
    lastComplete = false;
    return true;
  }

  async function discard() {
    lastComplete = false;
    realCart.value = { status: 'unread' };
    await rebuyPlanItemOf(isDemo()).setValue(null);
  }

  async function recordMelted(ids: readonly number[]) {
    // Nothing is melted in the demo.
    if (isDemo() || !ids.length) return;
    const values = new Map(pledges.value.map((pledge) => [pledge.id, pledge.valueUsd]));
    await updatePlan(
      rebuyPlanItem,
      (current) => withMelted(current, ids, values, Date.now()),
      pledges.value,
    );
  }

  async function refreshCredit() {
    if (!isDemo()) await refreshStoreCredit();
  }

  return {
    plan,
    view,
    completed,
    cart,
    readingCart,
    loading,
    credit,
    recalculation,
    refreshCart,
    refreshCredit,
    recordMelted,
    recalculate,
    discard,
  };
}
