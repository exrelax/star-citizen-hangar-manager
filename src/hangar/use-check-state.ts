import { onMounted, onUnmounted, shallowRef } from 'vue';
import { hangarCheckState, type CheckState } from './hangar-storage';

/** State of the smart update checks, kept up to date. */
export function useCheckState() {
  const checkState = shallowRef<CheckState | null>(null);
  const unwatch = hangarCheckState.watch((value) => (checkState.value = value));
  onMounted(async () => (checkState.value = await hangarCheckState.getValue()));
  onUnmounted(unwatch);
  return checkState;
}
