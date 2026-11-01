import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { hangarSnapshot } from './hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from './pledge';
import { toPledgeView, type PledgeView } from './pledge-view';

/**
 * Pledges of the stored hangar snapshot, kept up to date after each sync.
 * `shallowRef`: the list is replaced as a whole, so Vue doesn't need deep proxies for
 * thousands of pledges.
 */
export function useHangarPledges() {
  const pledges = shallowRef<PledgeView[]>([]);
  const loaded = ref(false);
  /** ISO timestamp of the last full sync. */
  const syncedAt = ref<string>();

  const apply = (snapshot: HangarSnapshot | null) => {
    const current = snapshot?.version === HANGAR_SNAPSHOT_VERSION ? snapshot : null;
    pledges.value = current
      ? current.pledges.map((pledge) => toPledgeView(pledge, current.shipLinks))
      : [];
    syncedAt.value = current?.syncedAt;
    loaded.value = true;
  };

  const unwatch = hangarSnapshot.watch(apply);
  onMounted(async () => apply(await hangarSnapshot.getValue()));
  onUnmounted(unwatch);

  return { pledges, loaded, syncedAt };
}
