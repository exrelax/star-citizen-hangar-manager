import { CLOCK_TICK_MS } from '@/config';
import type { DayOrTime } from '@/site-data/site-data';
import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue';
import { useNow } from './use-now';

/*
 * The current time for a countdown to a time of the website's files (`countdown` in
 * `price-increases/price-increase-label.ts`): the page's clock, every `CLOCK_TICK_MS`; in the last
 * hour, when the countdown shows seconds, every second (started a tick early, so it is never
 * late). A day without a time never shows seconds.
 */

const HOUR = 60 * 60 * 1000;
/** Less than this left: the countdown shows seconds, so it is updated every second. */
export const SECONDS_COUNTDOWN_MS = HOUR;

/** The time for the countdown to `target`; several targets: the next one decides. */
export function useCountdownNow(
  target: () => DayOrTime | readonly DayOrTime[] | undefined,
): Readonly<Ref<number>> {
  const pageNow = useNow();
  const secondsNow = shallowRef<number>();
  let timer: ReturnType<typeof setInterval> | undefined;

  const showsSeconds = computed(() => {
    const value = target();
    const times = value === undefined ? [] : Array.isArray(value) ? value : [value as DayOrTime];
    return times.some((time) => {
      if (time.dayOnly) return false;
      const left = time.at - pageNow.value;
      return left > -CLOCK_TICK_MS && left < SECONDS_COUNTDOWN_MS + CLOCK_TICK_MS;
    });
  });
  watch(
    showsSeconds,
    (on) => {
      clearInterval(timer);
      secondsNow.value = on ? Date.now() : undefined;
      if (on) timer = setInterval(() => (secondsNow.value = Date.now()), 1000);
    },
    { immediate: true },
  );
  onScopeDispose(() => clearInterval(timer));
  return computed(() => secondsNow.value ?? pageNow.value);
}
