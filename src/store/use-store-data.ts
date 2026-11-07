import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { STORE_SNAPSHOT_VERSION, storeSnapshot, type StoreSnapshot } from './store-storage';

/** The stored offers of the pledge store, kept up to date after each refresh (see sync-store.ts). */
export function useStoreData() {
  const snapshot = shallowRef<StoreSnapshot | null>(null);
  /** Set once the stored offers were read (there may be none). */
  const loaded = ref(false);

  const unwatch = storeSnapshot.watch((value) => (snapshot.value = value));
  onMounted(async () => {
    snapshot.value = await storeSnapshot.getValue();
    loaded.value = true;
  });
  onUnmounted(unwatch);

  const current = computed(() =>
    snapshot.value?.version === STORE_SNAPSHOT_VERSION ? snapshot.value : undefined,
  );
  return {
    data: computed(() => current.value?.data),
    /** Epoch milliseconds of the read. */
    fetchedAt: computed(() => current.value && Date.parse(current.value.fetchedAt)),
    loaded,
  };
}
