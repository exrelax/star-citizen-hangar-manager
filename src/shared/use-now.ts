import { CLOCK_TICK_MS } from '@/config';
import { getCurrentScope, onScopeDispose, shallowRef, type Ref } from 'vue';

/*
 * The current time for countdowns on screen, updated every `CLOCK_TICK_MS` by one timer for the
 * whole page, which runs while anything uses it.
 */

const now = shallowRef(Date.now());
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/** The current time in ms, updated regularly while a component or scope uses it. */
export function useNow(): Readonly<Ref<number>> {
  if (users++ === 0) {
    now.value = Date.now();
    timer = setInterval(() => (now.value = Date.now()), CLOCK_TICK_MS);
  }
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (--users === 0) clearInterval(timer);
    });
  }
  return now;
}
