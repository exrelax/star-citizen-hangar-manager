import { buybackCheckState } from '@/buyback/buyback-storage';
import { onMounted, onUnmounted, shallowRef } from 'vue';
import { hangarCheckState, type CheckState } from './hangar-storage';

const ITEMS = { hangar: hangarCheckState, buyback: buybackCheckState };

/** State of the smart update checks of the hangar or the buy back, kept up to date. */
export function useCheckState(source: keyof typeof ITEMS = 'hangar') {
  const item = ITEMS[source];
  const checkState = shallowRef<CheckState | null>(null);
  const unwatch = item.watch((value) => (checkState.value = value));
  onMounted(async () => (checkState.value = await item.getValue()));
  onUnmounted(unwatch);
  return checkState;
}
