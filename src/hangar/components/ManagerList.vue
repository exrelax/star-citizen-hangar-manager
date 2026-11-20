<script
  setup
  lang="ts"
  generic="T extends { id: number; searchText: string }, F extends string, S extends string"
>
import {
  LIST_RENDER_AHEAD,
  LIST_RENDER_BATCH,
  LIST_RENDER_STEP,
  SEARCH_URL_SYNC_DELAY_MS,
} from '@/config';
import { i18n, type MessageKey, type PluralKey } from '@/i18n';
// The search field and filter buttons, shared with the table of all ships (#406): unscoped.
import './list-controls.css';
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
  chosenRefinement,
  filterCounts as countFilters,
  matchesFilterStates,
  nextFilterState,
  refinedPredicates,
  type FilterCategory,
  type FilterPredicates,
  type FilterRefinements,
  type FilterState,
} from '../filters';
import SvgIcon from '@/icons/SvgIcon.vue';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import { searchFromUrl, urlWithSearch } from '../route';
import { groupItems, type GroupFacts, type ItemGroup } from '../grouping';
import { matchesSearch, parseSearchQuery } from '../search';
import { vTooltip } from '@/shared/tooltip/tooltip';

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
  /** The finer choices of filters while they are included (#419), with their labels. */
  refinements?: FilterRefinements<T, F>;
  filterLabel: (filter: F) => string;
  /** An explanation of a filter, shown in its tooltip before the state. */
  filterHint?: (filter: F) => string | undefined;
  /** The list's tab is shown: only then it owns the search parameter of the URL. */
  active: boolean;
  /** The orders to choose from; `entries` come in the selected one (`sort`). */
  sortOptions?: readonly { value: S; label: string }[];
  sort?: S;
  /**
   * A filter without a button, turned on from outside (e.g. "Show" in the sidebar's
   * notifications): each new request (`at`) shows only the entries it `matches`, without search
   * and other filters. "Reset filter" turns it off, and it goes on its own once no entry matches.
   */
  filterRequest?: { matches: (entry: T) => boolean; at: number } | null;
  /**
   * A filter button turned on from outside (e.g. the sidebar's notification about expected price
   * increases, #193): each new request (`at`) includes only this filter, without search. With
   * `clear` it turns just this filter off again (the sidebar's toggle, #254).
   */
  includeRequest?: { filter: F; at: number; clear?: boolean } | null;
  /**
   * A view of the list to show (#436): a pledge opened from elsewhere in the manager (its id as the
   * search, no filters), or the view to come back to with the browser's Back.
   */
  viewRequest?: { search: string; filters?: [string, FilterState][]; at: number } | null;
  /**
   * The classes that highlight in every row what the included filters are about (#216, see
   * `highlights.ts`), from their states.
   */
  highlights?: (states: ReadonlyMap<F, FilterState>) => readonly string[];
  /**
   * The grouped view (#445, #447): with `on`, the entries left by search and filters show as
   * groups of the same items (`grouping.ts`), each by the `group` slot, a group of one by `row`.
   * `factsOf` tells what an entry is; without it the list has no grouped view.
   */
  grouping?: { on: boolean; factsOf: (entry: T) => GroupFacts };
  /** Texts of a list of other entries than pledges (e.g. warbond offers); pledges' by default. */
  texts?: Partial<Record<CountText, PluralKey> & Record<ListText, MessageKey>>;
}>();

/** The counts, in the singular and plural (#300). */
type CountText = 'count' | 'countFiltered';
type ListText = 'searchPlaceholder' | 'noResults';
const textOf = (key: ListText): MessageKey => props.texts?.[key] ?? `manager.${key}`;
const countTextOf = (key: CountText): PluralKey => props.texts?.[key] ?? `manager.${key}`;

const emit = defineEmits<{
  'update:sort': [sort: S];
  /** The filter of `filterRequest` went off: by "Reset filters", or as nothing matches it. */
  'clear-request': [];
  /** The entries search and filters leave visible, whenever they change. */
  visible: [entries: T[]];
  /** The states of the filter buttons, whenever they change (e.g. for the sidebar's toggles). */
  'filter-states': [states: ReadonlyMap<F, FilterState>];
  /** The toggle of the grouped view (#447). */
  'update:grouped': [on: boolean];
}>();

defineSlots<{
  row(props: { entry: T; autoExpand: boolean }): unknown;
  /** A group of several entries in the grouped view (#447). */
  group?(props: { group: ItemGroup<T> }): unknown;
  /** More controls beside the sort, e.g. the period of the warbond history. */
  side?(): unknown;
}>();

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

/**
 * The option chosen per refined filter (#419), by its id. Only an included filter keeps one:
 * excluding the filter or turning it off puts it back to "all".
 */
const refinementStates = shallowRef<ReadonlyMap<F, string>>(new Map());
watch(filterStates, (states) => {
  const kept = [...refinementStates.value].filter(([filter]) => states.get(filter) === 'include');
  if (kept.length !== refinementStates.value.size) refinementStates.value = new Map(kept);
});
function refine(filter: F, option: string) {
  const next = new Map(refinementStates.value);
  if (option === props.refinements?.[filter]?.[0]?.id) next.delete(filter);
  else next.set(filter, option);
  refinementStates.value = next;
}
/** The options of a filter offered now: while it is included. */
const refinementOf = (filter: F) =>
  filterStates.value.get(filter) === 'include' ? props.refinements?.[filter] : undefined;
const refinementOptions = (filter: F) =>
  (refinementOf(filter) ?? []).map((option) => ({ value: option.id, label: option.label }));
/** The pill's label: the filter's, and the option chosen after it, e.g. "Paints · Owned ships". */
function pillLabel(filter: F) {
  const label = props.filterLabel(filter);
  const option = chosenRefinement(filter, props.refinements, refinementStates.value);
  return option ? `${label} · ${option.short ?? option.label}` : label;
}
/** The predicates with the chosen options (filters.ts). */
const predicates = computed(() =>
  refinedPredicates(props.predicates, props.refinements, refinementStates.value),
);

/** The filter requested from outside while it is on (see `filterRequest`). */
const requested = shallowRef<((entry: T) => boolean) | null>(null);

function clearRequested() {
  if (!requested.value) return;
  requested.value = null;
  emit('clear-request');
}

const resetFilters = () => {
  filterStates.value = new Map();
  refinementStates.value = new Map();
  clearRequested();
};

watch(
  () => props.filterRequest,
  (request) => {
    if (!request) {
      requested.value = null;
      return;
    }
    query.value = '';
    filterStates.value = new Map();
    requested.value = request.matches;
    refinementStates.value = new Map();
  },
  { immediate: true },
);

watch(
  () => props.includeRequest,
  (request) => {
    if (!request) return;
    if (request.clear) {
      if (!filterStates.value.has(request.filter)) return;
      const next = new Map(filterStates.value);
      next.delete(request.filter);
      filterStates.value = next;
      return;
    }
    query.value = '';
    clearRequested();
    filterStates.value = new Map([[request.filter, 'include']]);
    refinementStates.value = new Map();
  },
  { immediate: true },
);

watch(
  () => props.viewRequest,
  (request) => {
    if (!request) return;
    clearRequested();
    query.value = request.search;
    filterStates.value = new Map((request.filters ?? []) as [F, FilterState][]);
    refinementStates.value = new Map();
  },
);

// Off once nothing matches it any more (e.g. all marked pledges melted).
watch(
  () => !!requested.value && !props.entries.some(requested.value),
  (empty) => empty && clearRequested(),
);

// A filter turned off in the settings no longer filters the list, either.
watch(filters, (filters) => {
  const kept = [...filterStates.value].filter(([filter]) => filters.includes(filter));
  if (kept.length !== filterStates.value.size) filterStates.value = new Map(kept);
});

/** Entries matching the search and a requested filter; the filters and their counts work on these. */
const searched = computed(() => {
  const terms = parseSearchQuery(query.value);
  const matches = requested.value;
  return terms.length || matches
    ? props.entries.filter(
        (entry) =>
          (!terms.length || matchesSearch(entry.searchText, terms)) && (!matches || matches(entry)),
      )
    : props.entries;
});

/** Per filter: entries with it among those passing search and the other filters (filters.ts). */
const filterCounts = computed(() =>
  countFilters(searched.value, filters.value, filterStates.value, predicates.value),
);

/** Ids of the entries matching search and filters; `null` while neither is active. */
const visibleIds = computed(() => {
  const states = filterStates.value;
  if (searched.value === props.entries && states.size === 0) return null;
  const ids = new Set<number>();
  for (const entry of searched.value) {
    if (matchesFilterStates(entry, states, predicates.value)) ids.add(entry.id);
  }
  return ids;
});

/** Tooltip of a filter: its explanation, its state and what a click does. */
function filterTitle(filter: F) {
  const label = pillLabel(filter);
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

watch(matching, (entries) => emit('visible', entries), { immediate: true });
watch(filterStates, (states) => emit('filter-states', states), { immediate: true });

/**
 * The grouped view: groups of the matching entries, in the order of their first entry – the list's
 * order by a single entry, so turning it on keeps the order. `null` while it is off.
 */
const grouped = computed(() =>
  props.grouping?.on ? groupItems(matching.value, props.grouping.factsOf) : null,
);

/** Id of the only entry shown, which then opens on its own; undefined for more or none. */
const onlyVisibleId = computed(() =>
  matching.value.length === 1 ? matching.value[0]!.id : undefined,
);

// Progressive rendering: start with one batch, add small steps while the end is within reach.
const renderLimit = ref(LIST_RENDER_BATCH);
const rendered = computed(() => matching.value.slice(0, renderLimit.value));
/** The groups drawn, like the rows a batch at a time; each a group or a single entry. */
const renderedGroups = computed(() => grouped.value?.slice(0, renderLimit.value) ?? []);
const shownLength = computed(() => grouped.value?.length ?? matching.value.length);
watch(matching, () => (renderLimit.value = LIST_RENDER_BATCH));
watch(grouped, () => (renderLimit.value = LIST_RENDER_BATCH));

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
  if (renderLimit.value >= shownLength.value) return;
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

const countLabel = computed(() => {
  const count = visibleIds.value
    ? i18n.n(countTextOf('countFiltered'), props.entries.length, [
        visibleIds.value.size,
        props.entries.length,
      ])
    : i18n.n(countTextOf('count'), props.entries.length);
  // The grouped view also counts its groups.
  return grouped.value
    ? `${count} · ${i18n.n('manager.groupCount', grouped.value.length, [grouped.value.length])}`
    : count;
});
</script>

<template>
  <div class="shm-list">
    <!-- Search first, then the filters: one block, as the filters narrow down what is found. -->
    <div class="shm-controls">
      <span class="shm-search-field">
        <SvgIcon class="shm-search-icon" name="magnifying-glass" />
        <input
          ref="search"
          v-model="query"
          type="search"
          class="shm-search"
          :placeholder="i18n.t(textOf('searchPlaceholder'))"
          :aria-label="i18n.t(textOf('searchPlaceholder'))"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          v-if="query"
          v-tooltip="i18n.t('manager.clearSearch')"
          type="button"
          class="shm-search-clear"
          :aria-label="i18n.t('manager.clearSearch')"
          @click="clearSearch"
        >
          <SvgIcon name="circle-xmark" />
        </button>
      </span>
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
            <!-- A pill: the filter, and while it is included its finer choice, if any (#419). -->
            <span
              v-for="filter in group.filters"
              :key="filter"
              class="shm-filter-pill"
              :class="{ 'is-refinable': refinementOf(filter) }"
            >
              <button
                v-tooltip="filterTitle(filter)"
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
                @click="cycleFilter(filter)"
              >
                <span
                  v-if="filterStates.get(filter) === 'exclude'"
                  class="shm-filter-not"
                  aria-hidden="true"
                  >−</span
                >
                <span class="shm-filter-label">{{ pillLabel(filter) }}</span>
                <span class="shm-filter-count">{{ filterCounts.get(filter) }}</span>
              </button>
              <SelectMenu
                v-if="refinementOf(filter)"
                v-tooltip="i18n.t('filter.refine', [filterLabel(filter)])"
                :options="refinementOptions(filter)"
                :model-value="refinementStates.get(filter) ?? refinementOptions(filter)[0]!.value"
                :label="i18n.t('filter.refine', [filterLabel(filter)])"
                icon="chevron-down"
                icon-only
                align="start"
                button-class="shm-filter is-active shm-filter-refine"
                @update:model-value="refine(filter, $event)"
              />
            </span>
            <!-- After the last group's buttons, so it doesn't add a line when it appears. -->
            <button
              v-if="(filterStates.size || requested) && index === shownGroups.length - 1"
              type="button"
              class="shm-filter-reset"
              @click="resetFilters"
            >
              {{ i18n.t('filter.reset') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- The count, and on the right the order. -->
    <div class="shm-count">
      <span aria-live="polite">{{ countLabel }}</span>
      <span class="shm-count-side">
        <slot name="side" />
        <button
          v-if="grouping"
          v-tooltip="i18n.t('manager.groupHint')"
          type="button"
          class="shm-group-toggle"
          :aria-pressed="grouping.on"
          @click="emit('update:grouped', !grouping.on)"
        >
          <SvgIcon name="layer-group" />
          {{ i18n.t('manager.group') }}
        </button>
        <SelectMenu
          v-if="sortOptions && sortOptions.length > 1 && sort"
          class="shm-sort"
          :options="sortOptions"
          :model-value="sort"
          :label="i18n.t('sort.label')"
          icon="arrow-down-short-wide"
          @update:model-value="emit('update:sort', $event)"
        />
      </span>
    </div>

    <!-- One grouped list (Modern Hangar) or separate rows (Classic RSI). -->
    <div
      v-if="grouped ? renderedGroups.length : rendered.length"
      class="shm-rows"
      :class="highlights?.(filterStates)"
    >
      <template v-if="grouped">
        <template v-for="group in renderedGroups" :key="group.key">
          <slot
            v-if="group.count === 1 || !$slots.group"
            name="row"
            :entry="group.items[0]!"
            :auto-expand="group.items[0]!.id === onlyVisibleId"
          />
          <slot v-else name="group" :group="group" />
        </template>
      </template>
      <template v-else>
        <template v-for="entry in rendered" :key="entry.id">
          <slot name="row" :entry="entry" :auto-expand="entry.id === onlyVisibleId" />
        </template>
      </template>
    </div>
    <div ref="sentinel" class="shm-sentinel" aria-hidden="true"></div>

    <p v-if="visibleIds && visibleIds.size === 0" class="shm-no-results">
      {{ i18n.t(textOf('noResults')) }}
    </p>
  </div>
</template>

<style scoped>
.shm-list {
  margin-top: 20px;
}

.shm-count {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 16px;
  margin: 10px 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-count-side {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-left: auto;
}

.shm-group-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  color: inherit;
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-group-toggle:hover,
.shm-group-toggle:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-group-toggle[aria-pressed='true'] {
  color: var(--shm-accent);
}

.shm-sentinel {
  height: 1px;
}

.shm-no-results {
  margin: 20px 0;
  color: var(--shm-text-muted);
}
</style>
