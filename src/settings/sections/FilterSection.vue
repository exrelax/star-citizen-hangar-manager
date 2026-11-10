<script setup lang="ts">
import { FILTERS } from '@/config';
import { FILTER_CATEGORIES, type FilterCategory, type FilterLayout } from '@/hangar/filters';
import { i18n, type MessageKey } from '@/i18n';
import FilterLayoutSetting from '../FilterLayoutSetting.vue';
import SettingsGroup from '../SettingsGroup.vue';
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
  <p class="shm-settings-intro">{{ i18n.t('settings.filtersHint') }}</p>
  <div class="shm-filter-layouts">
    <SettingsGroup
      v-for="list in FILTER_LISTS"
      :key="list"
      :title="i18n.t(`settings.filtersLists.${list}`)"
    >
      <div class="shm-filter-list">
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
    </SettingsGroup>
  </div>
</template>

<style scoped>
/* Both lists side by side as far as there is room. */
.shm-filter-layouts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px 16px;
  align-items: start;
}

/* One list (My Hangar, Buy Back): a block per category. */
.shm-filter-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 14px;
}
</style>
