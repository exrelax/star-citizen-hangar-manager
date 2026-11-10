<script setup lang="ts">
import { locale } from '@/i18n';
import { useNow } from '@/shared/use-now';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { PriceIncreaseMatch } from '../price-increase-match';
import { priceIncreaseLabel, type PriceIncreasePlace } from '../price-increase-label';

/*
 * The badge of an item whose price is expected to rise (#191), with its countdown: a warning in
 * the buy back, an information in My Hangar. It goes away on its own once the time is reached.
 */

const props = defineProps<{ match: PriceIncreaseMatch; place: PriceIncreasePlace }>();

const now = useNow();
const label = computed(() => priceIncreaseLabel(props.match, props.place, now.value, locale.value));
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
