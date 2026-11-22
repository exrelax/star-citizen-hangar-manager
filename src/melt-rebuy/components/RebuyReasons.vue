<script setup lang="ts">
import { i18n } from '@/i18n';
import { computed } from 'vue';
import type { RebuyReason } from '../rebuyable';
import { rebuyReasonPlainText, rebuyReasonText } from '../rebuy-text';

/*
 * Why a meltable pledge can't be rebought without loss (#530), in its opened row: what would be
 * lost by melting it and buying it again with store credit (e.g. "Giftable", "Discount of $40").
 */

const props = defineProps<{
  reasons: readonly RebuyReason[];
  /** "Hide melt value": the discounts without their amounts. */
  hideValues?: boolean;
}>();

// Two reasons may read the same without amounts (e.g. a discount): each text once.
const texts = computed(() => [
  ...new Set(props.reasons.map(props.hideValues ? rebuyReasonPlainText : rebuyReasonText)),
]);
</script>

<template>
  <section class="shm-rebuy-reasons">
    <h4>{{ i18n.t('meltRebuy.notRebuyable') }}</h4>
    <ul>
      <li v-for="text in texts" :key="text">{{ text }}</li>
    </ul>
  </section>
</template>

<style scoped>
/* Laid out like the groups of "Base ship" (CcuCoverage.vue): a quiet heading and a short list. */
.shm-rebuy-reasons {
  margin-top: 8px;
}

.shm-rebuy-reasons h4 {
  margin: 0 0 2px;
  color: var(--shm-text-muted);
  font-size: inherit;
  font-weight: normal;
}

.shm-rebuy-reasons ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-rebuy-reasons li {
  padding: 3px 0;
  color: var(--shm-text);
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.08);
}
</style>
