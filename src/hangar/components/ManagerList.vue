<script setup lang="ts" generic="T extends { id: number; searchText: string }, F extends string">
import { LIST_RENDER_AHEAD, LIST_RENDER_BATCH, SEARCH_URL_SYNC_DELAY_MS } from '@/config';
import { i18n } from '@/i18n';
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { searchFromUrl, urlWithSearch } from '../route';
import { matchesSearch, parseSearchQuery } from '../search';

/*
 * The list part shared by the manager's tabs: filter buttons, live search, counts, rows. Rows are
 * rendered by the `row` slot. Filtering and searching cover all entries, but only the first
 * matches are drawn and more follow while scrolling (`LIST_RENDER_BATCH`) – drawing thousands of
 * rows at once would make every keystroke slow.
 */

const props = defineProps<{
  entries: T[];
  filters: readonly F[];
  /** Whether an entry passes the active filters. */
  matches: (entry: T, active: ReadonlySet<F>) => boolean;
  filterLabel: (filter: F) => string;
  filterTitle?: (filter: F) => string | undefined;
  /** The list's tab is shown: only then it owns the search parameter of the URL. */
  active: boolean;
}>();

defineSlots<{ row(props: { entry: T; autoExpand: boolean }): unknown }>();

// Pre-filled from the page URL, e.g. `…/account/pledges?search=polaris#hangar-manager`, and kept
// in it, so a reload or bookmark keeps the search. `replaceState` adds no history entries.
const query = ref(props.active ? searchFromUrl(location.search) : '');

let urlTimer: ReturnType<typeof setTimeout> | undefined;
const writeSearchToUrl = () => {
  clearTimeout(urlTimer);
  urlTimer = undefined;
  if (!props.active) return;
  const next = urlWithSearch(location.href, query.value);
  if (next !== location.href) history.replaceState(history.state, '', next);
};
watch(query, () => {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(writeSearchToUrl, SEARCH_URL_SYNC_DELAY_MS);
});
// Switching tabs hands the URL parameter over to the list that is shown now.
watch(
  () => props.active,
  (active) => active && writeSearchToUrl(),
);
// Switching to "My Gear" right after typing still keeps the latest term.
onUnmounted(writeSearchToUrl);

// Replaced on every change, so a shallowRef is enough to trigger updates.
const activeFilters = shallowRef<ReadonlySet<F>>(new Set());

function toggleFilter(filter: F) {
  const next = new Set(activeFilters.value);
  if (!next.delete(filter)) next.add(filter);
  activeFilters.value = next;
}

/** Number of entries each filter matches on its own. */
const filterCounts = computed(() => {
  const counts = new Map<F, number>();
  for (const filter of props.filters) {
    const only = new Set([filter]);
    counts.set(filter, props.entries.filter((entry) => props.matches(entry, only)).length);
  }
  return counts;
});

/** Ids of the entries matching search and filters; `null` while neither is active. */
const visibleIds = computed(() => {
  const terms = parseSearchQuery(query.value);
  const filters = activeFilters.value;
  if (terms.length === 0 && filters.size === 0) return null;
  const ids = new Set<number>();
  for (const entry of props.entries) {
    if (props.matches(entry, filters) && matchesSearch(entry.searchText, terms)) ids.add(entry.id);
  }
  return ids;
});

/** All entries passing search and filters, in list order. */
const matching = computed(() =>
  visibleIds.value
    ? props.entries.filter((entry) => visibleIds.value!.has(entry.id))
    : props.entries,
);

/** Id of the only entry shown, which then opens on its own; undefined for more or none. */
const onlyVisibleId = computed(() =>
  matching.value.length === 1 ? matching.value[0]!.id : undefined,
);

// Progressive rendering: start with one batch, add the next when the end comes into reach.
const renderLimit = ref(LIST_RENDER_BATCH);
const rendered = computed(() => matching.value.slice(0, renderLimit.value));
watch(matching, () => (renderLimit.value = LIST_RENDER_BATCH));

const sentinel = useTemplateRef<HTMLElement>('sentinel');
let observer: IntersectionObserver | undefined;
const renderMore = async () => {
  if (renderLimit.value >= matching.value.length) return;
  renderLimit.value += LIST_RENDER_BATCH;
  // Still in reach after the new rows (e.g. fast scrolling or a tall screen)? Add another batch.
  await nextTick();
  const rect = sentinel.value?.getBoundingClientRect();
  const ahead = Number.parseInt(LIST_RENDER_AHEAD, 10);
  if (rect && rect.height >= 0 && rect.top < innerHeight + ahead && sentinel.value!.offsetParent) {
    void renderMore();
  }
};
onMounted(() => {
  observer = new IntersectionObserver(
    (records) => records.some((record) => record.isIntersecting) && void renderMore(),
    { rootMargin: `0px 0px ${LIST_RENDER_AHEAD} 0px` },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
onUnmounted(() => observer?.disconnect());

const countLabel = computed(() =>
  visibleIds.value
    ? i18n.t('manager.countFiltered', [visibleIds.value.size, props.entries.length])
    : i18n.t('manager.count', [props.entries.length]),
);
</script>

<template>
  <div class="shm-list">
    <div class="shm-filters" role="group" :aria-label="i18n.t('filter.label')">
      <button
        v-for="filter in filters"
        :key="filter"
        type="button"
        class="shm-filter"
        :class="{ 'is-active': activeFilters.has(filter) }"
        :aria-pressed="activeFilters.has(filter)"
        :title="filterTitle?.(filter)"
        @click="toggleFilter(filter)"
      >
        {{ filterLabel(filter) }}
        <span class="shm-filter-count">{{ filterCounts.get(filter) }}</span>
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

    <template v-for="entry in rendered" :key="entry.id">
      <slot name="row" :entry="entry" :auto-expand="entry.id === onlyVisibleId" />
    </template>
    <div ref="sentinel" class="shm-sentinel" aria-hidden="true"></div>

    <p v-if="visibleIds && visibleIds.size === 0" class="shm-no-results">
      {{ i18n.t('manager.noResults') }}
    </p>
  </div>
</template>

<style scoped>
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

.shm-sentinel {
  height: 1px;
}

.shm-no-results {
  margin: 20px 0;
  color: #8a9ba8;
}
</style>
