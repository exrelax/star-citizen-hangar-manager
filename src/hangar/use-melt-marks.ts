import { ORDERS_SNAPSHOT_VERSION } from '@/orders/orders';
import { ordersSnapshot } from '@/orders/orders-storage';
import { useStored } from '@/storage/use-stored';
import { computed, inject, shallowRef, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { meltableAt, meltMarksItem, type MeltMark } from './melt-marks';

/** A marked pledge with the time it can be melted. */
export interface MarkedPledge extends MeltMark {
  pledgeId: number;
  /** When it can be melted, in ms. */
  meltableAt: number;
}

/**
 * The pledges marked to melt, by pledge id, with the time each can be melted: from the purchase
 * time of the pledge log, else the purchase date of the list (`boughtOn`).
 */
export function useMeltMarks(
  boughtOn: () => ReadonlyMap<number, string | undefined>,
): ComputedRef<ReadonlyMap<number, MarkedPledge>> {
  const marks = useStored(meltMarksItem);
  const orders = useStored(ordersSnapshot);
  return computed(() => {
    const snapshot = orders.value?.version === ORDERS_SNAPSHOT_VERSION ? orders.value : undefined;
    const dates = boughtOn();
    return new Map(
      Object.entries(marks.value ?? {}).map(([id, mark]) => {
        const pledgeId = Number(id);
        const at = meltableAt({
          boughtAt: snapshot?.pledgeOrders[pledgeId]?.createdAt,
          boughtOn: dates.get(pledgeId),
          markedAt: mark.markedAt,
        });
        return [pledgeId, { ...mark, pledgeId, meltableAt: at }];
      }),
    );
  });
}

export const MELT_MARKS: InjectionKey<Readonly<Ref<ReadonlyMap<number, MarkedPledge>>>> =
  Symbol('shm-melt-marks');

/** The marked pledges provided by the manager view (see `App.vue`); none outside of it. */
export function useMarkedPledges(): Readonly<Ref<ReadonlyMap<number, MarkedPledge>>> {
  return inject(MELT_MARKS, shallowRef<ReadonlyMap<number, MarkedPledge>>(new Map()));
}
