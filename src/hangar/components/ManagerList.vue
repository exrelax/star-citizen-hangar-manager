<script setup lang="ts" generic="T extends { id: number; searchText: string }, F extends string">
import {
  LIST_RENDER_AHEAD,
  LIST_RENDER_BATCH,
  LIST_RENDER_STEP,
  SEARCH_URL_SYNC_DELAY_MS,
} from '@/config';
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
import {
  filterCounts as countFilters,
  matchesFilterStates,
  nextFilterState,
  type FilterCategory,
  type FilterPredicates,
  type FilterState,
} from '../filters';
import SvgIcon from '@/icons/SvgIcon.vue';
import { searchFromUrl, urlWithSearch } from '../route';
import { matchesSearch, parseSearchQuery } from '../search';

/*
 * The list part shared by the manager's tabs: filter buttons, live search, counts, rows. Rows are
 * rendered by the `row` slot. Filtering and searching cover all entries, but only the first
 * matches are drawn (`LIST_RENDER_BATCH`) and more follow in small steps while scrolling
 * (`LIST_RENDER_STEP`) – drawing thousands of rows at once would make every keystroke slow.
 */

const props = defineProps<{
  entries: T[];
  /** The filter buttons per category (see `filters.ts`), each in display order. */
  filterGroups: readonly { category: FilterCategory; filters: readonly F[] }[];
  /** The property behind each filter (see `filters.ts`). */
  predicates: FilterPredicates<T, F>;
  filterLabel: (filter: F) => string;
  /** An explanation of a filter, shown in its tooltip before the state. */
  filterHint?: (filter: F) => string | undefined;
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
const searchInput = useTemplateRef<HTMLInputElement>('search');
/** The clear button in the search field: empties the search and keeps typing possible. */
function clearSearch() {
  query.value = '';
  searchInput.value?.focus();
}

// Switching tabs hands the URL parameter over to the list that is shown now.
watch(
  () => props.active,
  (active) => active && writeSearchToUrl(),
);
// Switching to "My Gear" right after typing still keeps the latest term.
onUnmounted(writeSearchToUrl);

/** The categories with filter buttons, and all their buttons. */
const shownGroups = computed(() => props.filterGroups.filter((group) => group.filters.length));
const filters = computed(() => shownGroups.value.flatMap((group) => group.filters));

// Replaced on every change, so a shallowRef is enough to trigger updates.
const filterStates = shallowRef<ReadonlyMap<F, FilterState>>(new Map());

/** A click on a filter: off → only entries with it → entries without it → off. */
function cycleFilter(filter: F) {
  const next = new Map(filterStates.value);
  const state = nextFilterState(next.get(filter));
  if (state) next.set(filter, state);
  else next.delete(filter);
  filterStates.value = next;
}

const resetFilters = () => (filterStates.value = new Map());

// A filter turned off in the settings no longer filters the list, either.
watch(filters, (filters) => {
  const kept = [...filterStates.value].filter(([filter]) => filters.includes(filter));
  if (kept.length !== filterStates.value.size) filterStates.value = new Map(kept);
});

/** Entries matching the search; the filters and their counts work on these. */
const searched = computed(() => {
  const terms = parseSearchQuery(query.value);
  return terms.length
    ? props.entries.filter((entry) => matchesSearch(entry.searchText, terms))
    : props.entries;
});

/** Per filter: entries with it among those passing search and the other filters (filters.ts). */
const filterCounts = computed(() =>
  countFilters(searched.value, filters.value, filterStates.value, props.predicates),
);

/** Ids of the entries matching search and filters; `null` while neither is active. */
const visibleIds = computed(() => {
  const states = filterStates.value;
  if (searched.value === props.entries && states.size === 0) return null;
  const ids = new Set<number>();
  for (const entry of searched.value) {
    if (matchesFilterStates(entry, states, props.predicates)) ids.add(entry.id);
  }
  return ids;
});

/** Tooltip of a filter: its explanation, its state and what a click does. */
function filterTitle(filter: F) {
  const label = props.filterLabel(filter);
  const state = filterStates.value.get(filter);
  const action = i18n.t(
    state === 'include'
      ? 'filter.stateInclude'
      : state === 'exclude'
        ? 'filter.stateExclude'
        : 'filter.stateOff',
    [label],
  );
  const hint = props.filterHint?.(filter);
  return hint ? `${hint}\n\n${action}` : action;
}

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

// Progressive rendering: start with one batch, add small steps while the end is within reach.
const renderLimit = ref(LIST_RENDER_BATCH);
const rendered = computed(() => matching.value.slice(0, renderLimit.value));
watch(matching, () => (renderLimit.value = LIST_RENDER_BATCH));

const sentinel = useTemplateRef<HTMLElement>('sentinel');
let observer: IntersectionObserver | undefined;
/** A pending step; at most one, however often the observer fires. */
let pendingStep: number | undefined;

const inReach = () => {
  const element = sentinel.value;
  if (!element?.offsetParent) return false; // Hidden tab.
  const ahead = Number.parseInt(LIST_RENDER_AHEAD, 10);
  return element.getBoundingClientRect().top < innerHeight + ahead;
};

// Each step waits for idle time, so it never delays a frame of the scrolling. The timeout keeps
// the rows coming during long, continuous scrolling, which leaves little idle time.
const scheduleStep = () => {
  pendingStep ??= requestIdleCallback(renderStep, { timeout: 100 });
};
const renderStep = async () => {
  pendingStep = undefined;
  if (renderLimit.value >= matching.value.length) return;
  renderLimit.value += LIST_RENDER_STEP;
  await nextTick();
  // Still in reach after the new rows (e.g. fast scrolling or a tall screen)? Add another step.
  if (inReach()) scheduleStep();
};

onMounted(() => {
  observer = new IntersectionObserver(
    (records) => records.some((record) => record.isIntersecting) && scheduleStep(),
    { rootMargin: `0px 0px ${LIST_RENDER_AHEAD} 0px` },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
onUnmounted(() => {
  observer?.disconnect();
  if (pendingStep !== undefined) cancelIdleCallback(pendingStep);
});

const countLabel = computed(() =>
  visibleIds.value
    ? i18n.t('manager.countFiltered', [visibleIds.value.size, props.entries.length])
    : i18n.t('manager.count', [props.entries.length]),
);
</script>

<template>
  <div class="shm-list">
    <div
      v-if="filters.length"
      class="shm-filters"
      role="group"
      :aria-label="i18n.t('filter.label')"
    >
      <div
        v-for="(group, index) in shownGroups"
        :key="group.category"
        class="shm-filter-group"
        role="group"
        :aria-label="i18n.t(`filter.categories.${group.category}`)"
      >
        <span class="shm-filter-group-label" aria-hidden="true">
          {{ i18n.t(`filter.categories.${group.category}`) }}
        </span>
        <div class="shm-filter-buttons">
          <button
            v-for="filter in group.filters"
            :key="filter"
            type="button"
            class="shm-filter"
            :class="{
              'is-active': filterStates.get(filter) === 'include',
              'is-excluded': filterStates.get(filter) === 'exclude',
            }"
            :aria-pressed="
              filterStates.get(filter) === 'include'
                ? 'true'
                : filterStates.get(filter) === 'exclude'
                  ? 'mixed'
                  : 'false'
            "
            :title="filterTitle(filter)"
            @click="cycleFilter(filter)"
          >
            <span
              v-if="filterStates.get(filter) === 'exclude'"
              class="shm-filter-not"
              aria-hidden="true"
              >−</span
            >
            <span class="shm-filter-label">{{ filterLabel(filter) }}</span>
            <span class="shm-filter-count">{{ filterCounts.get(filter) }}</span>
          </button>
          <!-- After the last group's buttons, so it doesn't add a line when it appears. -->
          <button
            v-if="filterStates.size && index === shownGroups.length - 1"
            type="button"
            class="shm-filter-reset"
            @click="resetFilters"
          >
            {{ i18n.t('filter.reset') }}
          </button>
        </div>
      </div>
    </div>

    <div class="shm-toolbar">
      <span class="shm-search-field">
        <input
          ref="search"
          v-model="query"
          type="search"
          class="shm-search"
          :placeholder="i18n.t('manager.searchPlaceholder')"
          :aria-label="i18n.t('manager.searchPlaceholder')"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          v-if="query"
          type="button"
          class="shm-search-clear"
          :title="i18n.t('manager.clearSearch')"
          :aria-label="i18n.t('manager.clearSearch')"
          @click="clearSearch"
        >
          <SvgIcon name="circle-xmark" />
        </button>
      </span>
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
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}

/* One category per line: its label in a fixed column, then its buttons. */
.shm-filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shm-filter-group-label {
  flex: none;
  width: 72px;
  color: var(--shm-text-muted);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shm-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  color: var(--shm-accent);
  font: inherit;
  font-size: 12px;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.35);
  border-radius: 0;
  cursor: pointer;
}

.shm-filter:hover,
.shm-filter:focus-visible {
  border-color: var(--shm-accent);
  outline: none;
}

.shm-filter.is-active {
  color: var(--shm-text-on-accent);
  background: var(--shm-accent);
  border-color: var(--shm-accent);
}

.shm-filter.is-excluded {
  color: var(--shm-danger);
  border-color: var(--shm-danger);
}

/* Excluded: crossed out and with a minus, so it can't be mistaken for an active filter. */
.shm-filter.is-excluded .shm-filter-label {
  text-decoration: line-through;
}

.shm-filter-not {
  font-weight: 700;
}

.shm-filter-reset {
  height: 28px;
  padding: 0 10px;
  color: var(--shm-text-muted);
  font: inherit;
  font-size: 12px;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-filter-reset:hover,
.shm-filter-reset:focus-visible {
  color: var(--shm-text);
  text-decoration: underline;
  outline: none;
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

/* The search field with its clear button inside, at the right. */
.shm-search-field {
  position: relative;
  display: flex;
  flex: 1;
}

.shm-search {
  flex: 1;
  height: 34px;
  /* Room for the clear button. */
  padding: 0 34px 0 12px;
  color: var(--shm-text);
  font: inherit;
  font-size: 13px;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.35);
  border-radius: 0;
  outline: none;
}

/* Chrome's own clear button of search fields: replaced by `.shm-search-clear`. */
.shm-search::-webkit-search-cancel-button {
  appearance: none;
}

.shm-search-clear {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  padding: 0;
  color: var(--shm-text-muted);
  font-size: 15px;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-search-clear:hover,
.shm-search-clear:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-search::placeholder {
  color: var(--shm-text-faint);
}

.shm-search:focus {
  border-color: var(--shm-accent);
  box-shadow: 0 0 0 1px rgb(var(--shm-accent-rgb) / 0.35);
}

.shm-count {
  flex: none;
  margin: 0;
  color: var(--shm-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.shm-sentinel {
  height: 1px;
}

.shm-no-results {
  margin: 20px 0;
  color: var(--shm-text-muted);
}
</style>
