<script setup lang="ts">
import ManagerList from '@/hangar/components/ManagerList.vue';
import { FILTER_CATEGORIES, shownFilters } from '@/hangar/filters';
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed } from 'vue';
import { BUYBACK_FILTER_PREDICATES, type BuybackFilter, type BuybackView } from '../buyback-view';
import { giftableHint } from '../giftable-hint';
import BuybackRow from './BuybackRow.vue';

const props = defineProps<{ pledges: BuybackView[]; settings: Settings; active: boolean }>();

const displayClasses = computed(() => ({
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-values': props.settings.hideMeltValue,
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
}));

const filterGroups = computed(() =>
  FILTER_CATEGORIES.map((category) => ({
    category,
    filters: shownFilters(props.settings.filters.buyback[category]),
  })),
);

const filterLabel = (filter: BuybackFilter) => i18n.t(`filter.${filter}`);

/** Filters whose meaning isn't obvious from the label explain it in their tooltip. */
const filterHint = (filter: BuybackFilter) => {
  if (filter === 'probablyGiftable') return giftableHint.value;
  if (filter === 'ships' || filter === 'warbond') return i18n.t(`filter.hints.${filter}`);
  return filter === 'rewards' ? i18n.t('filter.hints.rewardsByName') : undefined;
};
</script>

<template>
  <ManagerList
    :class="displayClasses"
    :entries="pledges"
    :filter-groups="filterGroups"
    :predicates="BUYBACK_FILTER_PREDICATES"
    :filter-label="filterLabel"
    :filter-hint="filterHint"
    :active="active"
  >
    <template #row="{ entry, autoExpand }">
      <BuybackRow :pledge="entry" :auto-expand="autoExpand" :link-mode="settings.buybackLinkMode" />
    </template>
  </ManagerList>
</template>
