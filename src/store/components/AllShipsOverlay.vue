<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import { formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale, type MessageKey } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import SortableTh from '@/shared/components/SortableTh.vue';
import { nextSort } from '@/shared/table-sort';
import { vTooltip } from '@/shared/tooltip/tooltip';
import type { Ship } from '@/ships/ships';
import { buyableShipsItem, current } from '@/ships/ships-storage';
import { useShipFacts } from '@/ships/use-ship-facts';
import { useStored } from '@/storage/use-stored';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { allShips } from '../all-ships';
import {
  ALL_SHIPS_FILTERS,
  ALL_SHIPS_SORT_COLUMNS,
  allShipsView,
  DEFAULT_ALL_SHIPS_SORT,
  priceBounds,
  type AllShipsColumn,
  type AllShipsFilter,
  type AllShipsSort,
} from '../all-ships-view';
import type { WarbondTarget } from '../warbond';
import ShipUpgradeButtons from './ShipUpgradeButtons.vue';
// The search field and the filter buttons of the manager's lists.
import '@/hangar/components/list-controls.css';

/*
 * The table of all ships by value (#385), opened from the Pledge Store tab: what each ship is
 * worth, whether and how it can be bought, and what the hangar and the buy back have of it
 * (`all-ships.ts`). Sorted by any column, searched and filtered (#406, `all-ships-view.ts`); the
 * columns of the hangar and the buy back are tinted apart. The head and the ship's name stay in
 * view while the table scrolls; it scrolls on its own, also sideways on narrow windows.
 * Teleported out of the manager like its other dialogs, so it carries the theme itself.
 */

const props = defineProps<{
  /** The upgrade tool's ships (the demo's in the demo). */
  ships: readonly Ship[];
  /** The tab's current warbond offers (the demo's in the demo). */
  warbonds: readonly WarbondTarget[];
  pledges: readonly PledgeView[];
  buyback: readonly BuybackView[];
  /** Whether the hangar and the buy back were read: else their columns say so. */
  hangarRead: boolean;
  buybackRead: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const facts = useShipFacts();
const storedBuyable = useStored(buyableShipsItem);

const rows = computed(() =>
  allShips({
    ships: props.ships,
    buyable: current(storedBuyable.value ?? null)?.skus ?? [],
    warbonds: props.warbonds.map((offer) => ({
      shipId: offer.ship.id,
      skuId: offer.skuId,
      price: offer.price,
    })),
    facts: facts.value,
    hangar: props.pledges,
    buyback: props.buyback,
  }),
);

/** Sorted by a click on a column head, a second click reverses it; by value, lowest first. */
const sort = ref<AllShipsSort>(DEFAULT_ALL_SHIPS_SORT);
const sortBy = (column: AllShipsColumn) =>
  (sort.value = nextSort(sort.value, column, ALL_SHIPS_SORT_COLUMNS[column].first));

/** The search, the price range and the filters (#406). */
const search = ref('');
const bounds = computed(() => priceBounds(rows.value));
const min = ref(0);
const max = ref(0);
// The range starts at the lowest and the highest value, also when the ships come later.
watch(
  bounds,
  (next) => {
    min.value = next.min;
    max.value = next.max;
  },
  { immediate: true },
);
const filters = ref(new Set<AllShipsFilter>());
const FILTER_LABELS: Record<AllShipsFilter, MessageKey> = {
  alwaysAvailable: 'allShips.filterAlwaysAvailable',
  onSale: 'allShips.filterOnSale',
  warbond: 'allShips.filterWarbond',
};
function toggleFilter(filter: AllShipsFilter) {
  const next = new Set(filters.value);
  if (!next.delete(filter)) next.add(filter);
  filters.value = next;
}

/** A number field's value within the bounds and the other end; the slider's likewise. */
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? Math.round(value) : low));
const setMin = (value: number) => (min.value = clamp(value, bounds.value.min, max.value));
const setMax = (value: number) => (max.value = clamp(value, min.value, bounds.value.max));
const numberOf = (event: Event) => (event.target as HTMLInputElement).valueAsNumber;

const narrowed = computed(
  () =>
    !!search.value.trim() ||
    !!filters.value.size ||
    min.value > bounds.value.min ||
    max.value < bounds.value.max,
);
function reset() {
  search.value = '';
  filters.value = new Set();
  min.value = bounds.value.min;
  max.value = bounds.value.max;
}

const shown = computed(() =>
  allShipsView(
    rows.value,
    { search: search.value, min: min.value, max: max.value, filters: filters.value },
    sort.value,
  ),
);
const countText = computed(() =>
  narrowed.value
    ? i18n.n('allShips.countFiltered', rows.value.length, [shown.value.length, rows.value.length])
    : i18n.n('allShips.count', rows.value.length),
);

/** Where the slider's range lies, for its track between the handles. */
const rangeStyle = computed(() => {
  const { min: low, max: high } = bounds.value;
  const share = (value: number) => (high > low ? ((value - low) / (high - low)) * 100 : 0);
  return { '--shm-range-from': `${share(min.value)}%`, '--shm-range-to': `${share(max.value)}%` };
});

const usd = (value: number) => formatUsd(value, locale.value);

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));

/** The columns of a group: hangar or buy back, tinted apart. */
const GROUP_COLUMNS = {
  hangar: ['hangarFrom', 'hangarTo', 'hangarShips'],
  buyback: ['buybackFrom', 'buybackTo', 'buybackShips'],
} as const satisfies Record<string, readonly AllShipsColumn[]>;
const GROUP_HEADS: Record<string, { label: MessageKey; hint: MessageKey }> = {
  hangarFrom: { label: 'allShips.colCcusFrom', hint: 'allShips.colCcusFromHint' },
  hangarTo: { label: 'allShips.colCcusTo', hint: 'allShips.colCcusToHint' },
  hangarShips: { label: 'allShips.colShips', hint: 'allShips.colShipsHint' },
  buybackFrom: { label: 'allShips.colCcusFrom', hint: 'allShips.colCcusFromHint' },
  buybackTo: { label: 'allShips.colCcusTo', hint: 'allShips.colCcusToHint' },
  buybackShips: { label: 'allShips.colShips', hint: 'allShips.colShipsHint' },
};
</script>

<template>
  <Teleport to="body">
    <div
      class="shm-overlay"
      :class="[themeClasses(settings), { 'shm-hide-values': settings.hideMeltValue }]"
      :style="fontScaleStyle(settings)"
      @click.self="emit('close')"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-all-ships"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shm-all-ships-title"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <div>
            <h3 id="shm-all-ships-title">{{ i18n.t('allShips.title') }}</h3>
            <p class="shm-all-ships-intro">{{ i18n.t('allShips.intro') }}</p>
          </div>
          <button
            v-tooltip="i18n.t('order.close')"
            type="button"
            class="shm-overlay-close"
            :aria-label="i18n.t('order.close')"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <p v-if="!rows.length" class="shm-overlay-note">{{ i18n.t('allShips.noShips') }}</p>
        <template v-else>
          <!-- Search, price range and filters (#406). -->
          <div class="shm-all-ships-controls">
            <span class="shm-search-field">
              <SvgIcon class="shm-search-icon" name="magnifying-glass" />
              <input
                v-model="search"
                type="search"
                class="shm-search"
                :placeholder="i18n.t('allShips.search')"
                :aria-label="i18n.t('allShips.search')"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                v-if="search"
                v-tooltip="i18n.t('manager.clearSearch')"
                type="button"
                class="shm-search-clear"
                :aria-label="i18n.t('manager.clearSearch')"
                @click="search = ''"
              >
                <SvgIcon name="circle-xmark" />
              </button>
            </span>
            <div class="shm-all-ships-filters">
              <div
                class="shm-all-ships-range"
                role="group"
                :aria-label="i18n.t('allShips.priceRange')"
              >
                <span class="shm-all-ships-label">{{ i18n.t('allShips.priceRange') }}</span>
                <input
                  type="number"
                  class="shm-all-ships-number shm-value"
                  :min="bounds.min"
                  :max="max"
                  :value="min"
                  :aria-label="i18n.t('allShips.priceFrom')"
                  @change="setMin(numberOf($event))"
                />
                <span class="shm-all-ships-slider" :style="rangeStyle">
                  <input
                    type="range"
                    :min="bounds.min"
                    :max="bounds.max"
                    step="5"
                    :value="min"
                    :aria-label="i18n.t('allShips.priceFrom')"
                    @input="setMin(numberOf($event))"
                  />
                  <input
                    type="range"
                    :min="bounds.min"
                    :max="bounds.max"
                    step="5"
                    :value="max"
                    :aria-label="i18n.t('allShips.priceTo')"
                    @input="setMax(numberOf($event))"
                  />
                </span>
                <input
                  type="number"
                  class="shm-all-ships-number shm-value"
                  :min="min"
                  :max="bounds.max"
                  :value="max"
                  :aria-label="i18n.t('allShips.priceTo')"
                  @change="setMax(numberOf($event))"
                />
              </div>
              <div
                class="shm-filter-buttons"
                role="group"
                :aria-label="i18n.t('allShips.filtersLabel')"
              >
                <span class="shm-all-ships-label">{{ i18n.t('allShips.filtersLabel') }}</span>
                <button
                  v-for="filter in ALL_SHIPS_FILTERS"
                  :key="filter"
                  type="button"
                  class="shm-filter"
                  :class="{ 'is-active': filters.has(filter) }"
                  :aria-pressed="filters.has(filter)"
                  @click="toggleFilter(filter)"
                >
                  <span class="shm-filter-label">{{ i18n.t(FILTER_LABELS[filter]) }}</span>
                </button>
                <button v-if="narrowed" type="button" class="shm-filter-reset" @click="reset">
                  {{ i18n.t('allShips.reset') }}
                </button>
              </div>
            </div>
            <p class="shm-all-ships-count" aria-live="polite">{{ countText }}</p>
          </div>

          <p v-if="!shown.length" class="shm-overlay-note">{{ i18n.t('allShips.noResults') }}</p>
          <div v-else class="shm-all-ships-scroll" tabindex="0">
            <table class="shm-warbond-table shm-all-ships-table">
              <thead>
                <tr>
                  <SortableTh
                    column="name"
                    :sort="sort"
                    rowspan="2"
                    class="shm-all-ships-name"
                    @sort="sortBy"
                  >
                    {{ i18n.t('allShips.colShip') }}
                  </SortableTh>
                  <SortableTh
                    column="value"
                    :sort="sort"
                    numeric
                    rowspan="2"
                    class="shm-value"
                    @sort="sortBy"
                  >
                    {{ i18n.t('allShips.colValue') }}
                  </SortableTh>
                  <SortableTh
                    v-tooltip="i18n.t('allShips.colWarbondHint')"
                    column="warbond"
                    :sort="sort"
                    numeric
                    rowspan="2"
                    class="shm-value"
                    @sort="sortBy"
                  >
                    {{ i18n.t('allShips.colWarbond') }}
                  </SortableTh>
                  <SortableTh
                    v-tooltip="i18n.t('store.colAlwaysAvailableHint')"
                    column="alwaysAvailable"
                    :sort="sort"
                    rowspan="2"
                    class="is-center"
                    @sort="sortBy"
                  >
                    {{ i18n.t('store.colAlwaysAvailable') }}
                  </SortableTh>
                  <SortableTh
                    v-tooltip="i18n.t('allShips.colPurchasableHint')"
                    column="purchasable"
                    :sort="sort"
                    rowspan="2"
                    class="is-center"
                    @sort="sortBy"
                  >
                    {{ i18n.t('allShips.colPurchasable') }}
                  </SortableTh>
                  <th scope="colgroup" colspan="3" class="is-group is-center is-hangar">
                    {{ i18n.t('allShips.groupHangar') }}
                  </th>
                  <th scope="colgroup" colspan="3" class="is-group is-center is-buyback">
                    {{ i18n.t('allShips.groupBuyback') }}
                  </th>
                  <SortableTh column="onSale" :sort="sort" rowspan="2" @sort="sortBy">
                    {{ i18n.t('allShips.colOnSale') }}
                  </SortableTh>
                </tr>
                <tr>
                  <template v-for="(columns, group) in GROUP_COLUMNS" :key="group">
                    <SortableTh
                      v-for="(column, index) in columns"
                      :key="column"
                      v-tooltip="i18n.t(GROUP_HEADS[column]!.hint)"
                      :column="column"
                      :sort="sort"
                      numeric
                      :class="[`is-${group}`, { 'is-group': index === 0 }]"
                      @sort="sortBy"
                    >
                      {{ i18n.t(GROUP_HEADS[column]!.label) }}
                    </SortableTh>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in shown" :key="row.ship.id">
                  <th scope="row" class="shm-all-ships-name">
                    <span class="is-strong">{{ row.ship.name }}</span>
                    <span v-if="row.manufacturer" class="shm-all-ships-maker">
                      {{ row.manufacturer }}
                    </span>
                  </th>
                  <td class="is-number shm-value">{{ usd(row.ship.msrp) }}</td>
                  <td class="is-number shm-value">
                    <template v-if="row.warbondPrice !== undefined">{{
                      usd(row.warbondPrice)
                    }}</template>
                  </td>
                  <td class="is-center">
                    <SvgIcon
                      v-if="row.alwaysAvailable"
                      class="shm-always-available"
                      name="check"
                      :label="i18n.t('store.colAlwaysAvailable')"
                    />
                  </td>
                  <td class="is-center">
                    <SvgIcon
                      v-if="row.purchasable"
                      class="shm-always-available"
                      name="check"
                      :label="i18n.t('allShips.colPurchasable')"
                    />
                    <span v-else-if="row.purchasable === false" class="is-none">–</span>
                  </td>
                  <template v-if="hangarRead">
                    <td
                      v-for="(count, index) in [row.hangarFrom, row.hangarTo, row.hangarShips]"
                      :key="`h${index}`"
                      class="is-number is-hangar"
                      :class="{ 'is-group': index === 0, 'is-none': !count }"
                    >
                      {{ count || '–' }}
                    </td>
                  </template>
                  <td v-else colspan="3" class="is-group is-none is-center is-hangar">
                    {{ i18n.t('allShips.notRead') }}
                  </td>
                  <template v-if="buybackRead">
                    <td
                      v-for="(count, index) in [row.buybackFrom, row.buybackTo, row.buybackShips]"
                      :key="`b${index}`"
                      class="is-number is-buyback"
                      :class="{ 'is-group': index === 0, 'is-none': !count }"
                    >
                      {{ count || '–' }}
                    </td>
                  </template>
                  <td v-else colspan="3" class="is-group is-none is-center is-buyback">
                    {{ i18n.t('allShips.notRead') }}
                  </td>
                  <td>
                    <ShipUpgradeButtons
                      v-if="row.skuId !== undefined || row.warbondSkuId !== undefined"
                      :ship-id="row.ship.id"
                      :ship-name="row.ship.name"
                      :sku-id="row.skuId"
                      :warbond-sku-id="row.warbondSkuId"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>

<style>
/* As wide as the window allows: twelve columns. */
.shm-all-ships.shm-overlay-dialog {
  width: min(1240px, 100%);
}

.shm-all-ships-intro {
  margin: 4px 0 0;
}

/* Search, then price range and filters on one line where it fits, then the count. */
.shm-all-ships-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.shm-all-ships-controls .shm-search-field {
  flex: none;
}

.shm-all-ships-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  align-items: center;
}

.shm-all-ships-filters .shm-filter-buttons {
  align-items: center;
}

.shm-all-ships-label {
  margin-right: 4px;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-all-ships-range {
  display: flex;
  gap: 8px;
  align-items: center;
}

.shm-all-ships-number {
  width: 7ch;
  height: 28px;
  padding: 0 6px;
  color: var(--shm-text);
  font: inherit;
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
  text-align: right;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.35);
  border-radius: var(--shm-radius-control);
}

.shm-all-ships-number:focus {
  border-color: var(--shm-accent);
  outline: none;
}

/*
 * Two range inputs on one track: only their handles take the pointer, the track between them
 * shows the range chosen.
 */
.shm-all-ships-slider {
  position: relative;
  width: 160px;
  height: 28px;
}

.shm-all-ships-slider::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 4px;
  background: linear-gradient(
    to right,
    rgb(var(--shm-accent-rgb) / 0.2) var(--shm-range-from),
    var(--shm-accent) var(--shm-range-from) var(--shm-range-to),
    rgb(var(--shm-accent-rgb) / 0.2) var(--shm-range-to)
  );
  border-radius: 2px;
  transform: translateY(-50%);
  content: '';
}

.shm-all-ships-slider input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: none;
  accent-color: var(--shm-accent);
  appearance: none;
  pointer-events: none;
}

.shm-all-ships-slider input::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  background: var(--shm-accent);
  border: 2px solid var(--shm-surface-elevated);
  border-radius: 50%;
  appearance: none;
  cursor: pointer;
  pointer-events: auto;
}

.shm-all-ships-slider input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--shm-accent);
  border: 2px solid var(--shm-surface-elevated);
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
}

.shm-all-ships-slider input::-moz-range-track {
  background: none;
}

.shm-all-ships-slider input:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgb(var(--shm-accent-rgb) / 0.4);
}

.shm-all-ships-count {
  margin: 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

/*
 * The table scrolls on its own, in both directions, so its head (top) and the ship's name (left)
 * stay in view.
 */
.shm-all-ships-scroll {
  max-height: calc(100vh - 320px);
  overflow: auto;
  outline: none;
}

.shm-all-ships-table thead th {
  position: sticky;
  z-index: 2;
  line-height: calc(16px * var(--shm-font-scale));
  background: var(--shm-surface-elevated);
  white-space: nowrap;
  vertical-align: bottom;
}

.shm-all-ships-table thead tr:first-child th {
  top: 0;
}

/* The second row of the head right below the first: its line and padding (store-table.css). */
.shm-all-ships-table thead tr:nth-child(2) th {
  top: calc(16px * var(--shm-font-scale) + 6px);
}

/* The first column of the second row is no first column of the table: it keeps its gap. */
.shm-all-ships-table thead tr:nth-child(2) th.is-group {
  padding-left: 24px;
}

/*
 * The groups of columns told apart (#406): the hangar's a little darker, the buy back's a little
 * lighter. The head keeps its opaque ground, so the rows don't show through while scrolling.
 */
.shm-all-ships-table td.is-hangar {
  background: rgb(0 0 0 / 0.1);
}

.shm-all-ships-table td.is-buyback {
  background: rgb(255 255 255 / 0.1);
}

.shm-all-ships-table thead th.is-hangar {
  background: linear-gradient(rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.1)), var(--shm-surface-elevated);
}

.shm-all-ships-table thead th.is-buyback {
  background:
    linear-gradient(rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.1)), var(--shm-surface-elevated);
}

/* The last column of a group with room on its right, before the next group. */
.shm-all-ships-table :is(td, th):is(.is-hangar, .is-buyback) {
  padding-right: 8px;
}

.shm-all-ships-table .shm-all-ships-name {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 160px;
  padding-right: 12px;
  font-weight: normal;
  text-align: left;
  background: var(--shm-surface-elevated);
}

.shm-all-ships-table thead .shm-all-ships-name {
  z-index: 3;
}

.shm-all-ships-maker {
  display: block;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-all-ships-table td {
  vertical-align: middle;
}

.shm-all-ships-table .shm-icon {
  width: 1.1em;
  height: 1.1em;
}

/* The upgrade buttons in a table row: no wider than their labels. */
.shm-all-ships-table .shm-upgrade-buttons {
  flex-wrap: nowrap;
  justify-content: flex-start;
}
</style>
