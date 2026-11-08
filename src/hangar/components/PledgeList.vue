<script setup lang="ts">
import { i18n, type MessageKey } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed, onUnmounted } from 'vue';
import {
  PLEDGE_FILTER_PREDICATES,
  shownFilters,
  FILTER_CATEGORIES,
  type PledgeFilter,
} from '../filters';
import type { PledgeView } from '../pledge-view';
import { HANGAR_SORTS, sortEntries, type HangarSort } from '../sorting';
import { useSettings } from '@/settings/use-settings';
import { visiblePledgeIds } from '../selection';
import { canSelectPledges } from '../sidebar';
import { meltReadyIds, showMeltReady } from '../use-melt-marks';
import ManagerList from './ManagerList.vue';
import PledgeRow from './PledgeRow.vue';

const props = defineProps<{ pledges: PledgeView[]; settings: Settings; active: boolean }>();

// Value and link settings only toggle classes, so the rows don't need to re-render.
const displayClasses = computed(() => ({
  'shm-hide-values': props.settings.hideMeltValue,
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-refund': props.settings.hideRefund,
  'shm-hide-superseded-insurances': props.settings.hideSupersededInsurances,
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
  'shm-hide-select': !canSelectPledges(props.settings),
}));

const filterGroups = computed(() =>
  FILTER_CATEGORIES.map((category) => ({
    category,
    filters: shownFilters(props.settings.filters.hangar[category]),
  })),
);

const { update } = useSettings();
const sorted = computed(() => sortEntries(props.pledges, props.settings.sort.hangar));
const sortOptions = computed(() =>
  HANGAR_SORTS.map((value) => ({ value, label: i18n.t(`sort.${value}`) })),
);
const setSort = (hangar: HangarSort) => update({ sort: { ...props.settings.sort, hangar } });

/** For the sidebar: it counts the pledges search and filters leave visible. */
const showVisible = (entries: PledgeView[]) =>
  (visiblePledgeIds.value = new Set(entries.map((entry) => entry.id)));
onUnmounted(() => (visiblePledgeIds.value = null));

const filterLabel = (filter: PledgeFilter) => i18n.t(`filter.${filter}`);

/** "Show" of the sidebar's notification: only the marked pledges that can be melted now. */
const meltReadyRequest = computed(() => {
  const request = showMeltReady.value;
  return (
    request && {
      at: request.at,
      matches: (pledge: PledgeView) => meltReadyIds.value.has(pledge.id),
    }
  );
});

/** Filters whose meaning isn't obvious from the label explain it in their tooltip. */
const HINTS: Partial<Record<PledgeFilter, MessageKey>> = {
  ships: 'filter.hints.ships',
  warbond: 'filter.hints.warbond',
  valuable: 'filter.hints.valuable',
  discount: 'filter.hints.discount',
  paintRebuy: 'filter.hints.paintRebuy',
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
    :entries="sorted"
    :filter-groups="filterGroups"
    :predicates="PLEDGE_FILTER_PREDICATES"
    :filter-label="filterLabel"
    :filter-hint="filterHint"
    :active="active"
    :sort-options="sortOptions"
    :sort="settings.sort.hangar"
    :filter-request="meltReadyRequest"
    @update:sort="setSort"
    @visible="showVisible"
  >
    <template #row="{ entry, autoExpand }">
      <PledgeRow :pledge="entry" :auto-expand="autoExpand" />
    </template>
  </ManagerList>
</template>
