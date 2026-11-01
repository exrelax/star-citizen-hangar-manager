<script setup lang="ts">
import { i18n } from '#i18n';
import { computed, ref } from 'vue';
import type { PledgeView } from '../pledge-view';
import { matchesSearch, parseSearchQuery } from '../search';
import PledgeRow from './PledgeRow.vue';

const props = defineProps<{ pledges: PledgeView[] }>();

const query = ref('');

/** Ids of the pledges matching the search; `null` while there is no search. */
const visibleIds = computed(() => {
  const terms = parseSearchQuery(query.value);
  if (terms.length === 0) return null;
  const ids = new Set<number>();
  for (const pledge of props.pledges) {
    if (matchesSearch(pledge.searchText, terms)) ids.add(pledge.id);
  }
  return ids;
});

const isVisible = (id: number) => !visibleIds.value || visibleIds.value.has(id);

const countLabel = computed(() =>
  visibleIds.value
    ? i18n.t('manager.countFiltered', [visibleIds.value.size, props.pledges.length])
    : i18n.t('manager.count', [props.pledges.length]),
);
</script>

<template>
  <div class="shm-list">
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
      v-for="pledge in pledges"
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
.shm-list {
  margin-top: 20px;
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
