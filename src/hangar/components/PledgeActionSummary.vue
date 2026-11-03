<script setup lang="ts">
import { i18n } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { useSettings } from '@/settings/use-settings';
import { computed } from 'vue';
import { pledgeKind } from '../pledge-kind';
import type { PledgeView } from '../pledge-view';

/** The pledge a dialog acts on (exchange, gift): its kind, title, id and value, up front. */
const props = defineProps<{
  pledge: PledgeView;
  /** Above and below the value, e.g. "You receive" … "in store credit". */
  valueLabel: string;
  valueCaption?: string;
}>();

// The settings for hiding sensitive information apply here as in the list.
const { settings } = useSettings();
const kind = computed(() => pledgeKind(props.pledge));
const value = computed(() => (settings.value.hideMeltValue ? HIDDEN : props.pledge.value));
const pledgeId = computed(() => (settings.value.hidePledgeIds ? HIDDEN : props.pledge.id));
</script>

<template>
  <div class="shm-action-summary">
    <div class="shm-action-item">
      <span class="shm-action-kind" :class="`is-${kind}`">
        {{ i18n.t(`pledge.kinds.${kind}`) }}
      </span>
      <strong class="shm-action-title">{{ pledge.title }}</strong>
      <span class="shm-action-id">#{{ pledgeId }}</span>
    </div>
    <div class="shm-action-value">
      <span>{{ valueLabel }}</span>
      <strong>{{ value }}</strong>
      <span v-if="valueCaption">{{ valueCaption }}</span>
    </div>
  </div>
</template>
