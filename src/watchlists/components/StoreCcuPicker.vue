<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import type { Ship } from '@/ships/ships';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref, watch } from 'vue';
import WatchlistPicker from './WatchlistPicker.vue';

/*
 * A CCU of the Pledge Store to put on watchlists (#470): to `target` from one of `bases`, the first
 * chosen first (e.g. the one with the cheapest CCU), then the watchlists as for any item.
 */

const props = defineProps<{
  target: Ship;
  /** The ships to start from, each with the CCU's price, in the order to offer them. */
  bases: readonly { ship: Ship; price: number }[];
}>();

const baseId = ref(String(props.bases[0]?.ship.id ?? ''));
watch(
  () => props.bases.map((base) => base.ship.id).join(),
  () => {
    if (!props.bases.some((base) => String(base.ship.id) === baseId.value)) {
      baseId.value = String(props.bases[0]?.ship.id ?? '');
    }
  },
);
const options = computed(() =>
  props.bases.map((base) => ({
    value: String(base.ship.id),
    label: i18n.t('watchlists.ccuFrom', [base.ship.name, formatUsd(base.price, locale.value)]),
  })),
);
const base = computed(() => props.bases.find((entry) => String(entry.ship.id) === baseId.value));
const item = computed(
  () =>
    base.value && {
      kind: 'storeCcu' as const,
      fromShipId: base.value.ship.id,
      toShipId: props.target.id,
      name: i18n.t('watchlists.ccuName', [base.value.ship.name, props.target.name]),
      value: base.value.price,
    },
);
</script>

<template>
  <WatchlistPicker v-if="item" class="shm-store-ccu-picker" :item="item">
    <template #choice>
      <SelectMenu
        v-if="options.length > 1"
        v-model="baseId"
        v-tooltip="i18n.t('watchlists.ccuBase')"
        :options="options"
        :label="i18n.t('watchlists.ccuBase')"
        icon="square-up-right"
        align="start"
        button-class="shm-button"
      />
      <span v-else class="shm-store-ccu-base">{{ options[0]?.label }}</span>
    </template>
  </WatchlistPicker>
</template>

<style>
.shm-store-ccu-base {
  color: var(--shm-text-secondary);
}
</style>
