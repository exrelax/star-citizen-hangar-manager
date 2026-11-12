<script setup lang="ts">
import type { StarCitizenEvent } from '@/events/events';
import ManagerList from '@/hangar/components/ManagerList.vue';
import { i18n } from '@/i18n';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import type { Ship } from '@/ships/ships';
import { useShipFacts } from '@/ships/use-ship-facts';
import type { Settings } from '@/settings/settings';
import { useSettings } from '@/settings/use-settings';
import { computed, watch } from 'vue';
import type { WarbondHistorySnapshot } from '../warbond-history';
import {
  chosenPeriod,
  currentHistoryChoice,
  historyEntries,
  historyPeriods,
  HISTORY_SORTS,
  periodStart,
  runningEvent,
  sortHistory,
  withinPeriod,
  type HistoryPeriod,
  type HistorySort,
} from '../warbond-history-view';
import HistoryRow from './HistoryRow.vue';

/*
 * The "Warbond CCU History" tab of the Pledge Store tab (#297): the expired warbond offers of the
 * history (#4) in the list of the manager's other tabs – search, count, sort –, with the period
 * beside the sort. While an event runs, its period can be chosen and is selected at first.
 */

const props = defineProps<{
  history: WarbondHistorySnapshot | undefined;
  ships: readonly Ship[];
  events: readonly StarCitizenEvent[];
  now: number;
  /** The tab is shown: only then the list owns the search parameter of the URL. */
  active: boolean;
  settings: Settings;
}>();

const shipFacts = useShipFacts();
const all = computed(() =>
  historyEntries(props.history, props.ships, (id) => shipFacts.value?.ship(id)?.manufacturer),
);

const event = computed(() => runningEvent(props.events, props.now));

/*
 * Order and period are kept in the settings. A new event selects its period at first; once the
 * event is over, the event period goes back to 90 days on its own (`currentHistoryChoice`).
 */
const { update } = useSettings();
const choice = computed(() => currentHistoryChoice(props.settings.warbondHistory, event.value));
watch(
  choice,
  (next) => next !== props.settings.warbondHistory && void update({ warbondHistory: next }),
  { immediate: true },
);
const period = computed(() => choice.value.period);
const sort = computed(() => choice.value.sort);
const setPeriod = (next: HistoryPeriod) =>
  update({ warbondHistory: chosenPeriod(choice.value, next, event.value) });
const setSort = (next: HistorySort) => update({ warbondHistory: { ...choice.value, sort: next } });

const periodOptions = computed(() =>
  historyPeriods(event.value).map((value) => ({
    value,
    label: i18n.t(`store.historyPeriods.${value}`),
  })),
);
const sortOptions = computed(() =>
  HISTORY_SORTS.map((value) => ({ value, label: i18n.t(`store.historySorts.${value}`) })),
);

const entries = computed(() =>
  sortHistory(
    withinPeriod(all.value, periodStart(period.value, props.now, event.value)),
    sort.value,
  ),
);
</script>

<template>
  <div class="shm-warbond-history">
    <p class="shm-store-intro">{{ i18n.t('store.historyIntro') }}</p>
    <ManagerList
      :entries="entries"
      :filter-groups="[]"
      :predicates="{}"
      :filter-label="(filter: string) => filter"
      :active="active"
      :sort-options="sortOptions"
      :sort="sort"
      :texts="{
        count: 'store.historyCount',
        countFiltered: 'store.historyCountFiltered',
        searchPlaceholder: 'store.historySearch',
        noResults: 'store.historyNoResults',
      }"
      @update:sort="setSort"
    >
      <template #side>
        <SelectMenu
          :model-value="period"
          :options="periodOptions"
          :label="i18n.t('store.historyPeriod')"
          icon="clock-rotate-left"
          @update:model-value="setPeriod"
        />
      </template>
      <template #row="{ entry }">
        <HistoryRow :entry="entry" />
      </template>
    </ManagerList>
    <p v-if="!entries.length" class="shm-store-state">{{ i18n.t('store.historyEmpty') }}</p>
  </div>
</template>

<style scoped>
.shm-store-state {
  margin: 20px 0;
  color: var(--shm-text-muted);
}
</style>
