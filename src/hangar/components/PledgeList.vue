<script setup lang="ts">
import { i18n, locale, type MessageKey } from '@/i18n';
import { today } from '@/orders/refund';
import { useProvidedCoverageSources } from '@/ccu-consultant/coverage';
import type { GroupBadgeContext } from '../group-badges';
import type { Settings } from '@/settings/settings';
import { computed, onUnmounted, ref } from 'vue';
import type { EmbeddedList } from '@/watchlists/embedded-list';
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
import { hangarFilterRequest, hangarFilterStates } from '../hangar-filter-request';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import { hasPriceChangeWithin } from '@/price-increases/price-change-filter';
import { useNow } from '@/shared/use-now';
import { FILTER_HIGHLIGHTS } from '@/config';
import { highlightClasses } from '../highlights';
import ManagerList from './ManagerList.vue';
import { paintRefinement, useProvidedOwnedShips } from '../paint-ships';
import { pledgeShipKind, shipKindRefinement } from '../ship-kind';
import { ccuRefinementWithContents, hangarCcuContents } from '../ccu-contents';
import { ccuRefinement } from '@/ccu-consultant/base-ship-list';
import { useProvidedCcuCoverage } from '@/ccu-consultant/coverage';
import { useProvidedAlwaysAvailable } from '@/ccu-consultant/always-available';
import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import { isPaintItem } from '../pledge-view';
import { listViewRequest } from '../list-jump';
import PledgeRow from './PledgeRow.vue';
import GroupRow from './GroupRow.vue';
import CcuCoverage from '@/ccu-consultant/components/CcuCoverage.vue';
import { groupCoverage } from '@/ccu-consultant/group-coverage';
import { extrasNote, pledgeGroupBadges, pledgeGroupKind } from '../group-badges';
import { pledgeFacts } from '../grouping';
import { useMarkedPledges } from '../use-melt-marks';

const props = defineProps<{
  pledges: PledgeView[];
  settings: Settings;
  active: boolean;
  /**
   * Shown inside another view, e.g. a watchlist (#467): its search from outside, its own order and
   * grouped view, and none of My Hangar's state (the sidebar's counts and toggles, the requests).
   */
  embedded?: EmbeddedList;
}>();

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
/**
 * "Paints" for owned ships or for ships not owned (#336), by the hangar's ships; "CCUs" without
 * base ship or with an always available one (#461), by the CCU Consultant's coverage; "Ships" by
 * what they hold besides the ship (#514).
 */
const ownedShips = useProvidedOwnedShips();
const coverages = useProvidedCcuCoverage();
const alwaysAvailable = useProvidedAlwaysAvailable();
const refinements = computed(() => ({
  paints: paintRefinement<PledgeView>(ownedShips.value, (pledge) => [
    pledge.title,
    ...pledge.items.filter(isPaintItem).map((item) => item.title),
  ]),
  // "CCUs" by base ship (#461) and by what they bring (#566).
  ccus: ccuRefinementWithContents(
    ccuRefinement<PledgeView>(coverages.value, alwaysAvailable.value),
    (pledge) => hangarCcuContents(pledge.upgrade),
  ),
  // "Ships" by what they hold besides the ship (#514).
  ships: shipKindRefinement<PledgeView>((pledge) => pledgeShipKind(pledge.items)),
}));
/** The base ship coverage of a group of CCUs (#574); none for other groups. */
const coverageOfGroup = (group: { items: readonly PledgeView[] }) =>
  group.items.every((item) => item.isCcu)
    ? groupCoverage(
        group.items.map((item) => item.id),
        coverages.value,
      )
    : undefined;
/** What a group's labels taken from its items need (#487): the CCU Consultant's, today. */
const coverageSources = useProvidedCoverageSources();
const removals = useProvidedRemovalCcus();
const markedPledges = useMarkedPledges();
const badgeContext = computed((): GroupBadgeContext => ({
  coverageOf: (id) => coverages.value.get(id),
  ...(alwaysAvailable.value && { alwaysAvailable: alwaysAvailable.value }),
  leaving: removals.value.obtainable,
  ships: coverageSources.value.ships,
  today: today.value,
  locale: locale.value,
  // The melt label of a group with marked items (#552).
  marks: markedPledges.value,
  now: now.value,
}));

const filterGroups = computed(() =>
  FILTER_CATEGORIES.map((category) => ({
    category,
    filters: shownFilters(props.settings.filters.hangar[category]).filter(
      (filter) => filter !== 'priceChange' || hasPriceChange.value,
    ),
  })),
);

const { update } = useSettings();
/** The order: My Hangar's, or an embedded list's own, starting from it. */
const ownSort = ref<HangarSort>(props.settings.sort.hangar);
const sort = computed(() => (props.embedded ? ownSort.value : props.settings.sort.hangar));
const sorted = computed(() => sortEntries(props.pledges, sort.value));
const sortOptions = computed(() =>
  HANGAR_SORTS.map((value) => ({ value, label: i18n.t(`sort.${value}`) })),
);
const setSort = (hangar: HangarSort) => {
  if (props.embedded) ownSort.value = hangar;
  else update({ sort: { ...props.settings.sort, hangar } });
};
/** The grouped view (#447), remembered for this list (all watchlists share one). */
const groupedOn = computed(() =>
  props.embedded ? props.settings.grouped.watchlists : props.settings.grouped.hangar,
);
const setGrouped = (on: boolean) =>
  update({
    grouped: { ...props.settings.grouped, [props.embedded ? 'watchlists' : 'hangar']: on },
  });
/** Groups can be selected where single pledges can. */
const canSelect = computed(() => canSelectPledges(props.settings));

/** What the included filters and the sorting are about, highlighted in the rows (#216). */
const highlights = (states: FilterStates<PledgeFilter>) =>
  highlightClasses(FILTER_HIGHLIGHTS.hangar, states, FILTER_HIGHLIGHTS.sorts[sort.value]);

/** For the sidebar: it counts the pledges search and filters leave visible. */
const showVisible = (entries: PledgeView[]) => {
  if (!props.embedded) visiblePledgeIds.value = new Set(entries.map((entry) => entry.id));
};
onUnmounted(() => !props.embedded && (visiblePledgeIds.value = null));
/** For the sidebar's filter toggles (#254). */
const showFilterStates = (states: FilterStates<PledgeFilter>) => {
  if (!props.embedded) hangarFilterStates.value = states;
};
onUnmounted(() => !props.embedded && (hangarFilterStates.value = new Map()));

const filterLabel = (filter: PledgeFilter) => i18n.t(`filter.${filter}`);

/** The filter without a button set from the sidebar (see `view-filter.ts`), while it is on. */
const VIEW_FILTERS: Record<HangarViewFilter, (pledge: PledgeView) => boolean> = {
  meltReady: (pledge) => meltReadyIds.value.has(pledge.id),
  paintRebuy: (pledge) => paintRebuys.value.has(pledge.id),
};
const viewFilterRequest = computed(() => {
  const request = props.embedded ? null : hangarViewFilter.value;
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
    return i18n.n('filter.hints.priceChange', props.settings.priceIncreaseDays);
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
    :refinements="refinements"
    :filter-label="filterLabel"
    :filter-hint="filterHint"
    :active="active"
    :sort-options="sortOptions"
    :sort="sort"
    :highlights="highlights"
    :filter-request="viewFilterRequest"
    :include-request="embedded ? null : hangarFilterRequest"
    :view-request="!embedded && listViewRequest?.tab === 'hangar' ? listViewRequest : null"
    :grouping="{ on: groupedOn, factsOf: pledgeFacts }"
    :search="embedded?.search"
    :hide-controls="embedded?.hideControls"
    @clear-request="clearHangarFilter()"
    @update:sort="setSort"
    @visible="showVisible"
    @filter-states="showFilterStates"
    @update:grouped="setGrouped"
  >
    <template #row="{ entry, autoExpand }">
      <PledgeRow :pledge="entry" :auto-expand="autoExpand" />
    </template>
    <template #group="{ group, open }">
      <GroupRow
        :group="group"
        :kind="pledgeGroupKind(group)"
        :ships="group.items[0]!.ships.map((ship) => ship.name)"
        :badges="pledgeGroupBadges(group, badgeContext)"
        :note="extrasNote(group.extras)"
        :selectable="canSelect"
        :list-classes="displayClasses"
        :open="open"
        watch-kind="hangar"
      >
        <template #item="{ entry, autoExpand }">
          <PledgeRow :pledge="entry" :auto-expand="autoExpand" />
        </template>
        <!-- A group of CCUs: the base ship of all of them (#574). -->
        <template v-if="coverageOfGroup(group)" #head>
          <CcuCoverage
            :coverage="coverageOfGroup(group)!.coverage"
            :of-group="coverageOfGroup(group)!"
          />
        </template>
      </GroupRow>
    </template>
  </ManagerList>
</template>
