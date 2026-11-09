import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import type { StoreCredit } from '@/account/store-credit';
import type { PledgeView } from '@/hangar/pledge-view';
import { openTabAt } from '@/hangar/open-tab-at';
import type { Settings } from '@/settings/settings';
import { useStored } from '@/storage/use-stored';
import {
  computed,
  inject,
  provide,
  shallowRef,
  watchEffect,
  type ComputedRef,
  type InjectionKey,
} from 'vue';
import { storeItemsItem, STORE_ITEMS_VERSION } from '../items/store-items-storage';
import type { StoreItem } from '../items/store-items';
import { planPaintRebuy, type KeptPlan, type PaintConsultantResult } from './calculation';
import { rebuyPlanItem, REBUY_PLAN_VERSION } from './rebuy-plan-storage';

/*
 * The Paint Discount Consultant's result for the whole manager, worked out once (in App.vue) from
 * the hangar's pledges (in the demo mode the demo selection), the Pledge Store items, the store
 * credit and the settings: shown in the Pledge Store tab (`PaintConsultant.vue`), and as marks and
 * a filter in My Hangar (`paintRebuys`).
 */

export interface PaintConsultantState {
  /** The pledges the result is worked out from, e.g. to melt the own paints of the plan. */
  pledges: ComputedRef<readonly PledgeView[]>;
  /** The Pledge Store items, once read. */
  storeItems: ComputedRef<readonly StoreItem[] | undefined>;
  /** The store credit is to be used, but isn't known (yet): it counts as $0. */
  creditUnknown: ComputedRef<boolean>;
  result: ComputedRef<PaintConsultantResult | undefined>;
}

/**
 * A paint of My Hangar the consultant has a step for: `rebuy` – the plan buys it again; `melt` – it
 * was bought again already (#139), this old pledge is only left to melt.
 */
export interface PaintRebuy {
  kind: 'rebuy' | 'melt';
  /** Its discount now, rounded to the tiers, in percent. */
  from: number;
  /** The discount it gets (`rebuy`) or its new copy got (`melt`) bought again with. */
  to: number;
  /** Store credit it frees, in USD: what the plan frees, or melting the old pledge gives. */
  freed: number;
}

/**
 * The paints of My Hangar the plan buys again, by pledge id – for the marks of the rows and the
 * "Paint rebuy" filter, whose predicate can't inject. Empty while "Hide melt value" is on.
 */
export const paintRebuys = shallowRef<ReadonlyMap<number, PaintRebuy>>(new Map());

const KEY: InjectionKey<PaintConsultantState> = Symbol('shm-paint-consultant');

/** Works the result out and provides it to the components below (call it in App.vue). */
export function providePaintConsultant({
  pledges,
  settings,
  demoStoreCredit,
}: {
  pledges: () => readonly PledgeView[];
  settings: () => Settings;
  /** The made-up store credit of the demo mode, if on (App.vue provides the demo context). */
  demoStoreCredit: () => StoreCredit | undefined;
}): PaintConsultantState {
  const storedItems = useStored(storeItemsItem);
  const storeItems = computed(() =>
    storedItems.value?.version === STORE_ITEMS_VERSION ? storedItems.value.items : undefined,
  );

  // The account's store credit (in the demo mode a made-up one), in USD only.
  const storedCredit = useStored(storeCreditItem);
  const credit = computed(() => {
    const stored = storedCredit.value;
    const value =
      demoStoreCredit() ?? (stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined);
    return value?.currency === 'USD' ? value.amount : undefined;
  });

  const options = computed(() => settings().paintConsultant);
  // The plan kept when its paints were put into the cart: confirms paints bought again (#139).
  const storedPlan = useStored(rebuyPlanItem);
  const keptPlan = computed<KeptPlan | undefined>(() => {
    const stored = storedPlan.value;
    return stored?.version === REBUY_PLAN_VERSION
      ? { at: stored.at, ownPledgeIds: stored.own.map((paint) => paint.pledgeId) }
      : undefined;
  });
  const creditUnknown = computed(() => options.value.useStoreCredit && credit.value === undefined);

  const result = computed(() =>
    storeItems.value
      ? planPaintRebuy({
          pledges: pledges(),
          storeItems: storeItems.value,
          storeCredit: options.value.useStoreCredit ? (credit.value ?? 0) : 0,
          useFillers: options.value.useFillers,
          skipGiftable: options.value.skipGiftable,
          keptPlan: keptPlan.value,
          guessRebought: options.value.reboughtDetection === 'guess',
        })
      : undefined,
  );

  watchEffect(() => {
    const plan = result.value?.plan;
    const marks = new Map<number, PaintRebuy>();
    if (!settings().hideMeltValue) {
      for (const paint of plan?.own ?? []) {
        marks.set(paint.pledgeId, {
          kind: 'rebuy',
          from: paint.discount,
          to: plan!.tier.percent,
          freed:
            Math.round(
              (paint.meltValue - paint.storePaint.price * (1 - plan!.tier.percent / 100)) * 100,
            ) / 100,
        });
      }
      for (const { old, copy } of result.value?.rebought ?? []) {
        marks.set(old.pledgeId, {
          kind: 'melt',
          from: old.discount,
          to: copy.discount,
          freed: old.meltValue,
        });
      }
    }
    paintRebuys.value = marks;
  });

  const state = { pledges: computed(pledges), storeItems, creditUnknown, result };
  provide(KEY, state);
  return state;
}

/** The result provided by `providePaintConsultant`. */
export function usePaintConsultant(): PaintConsultantState {
  const state = maybePaintConsultant();
  if (!state) throw new Error('The Paint Discount Consultant is not provided');
  return state;
}

/** The provided result, if any (e.g. not in component tests of other parts). */
export function maybePaintConsultant(): PaintConsultantState | undefined {
  return inject(KEY, undefined);
}

/** Shows the consultant: switches to the Pledge Store tab and scrolls to it. */
export function openPaintConsultant(): void {
  openTabAt('store', 'shm-consultant-title');
}
