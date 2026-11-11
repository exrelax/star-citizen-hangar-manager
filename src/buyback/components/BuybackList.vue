<script setup lang="ts">
import ManagerList from '@/hangar/components/ManagerList.vue';
import { FILTER_CATEGORIES, shownFilters, type FilterStates } from '@/hangar/filters';
import { highlightClasses } from '@/hangar/highlights';
import { FILTER_HIGHLIGHTS } from '@/config';
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed } from 'vue';
import { BUYBACK_FILTER_PREDICATES, type BuybackFilter, type BuybackView } from '../buyback-view';
import { giftableHint } from '../giftable-hint';
import BuybackRow from './BuybackRow.vue';
import { BUYBACK_SORTS, sortEntries, type BuybackSort } from '@/hangar/sorting';
import { useSettings } from '@/settings/use-settings';
import { hasPriceChangeWithin } from '@/price-increases/price-change-filter';
import { buybackFilterRequest } from '../buyback-filter-request';
import { useNow } from '@/shared/use-now';

const props = defineProps<{
  pledges: BuybackView[];
  settings: Settings;
  active: boolean;
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
const sorted = computed(() => sortEntries(props.pledges, props.settings.sort.buyback));
const sortOptions = computed(() =>
  BUYBACK_SORTS.map((value) => ({ value, label: i18n.t(`sort.${value}`) })),
);
const setSort = (buyback: BuybackSort) => update({ sort: { ...props.settings.sort, buyback } });

/** What the included filters are about, highlighted in the rows (#216). */
const highlights = (states: FilterStates<BuybackFilter>) =>
  highlightClasses(FILTER_HIGHLIGHTS.buyback, states);

const filterLabel = (filter: BuybackFilter) => i18n.t(`filter.${filter}`);

/** Filters whose meaning isn't obvious from the label explain it in their tooltip. */
const filterHint = (filter: BuybackFilter) => {
  if (filter === 'probablyGiftable') return giftableHint.value;
  if (filter === 'priceIncrease') {
    return i18n.t('filter.hints.priceIncrease', [props.settings.priceIncreaseDays]);
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
    :filter-label="filterLabel"
    :filter-hint="filterHint"
    :active="active"
    :sort-options="sortOptions"
    :sort="settings.sort.buyback"
    :highlights="highlights"
    :include-request="buybackFilterRequest"
    @update:sort="setSort"
  >
    <template #row="{ entry, autoExpand }">
      <BuybackRow :pledge="entry" :auto-expand="autoExpand" :link-mode="settings.buybackLinkMode" />
    </template>
  </ManagerList>
</template>
