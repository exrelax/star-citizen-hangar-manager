import { ref, shallowRef } from 'vue';
import { fetchStoreData } from './fetch-store';
import type { StoreData } from './warbond';

/*
 * The pledge store's offers, read from RSI when the tab is opened. They change with RSI's sales,
 * so they aren't stored: one read per page view, shared by every use of this composable.
 */

const data = shallowRef<StoreData>();
const error = ref<string>();
const loading = ref(false);
let request: Promise<void> | undefined;

/** Reads the offers once per page view (again after a failure). */
function load(fetchData = fetchStoreData): Promise<void> {
  request ??= (async () => {
    loading.value = true;
    error.value = undefined;
    try {
      data.value = await fetchData();
    } catch (cause) {
      console.error('[star-citizen-hangar-manager] Pledge store unavailable', cause);
      error.value = cause instanceof Error ? cause.message : String(cause);
      request = undefined;
    } finally {
      loading.value = false;
    }
  })();
  return request;
}

export function useStoreData() {
  return { data, error, loading, load };
}
