<script setup lang="ts">
import { i18n } from '#i18n';
import { computed, ref, shallowRef } from 'vue';
import { matchesFilters, PLEDGE_FILTERS, type PledgeFilter } from '../filters';
import type { Settings } from '@/settings/settings';
import type { PledgeView } from '../pledge-view';
import { isHiddenReward } from '../rewards';
import { matchesSearch, parseSearchQuery } from '../search';
import PledgeRow from './PledgeRow.vue';

const props = defineProps<{ pledges: PledgeView[]; settings: Settings }>();

/** Pledges without the rewards hidden in the settings. */
const listed = computed(() =>
  props.settings.rewardVisibility === 'showAll'
    ? props.pledges
    : props.pledges.filter(
        (pledge) => !isHiddenReward(pledge.reward, props.settings.rewardVisibility),
      ),
);

// Value and link settings only toggle classes, so the rows don't need to re-render.
const listClasses = computed(() => ({
  'shm-hide-values': props.settings.hideMeltValue,
  'shm-hide-erkul': !props.settings.shipLinks.erkul,
  'shm-hide-fleetyards': !props.settings.shipLinks.fleetyards,
}));

const query = ref('');
// Replaced on every change, so a shallowRef is enough to trigger updates.
const activeFilters = shallowRef<ReadonlySet<PledgeFilter>>(new Set());

function toggleFilter(filter: PledgeFilter) {
  const next = new Set(activeFilters.value);
  if (!next.delete(filter)) next.add(filter);
  activeFilters.value = next;
}

/** Number of pledges each filter matches on its own. */
const filterCounts = computed(
  () =>
    Object.fromEntries(
      PLEDGE_FILTERS.map((filter) => [
        filter,
        listed.value.filter((pledge) => matchesFilters(pledge, new Set([filter]))).length,
      ]),
    ) as Record<PledgeFilter, number>,
);

/** Ids of the pledges matching search and filters; `null` while neither is active. */
const visibleIds = computed(() => {
  const terms = parseSearchQuery(query.value);
  const filters = activeFilters.value;
  if (terms.length === 0 && filters.size === 0) return null;
  const ids = new Set<number>();
  for (const pledge of listed.value) {
    if (matchesFilters(pledge, filters) && matchesSearch(pledge.searchText, terms)) {
      ids.add(pledge.id);
    }
  }
  return ids;
});

const isVisible = (id: number) => !visibleIds.value || visibleIds.value.has(id);

const countLabel = computed(() =>
  visibleIds.value
    ? i18n.t('manager.countFiltered', [visibleIds.value.size, listed.value.length])
    : i18n.t('manager.count', [listed.value.length]),
);
</script>

<template>
  <div class="shm-list" :class="listClasses">
    <div class="shm-filters" role="group" :aria-label="i18n.t('filter.label')">
      <button
        v-for="filter in PLEDGE_FILTERS"
        :key="filter"
        type="button"
        class="shm-filter"
        :class="{ 'is-active': activeFilters.has(filter) }"
        :aria-pressed="activeFilters.has(filter)"
        @click="toggleFilter(filter)"
      >
        {{ i18n.t(`filter.${filter}`) }}
        <span class="shm-filter-count">{{ filterCounts[filter] }}</span>
      </button>
    </div>

    <div class="shm-toolbar">
      <input
        v-model="query"
        type="search"
        class="shm-search"
        :placeholder="i18n.t('manager.searchPlaceholder')"
        :aria-label="i18n.t('manager.searchPlaceholder')"
        autocomplete="off"
        spellcheck="false"
      />
      <p class="shm-count" aria-live="polite">{{ countLabel }}</p>
    </div>

    <!--
      All rows stay mounted and the search only toggles their visibility: filtering and clearing
      the search then just flip `display` instead of re-creating hundreds of rows. `v-memo` lets
      Vue skip every row whose visibility didn't change.
    -->
    <PledgeRow
      v-for="pledge in listed"
      v-show="isVisible(pledge.id)"
      :key="pledge.id"
      v-memo="[pledge, isVisible(pledge.id)]"
      :pledge="pledge"
    />

    <p v-if="visibleIds && visibleIds.size === 0" class="shm-no-results">
      {{ i18n.t('manager.noResults') }}
    </p>
  </div>
</template>

<style scoped>
/* Display settings: classes on the list hide parts of all rows at once. */
.shm-hide-values :deep(.shm-value),
.shm-hide-erkul :deep(.is-erkul),
.shm-hide-fleetyards :deep(.is-fleetyards) {
  display: none;
}

.shm-list {
  margin-top: 20px;
}

.shm-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.shm-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  color: #62c4eb;
  font: inherit;
  font-size: 12px;
  background: rgba(10, 20, 30, 0.8);
  border: 1px solid rgba(98, 196, 235, 0.35);
  border-radius: 0;
  cursor: pointer;
}

.shm-filter:hover,
.shm-filter:focus-visible {
  border-color: #62c4eb;
  outline: none;
}

.shm-filter.is-active {
  color: #0b141c;
  background: #62c4eb;
  border-color: #62c4eb;
}

.shm-filter-count {
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.shm-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
}

.shm-search {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  color: #dbe7ee;
  font: inherit;
  font-size: 13px;
  background: rgba(10, 20, 30, 0.8);
  border: 1px solid rgba(98, 196, 235, 0.35);
  border-radius: 0;
  outline: none;
}

.shm-search::placeholder {
  color: #6f8494;
}

.shm-search:focus {
  border-color: #62c4eb;
  box-shadow: 0 0 0 1px rgba(98, 196, 235, 0.35);
}

.shm-count {
  flex: none;
  margin: 0;
  color: #8a9ba8;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.shm-no-results {
  margin: 20px 0;
  color: #8a9ba8;
}
</style>
