<script setup lang="ts">
import { CLOCK_TICK_MS } from '@/config';
import { locale } from '@/i18n';
import { useNow } from '@/shared/use-now';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import type { PriceIncreaseMatch } from '../price-increase-match';
import {
  priceIncreaseLabel,
  SECONDS_COUNTDOWN_MS,
  type PriceIncreasePlace,
} from '../price-increase-label';

/*
 * The badge of an item whose price is expected to rise (#191), with its countdown: a warning in
 * the buy back, an information in My Hangar. It goes away on its own once the time is reached.
 * The page's clock ticks every `CLOCK_TICK_MS`; in the last hour, when the countdown shows
 * seconds, the badge ticks every second on its own (started a tick early, so it is never late).
 */

const props = defineProps<{ match: PriceIncreaseMatch; place: PriceIncreasePlace }>();

const pageNow = useNow();
const secondsNow = shallowRef<number>();
let timer: ReturnType<typeof setInterval> | undefined;

const showsSeconds = computed(() => {
  const time = props.match.increase.priceIncreaseAt;
  if (time.dayOnly) return false;
  const left = time.at - pageNow.value;
  return left > -CLOCK_TICK_MS && left < SECONDS_COUNTDOWN_MS + CLOCK_TICK_MS;
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

const label = computed(() =>
  priceIncreaseLabel(props.match, props.place, secondsNow.value ?? pageNow.value, locale.value),
);
</script>

<template>
  <span
    v-if="label"
    v-tooltip="label.hint"
    class="shm-badge is-price-increase"
    :class="[place === 'buyback' ? 'is-warning' : 'is-info', { 'is-soon': label.soon }]"
    tabindex="0"
  >
    {{ label.text }}
  </span>
</template>
