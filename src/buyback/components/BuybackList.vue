<script setup lang="ts">
import ManagerList from '@/hangar/components/ManagerList.vue';
import { matchesFilterDefinition } from '@/hangar/filters';
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed } from 'vue';
import {
  BUYBACK_FILTER_DEFINITION,
  BUYBACK_FILTERS,
  type BuybackFilter,
  type BuybackView,
} from '../buyback-view';
import { giftableHint } from '../giftable-hint';
import BuybackRow from './BuybackRow.vue';

const props = defineProps<{ pledges: BuybackView[]; settings: Settings; active: boolean }>();

const linkClasses = computed(() => ({
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
}));

const matches = (pledge: BuybackView, active: ReadonlySet<BuybackFilter>) =>
  matchesFilterDefinition(pledge, active, BUYBACK_FILTER_DEFINITION);

const filterLabel = (filter: BuybackFilter) => i18n.t(`filter.${filter}`);

/** Explains "probably giftable" on its filter button. */
const filterTitle = (filter: BuybackFilter) =>
  filter === 'probablyGiftable' ? giftableHint.value : undefined;
</script>

<template>
  <ManagerList
    :class="linkClasses"
    :entries="pledges"
    :filters="BUYBACK_FILTERS"
    :matches="matches"
    :filter-label="filterLabel"
    :filter-title="filterTitle"
    :active="active"
  >
    <template #row="{ entry, autoExpand }">
      <BuybackRow :pledge="entry" :auto-expand="autoExpand" />
    </template>
  </ManagerList>
</template>
