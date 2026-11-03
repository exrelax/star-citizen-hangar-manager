<script setup lang="ts">
import { i18n, type MessageKey } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed } from 'vue';
import { PLEDGE_FILTER_PREDICATES, shownFilters, type PledgeFilter } from '../filters';
import type { PledgeView } from '../pledge-view';
import ManagerList from './ManagerList.vue';
import PledgeRow from './PledgeRow.vue';

const props = defineProps<{ pledges: PledgeView[]; settings: Settings; active: boolean }>();

// Value and link settings only toggle classes, so the rows don't need to re-render.
const displayClasses = computed(() => ({
  'shm-hide-values': props.settings.hideMeltValue,
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-refund': !props.settings.showRefund,
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
}));

const filters = computed(() => shownFilters(props.settings.filters.hangar));

const filterLabel = (filter: PledgeFilter) => i18n.t(`filter.${filter}`);

/** Filters whose meaning isn't obvious from the label explain it in their tooltip. */
const HINTS: Partial<Record<PledgeFilter, MessageKey>> = {
  ships: 'filter.hints.ships',
  warbond: 'filter.hints.warbond',
  valuable: 'filter.hints.valuable',
  rewards: 'filter.hints.rewards',
};
const filterHint = (filter: PledgeFilter) => {
  const hint = HINTS[filter];
  return hint && i18n.t(hint);
};
</script>

<template>
  <ManagerList
    :class="displayClasses"
    :entries="pledges"
    :filters="filters"
    :predicates="PLEDGE_FILTER_PREDICATES"
    :filter-label="filterLabel"
    :filter-hint="filterHint"
    :active="active"
  >
    <template #row="{ entry, autoExpand }">
      <PledgeRow :pledge="entry" :auto-expand="autoExpand" />
    </template>
  </ManagerList>
</template>
