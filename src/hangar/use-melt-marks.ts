import { ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import { useStored } from '@/storage/use-stored';
import { computed, inject, shallowRef, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { demoMeltMarksItem, meltableAt, meltMarksItem } from './melt-marks';

/** A marked pledge with the time it can be melted. */
export interface MarkedPledge {
  pledgeId: number;
  /** When it was marked, in ms. */
  markedAt: number;
  /** When it can be melted, in ms. */
  meltableAt: number;
}

/** When a pledge was bought: the date of the list, the time of the pledge log if known. */
export interface Purchase {
  /** "2026-10-30" */
  on?: string;
  /** "2026-10-30T19:55" */
  at?: string;
}

/**
 * The pledges marked to melt, by pledge id, with the time each can be melted (see `meltableAt`).
 * In the demo, its own marks (see `demoMeltMarksItem`) with its made-up purchases.
 */
export function useMeltMarks(
  demo: () => boolean,
  purchases: () => ReadonlyMap<number, Purchase>,
): ComputedRef<ReadonlyMap<number, MarkedPledge>> {
  const real = useStored(meltMarksItem);
  const demoMarks = useStored(demoMeltMarksItem);
  return computed(() => {
    const marks = (demo() ? demoMarks.value : real.value) ?? {};
    const bought = purchases();
    return new Map(
      Object.entries(marks).map(([id, markedAt]) => {
        const pledgeId = Number(id);
        const purchase = bought.get(pledgeId);
        const at = meltableAt({ boughtAt: purchase?.at, boughtOn: purchase?.on, markedAt });
        return [pledgeId, { pledgeId, markedAt, meltableAt: at }];
      }),
    );
  });
}

/** The purchases of the hangar's pledges: their dates, and the times of the pledge log. */
export function hangarPurchases(
  pledges: readonly { id: number; createdAt?: string }[],
  orders: OrdersSnapshot | null | undefined,
): ReadonlyMap<number, Purchase> {
  const links = orders?.version === ORDERS_SNAPSHOT_VERSION ? orders.pledgeOrders : {};
  return new Map(
    pledges.map((pledge) => [pledge.id, { on: pledge.createdAt, at: links[pledge.id]?.createdAt }]),
  );
}

/**
 * The marked pledges of the hangar that can be melted now (set by `App.vue`), for the filter
 * "Melt now" (see `filters.ts`) and the sidebar's notification about them.
 */
export const meltReadyIds = shallowRef<ReadonlySet<number>>(new Set());

/** The ids of the marked pledges in `hangarIds` that can be melted at `now`. */
export function readyToMelt(
  marks: ReadonlyMap<number, MarkedPledge>,
  hangarIds: ReadonlySet<number>,
  now: number,
): ReadonlySet<number> {
  return new Set(
    [...marks.values()]
      .filter((mark) => mark.meltableAt <= now && hangarIds.has(mark.pledgeId))
      .map((mark) => mark.pledgeId),
  );
}

export const MELT_MARKS: InjectionKey<Readonly<Ref<ReadonlyMap<number, MarkedPledge>>>> =
  Symbol('shm-melt-marks');

/** The marked pledges provided by the manager view (see `App.vue`); none outside of it. */
export function useMarkedPledges(): Readonly<Ref<ReadonlyMap<number, MarkedPledge>>> {
  return inject(MELT_MARKS, shallowRef<ReadonlyMap<number, MarkedPledge>>(new Map()));
}
