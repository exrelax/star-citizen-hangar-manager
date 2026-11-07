<script setup lang="ts">
import { i18n } from '@/i18n';
import { useSettings } from '@/settings/use-settings';
import { ref } from 'vue';
import OrderOverlay from './OrderOverlay.vue';
import { HIDDEN, type PaidOrder } from './orders';
import { vTooltip } from '@/shared/tooltip/tooltip';

/**
 * `base`: the pledge's ship was upgraded since – the order is the one of its base pledge.
 * `refundable`: the pledge is still in the hangar, so its details offer a refund request while
 * the refund period lasts (not for melted pledges).
 */
defineProps<{ order: PaidOrder; base?: boolean; refundable?: boolean }>();

const open = ref(false);
// With hidden ids the link stays, masked, so the details can still be opened (also masked).
const { settings } = useSettings();
</script>

<!--
  The order that created a pledge, if paid with money. Id and amount follow the settings for
  hiding sensitive information: the amount is hidden by the list (row.css), the id masked here. The id opens the order's details (in the demo
  anonymized, see OrderOverlay.vue).
-->
<template>
  <p class="shm-order">
    {{ i18n.t(base ? 'order.baseLabel' : 'order.label') }}
    <a
      v-tooltip="i18n.t('order.open')"
      class="shm-order-id is-link"
      href="#"
      @click.prevent="open = true"
    >
      #{{ settings.hidePledgeIds ? HIDDEN : order.id }}
    </a>
    <span class="shm-value"> · {{ i18n.t('order.paid', [order.amount]) }}</span>
    <template v-if="order.placedAt"> · {{ order.placedAt }}</template>
    <span v-if="order.buyback" class="shm-order-buyback"> · {{ i18n.t('order.buyback') }}</span>
  </p>
  <OrderOverlay v-if="open" :order="order" :refundable="refundable" @close="open = false" />
</template>

<style scoped>
.shm-order {
  margin: 0 0 6px;
  color: var(--shm-text-muted);
}

.shm-order-id {
  color: var(--shm-text);
  font-variant-numeric: tabular-nums;
}

.shm-order-id.is-link {
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-order-id.is-link:hover,
.shm-order-id.is-link:focus-visible {
  text-decoration: underline;
  outline: none;
}
</style>
