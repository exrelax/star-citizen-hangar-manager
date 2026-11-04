<script setup lang="ts">
import ManagerList from '@/hangar/components/ManagerList.vue';
import SvgIcon from '@/icons/SvgIcon.vue';
import { FILTER_CATEGORIES, shownFilters } from '@/hangar/filters';
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { computed } from 'vue';
import { BUYBACK_FILTER_PREDICATES, type BuybackFilter, type BuybackView } from '../buyback-view';
import { giftableHint } from '../giftable-hint';
import BuybackRow from './BuybackRow.vue';

const props = defineProps<{
  pledges: BuybackView[];
  settings: Settings;
  active: boolean;
  /** Buy back tokens left; unset if unknown. */
  tokens?: number;
}>();

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
    <template v-if="tokens !== undefined" #count-side>
      <span class="shm-buyback-tokens" :title="i18n.t('buyback.tokensHint')">
        <SvgIcon name="buyback-token" set="custom" />
        {{ i18n.t('buyback.tokens', [tokens]) }}
      </span>
    </template>
    <template #row="{ entry, autoExpand }">
      <BuybackRow :pledge="entry" :auto-expand="autoExpand" :link-mode="settings.buybackLinkMode" />
    </template>
  </ManagerList>
</template>

<style scoped>
/* The tokens in the count line: icon in the accent color, the count as text. */
.shm-buyback-tokens {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: help;
}

.shm-buyback-tokens .shm-icon {
  color: var(--shm-accent);
  font-size: 1.5em;
}
</style>
