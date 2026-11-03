<script setup lang="ts">
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed } from 'vue';
import { matchesFilters, PLEDGE_FILTERS, type PledgeFilter } from '../filters';
import type { PledgeView } from '../pledge-view';
import { isHiddenReward } from '../rewards';
import ManagerList from './ManagerList.vue';
import PledgeRow from './PledgeRow.vue';

const props = defineProps<{ pledges: PledgeView[]; settings: Settings; active: boolean }>();

/** Pledges without the rewards hidden in the settings. */
const listed = computed(() =>
  props.settings.rewardVisibility === 'showAll'
    ? props.pledges
    : props.pledges.filter(
        (pledge) => !isHiddenReward(pledge.reward, props.settings.rewardVisibility),
      ),
);

// Value and link settings only toggle classes, so the rows don't need to re-render.
const displayClasses = computed(() => ({
  'shm-hide-values': props.settings.hideMeltValue,
  'shm-hide-ids': props.settings.hidePledgeIds,
  'shm-hide-refund': !props.settings.showRefund,
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
}));

const filterLabel = (filter: PledgeFilter) => i18n.t(`filter.${filter}`);
</script>

<template>
  <ManagerList
    :class="displayClasses"
    :entries="listed"
    :filters="PLEDGE_FILTERS"
    :matches="matchesFilters"
    :filter-label="filterLabel"
    :active="active"
  >
    <template #row="{ entry, autoExpand }">
      <PledgeRow :pledge="entry" :auto-expand="autoExpand" />
    </template>
  </ManagerList>
</template>
