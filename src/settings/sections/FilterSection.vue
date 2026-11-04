<script setup lang="ts">
import { FILTERS } from '@/config';
import { FILTER_CATEGORIES, type FilterCategory, type FilterLayout } from '@/hangar/filters';
import { i18n, type MessageKey } from '@/i18n';
import FilterLayoutSetting from '../FilterLayoutSetting.vue';
import type { Settings } from '../settings';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const FILTER_LISTS = ['hangar', 'buyback'] as const;

const filterLabel = (filter: string) => i18n.t(`filter.${filter}` as MessageKey);

function setFilters(
  list: keyof Settings['filters'],
  category: FilterCategory,
  layout: FilterLayout<string>,
) {
  const groups = { ...props.settings.filters[list], [category]: layout };
  emit('update', { filters: { ...props.settings.filters, [list]: groups } });
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.filters') }}</legend>
    <p class="shm-hint is-first">{{ i18n.t('settings.filtersHint') }}</p>
    <div class="shm-filter-layouts">
      <div v-for="list in FILTER_LISTS" :key="list" class="shm-filter-list">
        <span class="shm-filter-list-title">{{ i18n.t(`settings.filtersLists.${list}`) }}</span>
        <FilterLayoutSetting
          v-for="category in FILTER_CATEGORIES"
          :id="`shm-filters-${list}-${category}`"
          :key="category"
          :title="i18n.t(`filter.categories.${category}`)"
          :layout="settings.filters[list][category]"
          :defaults="FILTERS[list][category]"
          :filter-label="filterLabel"
          @update="setFilters(list, category, $event)"
        />
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.shm-filter-layouts {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 28px;
}

/* One list (My Hangar, Buy Back): its title, then a block per category. */
.shm-filter-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: 220px;
}

.shm-filter-list-title {
  color: var(--shm-text-strong);
  font-size: calc(13px * var(--shm-font-scale));
}
</style>
