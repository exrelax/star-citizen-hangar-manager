import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import { computed, type ComputedRef } from 'vue';
import { useProvidedAlwaysAvailable } from './always-available';
import { baseShipList, type BaseShipList } from './base-ship-list';
import { useProvidedCcuCoverage, useProvidedCoverageSources } from './coverage';

/*
 * The CCU Consultant's list of base ships (#113) from what the manager view provides: the coverage
 * of every CCU, the always available ships and the ships leaving the Pledge Store. Shared by the
 * consultant and its sidebar box (#115), so both always count the same.
 */
export function useBaseShipList(): ComputedRef<BaseShipList> {
  const coverages = useProvidedCcuCoverage();
  const alwaysAvailable = useProvidedAlwaysAvailable();
  const sources = useProvidedCoverageSources();
  const removals = useProvidedRemovalCcus();
  return computed(() =>
    baseShipList(
      coverages.value.values(),
      alwaysAvailable.value,
      sources.value.ships,
      removals.value.obtainable,
    ),
  );
}

/**
 * What the box and the tab "Without base ship" count (#115, #454): the CCUs without base ship
 * today, those soon without one, and those with too few ways to their base ship.
 */
export interface MissingCounts {
  missing: number;
  soon: number;
  tooFew: number;
  total: number;
}

export function missingCounts(list: BaseShipList): MissingCounts {
  const missing = list.groups.missing.reduce((sum, row) => sum + row.ccus.length, 0);
  return {
    missing,
    soon: list.soonCount,
    tooFew: list.tooFewCount,
    total: missing + list.soonCount + list.tooFewCount,
  };
}
