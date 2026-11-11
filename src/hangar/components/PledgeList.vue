<script setup lang="ts">
import { i18n, type MessageKey } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed, onUnmounted } from 'vue';
import {
  PLEDGE_FILTER_PREDICATES,
  shownFilters,
  FILTER_CATEGORIES,
  type FilterStates,
  type PledgeFilter,
} from '../filters';
import type { PledgeView } from '../pledge-view';
import { HANGAR_SORTS, sortEntries, type HangarSort } from '../sorting';
import { useSettings } from '@/settings/use-settings';
import { visiblePledgeIds } from '../selection';
import { canSelectPledges } from '../sidebar';
import { meltReadyIds } from '../use-melt-marks';
import { clearHangarFilter, hangarViewFilter, type HangarViewFilter } from '../view-filter';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import { hasPriceChangeWithin } from '@/price-increases/price-change-filter';
import { useNow } from '@/shared/use-now';
import { FILTER_HIGHLIGHTS } from '@/config';
import { highlightClasses } from '../highlights';
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

/**
 * "Price change ahead" (#256): a price change within the days of the Buy Back Reminder, so it
 * changes with them and with the time; offered only while a pledge has one.
 */
const now = useNow();
const predicates = computed(() => ({
  ...PLEDGE_FILTER_PREDICATES,
  priceChange: (pledge: PledgeView) =>
    hasPriceChangeWithin(pledge, now.value, props.settings.priceIncreaseDays),
}));
const hasPriceChange = computed(() => props.pledges.some(predicates.value.priceChange));

const filterGroups = computed(() =>
  FILTER_CATEGORIES.map((category) => ({
    category,
    filters: shownFilters(props.settings.filters.hangar[category]).filter(
      (filter) => filter !== 'priceChange' || hasPriceChange.value,
    ),
  })),
);

const { update } = useSettings();
const sorted = computed(() => sortEntries(props.pledges, props.settings.sort.hangar));
const sortOptions = computed(() =>
  HANGAR_SORTS.map((value) => ({ value, label: i18n.t(`sort.${value}`) })),
);
const setSort = (hangar: HangarSort) => update({ sort: { ...props.settings.sort, hangar } });

/** What the included filters and the sorting are about, highlighted in the rows (#216). */
const highlights = (states: FilterStates<PledgeFilter>) =>
  highlightClasses(
    FILTER_HIGHLIGHTS.hangar,
    states,
    FILTER_HIGHLIGHTS.sorts[props.settings.sort.hangar],
  );

/** For the sidebar: it counts the pledges search and filters leave visible. */
const showVisible = (entries: PledgeView[]) =>
  (visiblePledgeIds.value = new Set(entries.map((entry) => entry.id)));
onUnmounted(() => (visiblePledgeIds.value = null));

const filterLabel = (filter: PledgeFilter) => i18n.t(`filter.${filter}`);

/** The filter without a button set from the sidebar (see `view-filter.ts`), while it is on. */
const VIEW_FILTERS: Record<HangarViewFilter, (pledge: PledgeView) => boolean> = {
  meltReady: (pledge) => meltReadyIds.value.has(pledge.id),
  paintRebuy: (pledge) => paintRebuys.value.has(pledge.id),
};
const viewFilterRequest = computed(() => {
  const request = hangarViewFilter.value;
  return request && { at: request.at, matches: VIEW_FILTERS[request.id] };
});

/** Filters whose meaning isn't obvious from the label explain it in their tooltip. */
const HINTS: Partial<Record<PledgeFilter, MessageKey>> = {
  ships: 'filter.hints.ships',
  warbond: 'filter.hints.warbond',
  valuable: 'filter.hints.valuable',
  discount: 'filter.hints.discount',
  rewards: 'filter.hints.rewards',
};
const filterHint = (filter: PledgeFilter) => {
  if (filter === 'priceChange') {
    return i18n.t('filter.hints.priceChange', [props.settings.priceIncreaseDays]);
  }
  const hint = HINTS[filter];
  return hint && i18n.t(hint);
};
</script>

<template>
  <ManagerList
    :class="displayClasses"
    :entries="sorted"
    :filter-groups="filterGroups"
    :predicates="predicates"
    :filter-label="filterLabel"
    :filter-hint="filterHint"
    :active="active"
    :sort-options="sortOptions"
    :sort="settings.sort.hangar"
    :highlights="highlights"
    :filter-request="viewFilterRequest"
    @clear-request="clearHangarFilter()"
    @update:sort="setSort"
    @visible="showVisible"
  >
    <template #row="{ entry, autoExpand }">
      <PledgeRow :pledge="entry" :auto-expand="autoExpand" />
    </template>
  </ManagerList>
</template>
