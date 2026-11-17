<script setup lang="ts">
import { locale } from '@/i18n';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { CcuPriceChange } from '../ccu-price-change';
import type { PriceIncreaseMatch } from '../price-increase-match';
import { priceIncreaseLabel, type PriceIncreasePlace } from '../price-increase-label';

/*
 * The badge of an item whose price is expected to rise (#191), with its countdown: a warning in
 * the buy back, an information in My Hangar; with the change where it is known (#251), and as a
 * warning for a CCU that loses upgrade value (its base ship rises, `ccu`). It goes away on its own once the time is reached.
 * The countdown ticks with the page's clock, in the last hour every second (`useCountdownNow`).
 */

const props = defineProps<{
  match?: PriceIncreaseMatch;
  ccu?: CcuPriceChange;
  place: PriceIncreasePlace;
}>();

/** The times the label may count down to: of the item, and of a CCU's both ships. */
const now = useCountdownNow(() =>
  [props.match?.increase, props.ccu?.base, props.ccu?.target].flatMap((increase) =>
    increase ? [increase.priceIncreaseAt] : [],
  ),
);

const label = computed(() =>
  priceIncreaseLabel(props.match, props.place, now.value, locale.value, props.ccu),
);
</script>

<template>
  <span
    v-if="label"
    v-tooltip="label.hint"
    class="shm-badge is-price-increase"
    :class="[label.tone === 'warning' ? 'is-warning' : 'is-info', { 'is-soon': label.soon }]"
    tabindex="0"
  >
    {{ label.text }}
  </span>
</template>
