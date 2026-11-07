<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed, watch } from 'vue';
import { useStoreData } from '../use-store-data';
import { buildWarbondOffers } from '../warbond';
import WarbondRow from './WarbondRow.vue';

/*
 * The "Pledge Store" tab: the warbond CCUs RSI currently offers, each with the cheapest ships to
 * start from and the hangar's CCUs that can't be chained with it. The offers are read from RSI when the
 * tab is first opened.
 */

const props = defineProps<{
  /** The hangar's pledges (in the demo mode the demo selection), for the CCUs it already has. */
  pledges: PledgeView[];
  /** The buy back's pledges (in the demo mode the demo selection), for the ships it has. */
  buyback: BuybackView[];
  settings: Settings;
  active: boolean;
}>();

const { data, error, loading, load } = useStoreData();
watch(
  () => props.active,
  (active) => {
    if (active && !data.value) void load();
  },
  { immediate: true },
);

const offers = computed(() =>
  data.value ? buildWarbondOffers(data.value, props.pledges, props.buyback) : [],
);

const displayClasses = computed(() => ({
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-values': props.settings.hideMeltValue,
}));
</script>

<template>
  <section class="shm-store" :class="displayClasses" aria-labelledby="shm-store-title">
    <h3 id="shm-store-title" class="shm-store-title">{{ i18n.t('store.warbondTitle') }}</h3>
    <p class="shm-store-intro">{{ i18n.t('store.warbondIntro') }}</p>

    <p v-if="loading && !data" class="shm-store-state" role="status">
      {{ i18n.t('store.loading') }}
    </p>
    <div v-else-if="error && !data" class="shm-store-state is-error" role="alert">
      <p>{{ i18n.t('store.failed', [error]) }}</p>
      <button type="button" class="shm-button" @click="load()">{{ i18n.t('store.retry') }}</button>
    </div>
    <template v-else-if="data">
      <p class="shm-count">{{ i18n.t('store.count', [offers.length]) }}</p>
      <!-- The container of the manager's lists: their gaps and compact view (row.css, modern.css). -->
      <div v-if="offers.length" class="shm-rows">
        <WarbondRow v-for="offer in offers" :key="offer.target.skuId" :offer="offer" />
      </div>
      <p v-if="!offers.length" class="shm-store-state">{{ i18n.t('store.empty') }}</p>
    </template>
  </section>
</template>

<style scoped>
.shm-store {
  margin-top: 20px;
}

.shm-store-title {
  margin: 0 0 4px;
  color: var(--shm-text-strong);
  font-size: calc(16px * var(--shm-font-scale));
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-store-intro {
  margin: 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-count {
  margin: 10px 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-store-state {
  margin: 20px 0;
  color: var(--shm-text-muted);
}

.shm-store-state.is-error p {
  margin: 0 0 8px;
  color: var(--shm-danger);
}
</style>
