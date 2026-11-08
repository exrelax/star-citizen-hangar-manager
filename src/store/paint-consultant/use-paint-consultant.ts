import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import type { StoreCredit } from '@/account/store-credit';
import type { PledgeView } from '@/hangar/pledge-view';
import { hashOfTab } from '@/hangar/route';
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
import { planPaintRebuy, type PaintConsultantResult } from './calculation';

/*
 * The Paint Discount Consultant's result for the whole manager, worked out once (in App.vue) from
 * the hangar's pledges (in the demo mode the demo selection), the Pledge Store items, the store
 * credit and the settings: shown in the Pledge Store tab (`PaintConsultant.vue`), and as marks and
 * a filter in My Hangar (`paintRebuys`).
 */

export interface PaintConsultantState {
  /** The Pledge Store items, once read. */
  storeItems: ComputedRef<readonly StoreItem[] | undefined>;
  /** The store credit is to be used, but isn't known (yet): it counts as $0. */
  creditUnknown: ComputedRef<boolean>;
  result: ComputedRef<PaintConsultantResult | undefined>;
}

/** A paint of My Hangar the plan buys again. */
export interface PaintRebuy {
  /** Its discount now, rounded to the tiers, in percent. */
  from: number;
  /** The discount it gets bought again with. */
  to: number;
  /** Store credit it frees, in USD. */
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
  const creditUnknown = computed(() => options.value.useStoreCredit && credit.value === undefined);

  const result = computed(() =>
    storeItems.value
      ? planPaintRebuy({
          pledges: pledges(),
          storeItems: storeItems.value,
          storeCredit: options.value.useStoreCredit ? (credit.value ?? 0) : 0,
          useFillers: options.value.useFillers,
          skipGiftable: options.value.skipGiftable,
        })
      : undefined,
  );

  watchEffect(() => {
    const plan = result.value?.plan;
    paintRebuys.value =
      plan && !settings().hideMeltValue
        ? new Map(
            plan.own.map((paint) => [
              paint.pledgeId,
              {
                from: paint.discount,
                to: plan.tier.percent,
                freed:
                  Math.round(
                    (paint.meltValue - paint.storePaint.price * (1 - plan.tier.percent / 100)) *
                      100,
                  ) / 100,
              },
            ]),
          )
        : new Map();
  });

  const state = { storeItems, creditUnknown, result };
  provide(KEY, state);
  return state;
}

/** The result provided by `providePaintConsultant`. */
export function usePaintConsultant(): PaintConsultantState {
  const state = inject(KEY);
  if (!state) throw new Error('The Paint Discount Consultant is not provided');
  return state;
}

/** Shows the consultant: switches to the Pledge Store tab and scrolls to it. */
export function openPaintConsultant(): void {
  location.hash = hashOfTab('store');
  // The tab may be built on first use: wait for the consultant to be there.
  let tries = 0;
  const scroll = () => {
    const title = document.getElementById('shm-consultant-title');
    if (title) title.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (++tries < 30) requestAnimationFrame(scroll);
  };
  requestAnimationFrame(scroll);
}
