<script setup lang="ts">
import ManagerList from '@/hangar/components/ManagerList.vue';
import { FILTER_CATEGORIES, shownFilters, type FilterStates } from '@/hangar/filters';
import { highlightClasses } from '@/hangar/highlights';
import { FILTER_HIGHLIGHTS } from '@/config';
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed, ref } from 'vue';
import type { EmbeddedList } from '@/watchlists/embedded-list';
import { BUYBACK_FILTER_PREDICATES, type BuybackFilter, type BuybackView } from '../buyback-view';
import { giftableHint } from '../giftable-hint';
import BuybackRow from './BuybackRow.vue';
import GroupRow from '@/hangar/components/GroupRow.vue';
import CcuCoverage from '@/ccu-consultant/components/CcuCoverage.vue';
import { useProvidedBuybackCcuCoverage } from '@/ccu-consultant/coverage';
import { groupCoverage } from '@/ccu-consultant/group-coverage';
import { buybackGroupBadges, buybackGroupKind, extrasNote } from '@/hangar/group-badges';
import { buybackFacts } from '@/hangar/grouping';
import { paintRefinement, useProvidedOwnedShips } from '@/hangar/paint-ships';
import { shipKindRefinement } from '@/hangar/ship-kind';
import { allCcus, ccuRefinementWithContents } from '@/hangar/ccu-contents';
import { BUYBACK_SORTS, sortEntries, type BuybackSort } from '@/hangar/sorting';
import { useSettings } from '@/settings/use-settings';
import { hasPriceChangeWithin } from '@/price-increases/price-change-filter';
import { buybackFilterRequest } from '../buyback-filter-request';
import { listViewRequest } from '@/hangar/list-jump';
import { closeListShortcut, filterRequestOf, listShortcuts } from '@/hangar/list-shortcut';
import { useNow } from '@/shared/use-now';

const props = defineProps<{
  pledges: BuybackView[];
  settings: Settings;
  active: boolean;
  /** Shown inside another view, e.g. a watchlist (#467): as `PledgeList`'s `embedded`. */
  embedded?: EmbeddedList;
}>();
const emit = defineEmits<{
  /** The pledges search and filters leave visible, e.g. for a watchlist's "Select all" (#620). */
  visible: [ids: number[]];
}>();

const displayClasses = computed(() => ({
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-values': props.settings.hideMeltValue,
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
}));

/**
 * "Price Increase Expected" (#192): a price increase within the days of the settings, so it
 * changes with them and with the time; also of a CCU's base ship (#256).
 */
const now = useNow();
const predicates = computed(() => ({
  ...BUYBACK_FILTER_PREDICATES,
  priceIncrease: (pledge: BuybackView) =>
    hasPriceChangeWithin(pledge, now.value, props.settings.priceIncreaseDays),
}));
/** Offered only while a pledge has a price increase in the period. */
const hasPriceIncrease = computed(() => props.pledges.some(predicates.value.priceIncrease));
/**
 * "Paints" for ships the hangar has or doesn't have (#336), "Ships" by kind (#514), "CCUs" by what
 * they bring (#566).
 */
const ownedShips = useProvidedOwnedShips();
const refinements = computed(() => ({
  paints: paintRefinement<BuybackView>(ownedShips.value, (pledge) => [
    pledge.title,
    pledge.contained,
    ...pledge.items,
  ]),
  // "Ships" by what they hold besides the ship (#514).
  ships: shipKindRefinement<BuybackView>((pledge) => pledge.shipKind),
  // "CCUs" by what they bring (#566).
  ccus: ccuRefinementWithContents(allCcus<BuybackView>(), (pledge) => pledge.ccuContents),
}));

/** The base ship coverage of a group of CCUs (#574); none for other groups. */
const coverages = useProvidedBuybackCcuCoverage();
const coverageOfGroup = (group: { items: readonly BuybackView[] }) =>
  group.items.every((item) => item.isCcu)
    ? groupCoverage(
        group.items.map((item) => item.id),
        coverages.value,
      )
    : undefined;

const filterGroups = computed(() =>
  FILTER_CATEGORIES.map((category) => ({
    category,
    filters: shownFilters(props.settings.filters.buyback[category]).filter(
      (filter) => filter !== 'priceIncrease' || hasPriceIncrease.value,
    ),
  })),
);

// Only by date: RSI's buy back shows neither value nor discount.
const { update } = useSettings();
const ownSort = ref<BuybackSort>(props.settings.sort.buyback);
const sort = computed(() => (props.embedded ? ownSort.value : props.settings.sort.buyback));
const sorted = computed(() => sortEntries(props.pledges, sort.value));
const sortOptions = computed(() =>
  BUYBACK_SORTS.map((value) => ({ value, label: i18n.t(`sort.${value}`) })),
);
const setSort = (buyback: BuybackSort) => {
  if (props.embedded) ownSort.value = buyback;
  else update({ sort: { ...props.settings.sort, buyback } });
};
/** The grouped view (#447), remembered for this list (all watchlists share one). */
const groupedOn = computed(() =>
  props.embedded ? props.settings.grouped.watchlists : props.settings.grouped.buyback,
);
const setGrouped = (on: boolean) =>
  update({
    grouped: { ...props.settings.grouped, [props.embedded ? 'watchlists' : 'buyback']: on },
  });

/** What the included filters are about, highlighted in the rows (#216). */
const highlights = (states: FilterStates<BuybackFilter>) =>
  highlightClasses(FILTER_HIGHLIGHTS.buyback, states);

/** The List Shortcut open in the buy back (#428, see `list-shortcut.ts`); none when embedded. */
const shortcut = computed(() => (props.embedded ? null : listShortcuts.value.buyback));
const shortcutRequest = computed(() => filterRequestOf(shortcut.value));

const filterLabel = (filter: BuybackFilter) => i18n.t(`filter.${filter}`);

/** Filters whose meaning isn't obvious from the label explain it in their tooltip. */
const filterHint = (filter: BuybackFilter) => {
  if (filter === 'probablyGiftable') return giftableHint.value;
  if (filter === 'priceIncrease') {
    return i18n.n('filter.hints.priceIncrease', props.settings.priceIncreaseDays);
  }
  if (filter === 'ships' || filter === 'warbond' || filter === 'available') {
    return i18n.t(`filter.hints.${filter}`);
  }
  return filter === 'rewards' ? i18n.t('filter.hints.rewardsByName') : undefined;
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
    :filter-request="shortcutRequest"
    :include-request="embedded ? null : buybackFilterRequest"
    :view-request="!embedded && listViewRequest?.tab === 'buyback' ? listViewRequest : null"
    :grouping="{ on: groupedOn, factsOf: buybackFacts }"
    :search="embedded?.search"
    :hide-controls="embedded?.hideControls"
    @clear-request="closeListShortcut('buyback')"
    @update:sort="setSort"
    @update:grouped="setGrouped"
    @visible="
      (entries) =>
        emit(
          'visible',
          entries.map((entry) => entry.id),
        )
    "
  >
    <!-- In a watchlist the watchlist's own "Select all" of this part (#620). -->
    <template v-if="embedded && $slots.select" #select>
      <slot name="select" />
    </template>
    <template #row="{ entry, autoExpand }">
      <BuybackRow :pledge="entry" :auto-expand="autoExpand" :link-mode="settings.buybackLinkMode" />
    </template>
    <!-- What a List Shortcut adds to its bar (#428). -->
    <template v-if="shortcut?.extra" #shortcut="{ entries }">
      <component :is="shortcut.extra" :entries="entries" />
    </template>
    <template #group="{ group, open }">
      <GroupRow
        :group="group"
        :kind="buybackGroupKind(group)"
        :ships="group.items[0]!.ships.map((ship) => ship.name)"
        :badges="buybackGroupBadges(group)"
        :note="extrasNote(group.extras)"
        :list-classes="displayClasses"
        :open="open"
        watch-kind="buyback"
      >
        <template #item="{ entry, autoExpand }">
          <BuybackRow
            :pledge="entry"
            :auto-expand="autoExpand"
            :link-mode="settings.buybackLinkMode"
          />
        </template>
        <!-- A group of CCUs: the base ship of all of them (#574). -->
        <template v-if="coverageOfGroup(group)" #head>
          <CcuCoverage
            :coverage="coverageOfGroup(group)!.coverage"
            :of-group="coverageOfGroup(group)!"
            list="buyback"
          />
        </template>
      </GroupRow>
    </template>
  </ManagerList>
</template>
