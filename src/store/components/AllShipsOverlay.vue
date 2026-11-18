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
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { allShips, type AllShipsRow } from '../all-ships';
import {
  ALL_SHIPS_FILTERS,
  ALL_SHIPS_SORT_COLUMNS,
  allShipsView,
  DEFAULT_ALL_SHIPS_SORT,
  isOnSale,
  ownsAny,
  priceBounds,
  VALUE_SCALE,
  valueBand,
  valueHistogram,
  type AllShipsColumn,
  type AllShipsFilter,
  type AllShipsSort,
} from '../all-ships-view';
import type { WarbondTarget } from '../warbond';
import ShipUpgradeButtons from './ShipUpgradeButtons.vue';
// The search field and the filter buttons of the manager's lists.
import '@/hangar/components/list-controls.css';

/*
 * The table of all ships by value (#385), opened from the Pledge Store tab, laid out as the design
 * "Pledge Store – All ships by value": a toolbar with the search, the filters (as My Hangar's) and
 * the value range – a histogram of the ships per $50 over a slider –, then the table, cheapest
 * first, with a line at every $100 while sorted by value. Each ship shows its value and warbond
 * price, whether it is always available or not sold any more, what the hangar and the buy back
 * have of it (tinted while they have any) and how to get it in the Pledge Store. Sorted by any
 * column, searched and filtered (#406, `all-ships-view.ts`). The head stays in view while the
 * table scrolls in the dialog. Teleported out of the manager like its other dialogs, so it
 * carries the theme itself.
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

/** The search, the value range on the slider's scale ($0 to "$1,000 and more") and the filters. */
const search = ref('');
const low = ref(0);
const high = ref<number>(VALUE_SCALE.end);
const setLow = (event: Event) =>
  (low.value = Math.min(Number((event.target as HTMLInputElement).value), high.value));
const setHigh = (event: Event) =>
  (high.value = Math.max(Number((event.target as HTMLInputElement).value), low.value));
/** The upper end of the scale: no upper end. */
const upper = computed(() => (high.value >= VALUE_SCALE.end ? Infinity : high.value));

const filters = ref(new Set<AllShipsFilter>());
const FILTER_LABELS: Record<AllShipsFilter, MessageKey> = {
  alwaysAvailable: 'allShips.filterAlwaysAvailable',
  onSale: 'allShips.filterOnSale',
  warbond: 'allShips.filterWarbond',
  owned: 'allShips.filterOwned',
};
function toggleFilter(filter: AllShipsFilter) {
  const next = new Set(filters.value);
  if (!next.delete(filter)) next.add(filter);
  filters.value = next;
}
/** How many ships each filter keeps, as the chips of My Hangar show it. */
const filterCounts = computed(
  () =>
    Object.fromEntries(
      ALL_SHIPS_FILTERS.map((filter) => [
        filter,
        allShipsView(rows.value, {
          search: '',
          min: 0,
          max: Infinity,
          filters: new Set([filter]),
        }).length,
      ]),
    ) as Record<AllShipsFilter, number>,
);

const narrowed = computed(
  () => !!search.value.trim() || !!filters.value.size || low.value > 0 || upper.value < Infinity,
);
function reset() {
  search.value = '';
  filters.value = new Set();
  low.value = 0;
  high.value = VALUE_SCALE.end;
}

const shown = computed(() =>
  allShipsView(
    rows.value,
    { search: search.value, min: low.value, max: upper.value, filters: filters.value },
    sort.value,
  ),
);

/** The lines between the $100 bands, while sorted by value. */
const bandStarts = computed(() => {
  const starts = new Set<number>();
  if (sort.value.column !== 'value') return starts;
  let previous: number | undefined;
  for (const row of shown.value) {
    const band = valueBand(row.ship.msrp);
    if (previous !== undefined && band !== previous) starts.add(row.ship.id);
    previous = band;
  }
  return starts;
});

/** "244 ships · 207 of them in your hangar or buy back · a line marks every $100". */
const count = computed(() => {
  const total = rows.value.length;
  const active = ALL_SHIPS_FILTERS.filter((filter) => filters.value.has(filter));
  const main = narrowed.value
    ? i18n.n('allShips.countFiltered', total, [shown.value.length, total])
    : i18n.n('allShips.count', total);
  const owned = rows.value.filter(ownsAny).length;
  const sub = active.length
    ? i18n.t('allShips.filteredBy', [
        new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
          active.map((filter) => i18n.t(FILTER_LABELS[filter])),
        ),
      ])
    : i18n.n('allShips.countOwned', owned);
  const parts = [sub, ...(sort.value.column === 'value' ? [i18n.t('allShips.bandNote')] : [])];
  return { main, sub: parts.join(' · ') };
});

/** The value range as text, with the ships' own lowest and highest value at the scale's ends. */
const bounds = computed(() => priceBounds(rows.value));
const rangeText = computed(() => {
  const from = low.value > 0 ? low.value : bounds.value.min;
  const to = upper.value < Infinity ? upper.value : bounds.value.max;
  return `${usd(from)} – ${usd(to)}`;
});

/** The histogram's bars: their height, and whether they are in the range chosen. */
const histogram = computed(() => {
  const bars = valueHistogram(rows.value);
  const most = Math.max(1, ...bars);
  return bars.map((ships, index) => {
    const start = index * VALUE_SCALE.step;
    return {
      key: start,
      height: `${Math.round((ships / most) * 30)}px`,
      inRange: start + VALUE_SCALE.step > low.value && start <= high.value,
    };
  });
});
const TICKS = [0, 250, 500, 750, 1000];
const tickText = (value: number) => `${usd(value)}${value === VALUE_SCALE.end ? '+' : ''}`;
/** Where the slider's range lies, for its track between the handles. */
const rangeStyle = computed(() => ({
  '--shm-range-from': `${(low.value / VALUE_SCALE.end) * 100}%`,
  '--shm-range-to': `${(high.value / VALUE_SCALE.end) * 100}%`,
}));

const usd = (value: number) => formatUsd(value, locale.value);

/** The counts of a group: ships, CCUs to it, CCUs from it, as the design orders them. */
const GROUPS = {
  hangar: ['hangarShips', 'hangarTo', 'hangarFrom'],
  buyback: ['buybackShips', 'buybackTo', 'buybackFrom'],
} as const satisfies Record<string, readonly AllShipsColumn[]>;
const COLUMN_HEADS: Record<string, { label: MessageKey; hint: MessageKey }> = {
  hangarShips: { label: 'allShips.colShips', hint: 'allShips.colShipsHint' },
  hangarTo: { label: 'allShips.colCcusTo', hint: 'allShips.colCcusToHint' },
  hangarFrom: { label: 'allShips.colCcusFrom', hint: 'allShips.colCcusFromHint' },
  buybackShips: { label: 'allShips.colShips', hint: 'allShips.colShipsHint' },
  buybackTo: { label: 'allShips.colCcusTo', hint: 'allShips.colCcusToHint' },
  buybackFrom: { label: 'allShips.colCcusFrom', hint: 'allShips.colCcusFromHint' },
};
type CountColumn = (typeof GROUPS)[keyof typeof GROUPS][number];
const countOf = (row: AllShipsRow, column: CountColumn) => row[column];
const hasAny = (row: AllShipsRow, group: keyof typeof GROUPS) =>
  GROUPS[group].some((column) => row[column] > 0);
const read = (group: keyof typeof GROUPS) =>
  group === 'hangar' ? props.hangarRead : props.buybackRead;

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}
onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
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
          <!-- The toolbar: search and filters on the left, the value range on the right. -->
          <div class="shm-all-ships-toolbar">
            <div class="shm-all-ships-find">
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
              <div
                class="shm-filter-buttons"
                role="group"
                :aria-label="i18n.t('allShips.filtersLabel')"
              >
                <span class="shm-filter-group-label">{{ i18n.t('allShips.filtersLabel') }}</span>
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
                  <span class="shm-filter-count">{{ filterCounts[filter] }}</span>
                </button>
                <button v-if="narrowed" type="button" class="shm-filter-reset" @click="reset">
                  {{ i18n.t('allShips.reset') }}
                </button>
              </div>
            </div>

            <div
              class="shm-all-ships-range"
              role="group"
              :aria-label="i18n.t('allShips.priceRange')"
            >
              <span class="shm-all-ships-range-head">
                <span>{{ i18n.t('allShips.priceRange') }}</span>
                <span class="shm-all-ships-range-text shm-value">{{ rangeText }}</span>
              </span>
              <span
                class="shm-all-ships-histogram"
                role="img"
                :aria-label="i18n.t('allShips.histogram')"
              >
                <span
                  v-for="bar in histogram"
                  :key="bar.key"
                  class="shm-all-ships-bar"
                  :class="{ 'is-out': !bar.inRange }"
                  :style="{ height: bar.height }"
                ></span>
              </span>
              <span class="shm-all-ships-slider" :style="rangeStyle">
                <input
                  type="range"
                  min="0"
                  :max="VALUE_SCALE.end"
                  :step="VALUE_SCALE.step"
                  :value="low"
                  :aria-label="i18n.t('allShips.priceFrom')"
                  :aria-valuetext="usd(low)"
                  @input="setLow"
                />
                <input
                  type="range"
                  min="0"
                  :max="VALUE_SCALE.end"
                  :step="VALUE_SCALE.step"
                  :value="high"
                  :aria-label="i18n.t('allShips.priceTo')"
                  :aria-valuetext="tickText(high)"
                  @input="setHigh"
                />
              </span>
              <span class="shm-all-ships-ticks" aria-hidden="true">
                <span v-for="tick in TICKS" :key="tick">{{ tickText(tick) }}</span>
              </span>
            </div>
          </div>

          <p class="shm-all-ships-count" aria-live="polite">
            <strong>{{ count.main }}</strong> · {{ count.sub }}
          </p>

          <p v-if="!shown.length" class="shm-overlay-note">{{ i18n.t('allShips.noResults') }}</p>
          <div v-else class="shm-all-ships-scroll" tabindex="0">
            <table class="shm-all-ships-table">
              <colgroup>
                <col />
                <col class="shm-all-ships-col-value" />
                <col v-for="index in 6" :key="index" class="shm-all-ships-col-count" />
                <col class="shm-all-ships-col-store" />
              </colgroup>
              <thead>
                <tr class="shm-all-ships-groups">
                  <th colspan="2" aria-hidden="true"></th>
                  <th scope="colgroup" colspan="3" class="is-hangar">
                    <span>{{ i18n.t('allShips.groupHangar') }}</span>
                  </th>
                  <th scope="colgroup" colspan="3" class="is-buyback">
                    <span>{{ i18n.t('allShips.groupBuyback') }}</span>
                  </th>
                  <th aria-hidden="true"></th>
                </tr>
                <tr>
                  <SortableTh column="name" :sort="sort" class="shm-all-ships-name" @sort="sortBy">
                    {{ i18n.t('allShips.colShip') }}
                  </SortableTh>
                  <SortableTh column="value" :sort="sort" numeric @sort="sortBy">
                    {{ i18n.t('allShips.colValue') }}
                  </SortableTh>
                  <template v-for="(columns, group) in GROUPS" :key="group">
                    <SortableTh
                      v-for="column in columns"
                      :key="column"
                      v-tooltip="i18n.t(COLUMN_HEADS[column]!.hint)"
                      :column="column"
                      :sort="sort"
                      class="is-count"
                      @sort="sortBy"
                    >
                      {{ i18n.t(COLUMN_HEADS[column]!.label) }}
                    </SortableTh>
                  </template>
                  <SortableTh column="onSale" :sort="sort" numeric @sort="sortBy">
                    {{ i18n.t('allShips.colPledgeStore') }}
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in shown"
                  :key="row.ship.id"
                  :class="{
                    'is-band-start': bandStarts.has(row.ship.id),
                    'is-not-sold': row.purchasable === false,
                  }"
                >
                  <th scope="row" class="shm-all-ships-name">
                    <span class="shm-all-ships-ship">
                      <span class="shm-all-ships-ship-name">{{ row.ship.name }}</span>
                      <span v-if="row.manufacturer" class="shm-all-ships-maker">{{
                        row.manufacturer
                      }}</span>
                      <span
                        v-if="row.alwaysAvailable"
                        v-tooltip="i18n.t('store.colAlwaysAvailableHint')"
                        class="shm-all-ships-tag is-available"
                        >{{ i18n.t('store.colAlwaysAvailable') }}</span
                      >
                      <span
                        v-if="row.purchasable === false"
                        v-tooltip="i18n.t('allShips.colPurchasableHint')"
                        class="shm-all-ships-tag"
                        >{{ i18n.t('allShips.notSold') }}</span
                      >
                    </span>
                  </th>
                  <td class="shm-all-ships-value">
                    <span class="shm-value">{{ usd(row.ship.msrp) }}</span>
                    <template v-if="row.warbondPrice !== undefined">
                      <span class="shm-all-ships-warbond shm-value">{{
                        i18n.t('allShips.warbondPrice', [usd(row.warbondPrice)])
                      }}</span>
                      <span class="shm-all-ships-saves shm-value">{{
                        i18n.t('allShips.saves', [usd(row.ship.msrp - row.warbondPrice)])
                      }}</span>
                    </template>
                  </td>
                  <template v-for="(columns, group) in GROUPS" :key="group">
                    <template v-if="read(group)">
                      <td
                        v-for="(column, index) in columns"
                        :key="column"
                        class="is-count"
                        :class="[
                          `is-${group}`,
                          {
                            'is-tinted': hasAny(row, group),
                            'is-first': index === 0,
                            'is-last': index === columns.length - 1,
                            'is-from': column.endsWith('From'),
                            'is-none': !countOf(row, column),
                          },
                        ]"
                      >
                        {{ countOf(row, column) || '·' }}
                      </td>
                    </template>
                    <td v-else colspan="3" class="is-count is-none">
                      {{ i18n.t('allShips.notRead') }}
                    </td>
                  </template>
                  <td class="shm-all-ships-store">
                    <ShipUpgradeButtons
                      v-if="isOnSale(row)"
                      short
                      :ship-id="row.ship.id"
                      :ship-name="row.ship.name"
                      :sku-id="row.skuId"
                      :warbond-sku-id="row.warbondSkuId"
                    />
                    <span v-else-if="row.purchasable !== false" class="shm-all-ships-note">{{
                      i18n.t('allShips.notOnSale')
                    }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="shm-all-ships-source">{{ i18n.t('allShips.source') }}</p>
          </div>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>

<style>
/* As wide as the design: the table of nine columns and its toolbar. */
.shm-all-ships.shm-overlay-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(1040px, 100%);
  /* One height, whatever the filters show: the dialog doesn't jump. */
  height: min(1000px, calc(100vh - 120px));
  padding-bottom: 0;
}

.shm-all-ships .shm-overlay-header {
  margin-bottom: 0;
}

.shm-all-ships-intro {
  margin: 2px 0 0;
  color: var(--shm-text-muted);
}

/* Search and filters on the left, the value range on the right; stacked on narrow windows. */
.shm-all-ships-toolbar {
  display: grid;
  flex: none;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: end;
  padding: 12px 14px;
  background: rgb(0 0 0 / 0.22);
  border-radius: var(--shm-radius-cell);
}

@media (max-width: 760px) {
  .shm-all-ships-toolbar {
    grid-template-columns: minmax(0, 1fr);
  }
}

.shm-all-ships-find {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.shm-all-ships-find .shm-search-field {
  flex: none;
}

.shm-all-ships-find .shm-filter-buttons {
  align-items: center;
}

.shm-all-ships-find .shm-filter-group-label {
  margin-right: 2px;
}

.shm-all-ships-range {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.shm-all-ships-range-head {
  display: flex;
  justify-content: space-between;
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-all-ships-range-text {
  color: var(--shm-text-strong);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* How many ships each $50 has: the bars in the range chosen stand out. */
.shm-all-ships-histogram {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 30px;
}

.shm-all-ships-bar {
  flex: 1;
  min-height: 2px;
  background: rgb(var(--shm-accent-rgb) / 0.55);
  border-radius: 2px 2px 0 0;
}

.shm-all-ships-bar.is-out {
  background: rgb(var(--shm-accent-rgb) / 0.18);
}

/*
 * Two range inputs on one track: only their handles take the pointer, the track between them
 * shows the range chosen.
 */
.shm-all-ships-slider {
  position: relative;
  height: 16px;
}

.shm-all-ships-slider::before {
  position: absolute;
  top: 7px;
  right: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(
    to right,
    rgb(var(--shm-accent-rgb) / 0.25) var(--shm-range-from),
    var(--shm-accent) var(--shm-range-from) var(--shm-range-to),
    rgb(var(--shm-accent-rgb) / 0.25) var(--shm-range-to)
  );
  border-radius: 1px;
  content: '';
}

.shm-all-ships-slider input {
  position: absolute;
  inset: 0 -8px;
  width: calc(100% + 16px);
  height: 16px;
  margin: 0;
  background: none;
  appearance: none;
  pointer-events: none;
}

.shm-all-ships-slider input::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  background: #fff;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
  appearance: none;
  cursor: grab;
  pointer-events: auto;
}

.shm-all-ships-slider input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #fff;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
  cursor: grab;
  pointer-events: auto;
}

.shm-all-ships-slider input::-moz-range-track {
  background: none;
}

.shm-all-ships-slider input:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgb(var(--shm-accent-rgb) / 0.5);
}

.shm-all-ships-ticks {
  display: flex;
  justify-content: space-between;
  color: var(--shm-text-faint);
  font-size: calc(10px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-all-ships-count {
  flex: none;
  margin: 0;
  padding: 0 2px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-all-ships-count strong {
  color: var(--shm-text-strong);
}

/* The table scrolls inside the dialog, its head stays; sideways on narrow windows. */
.shm-all-ships-scroll {
  flex: 1;
  min-height: 0;
  margin: 0 -24px;
  overflow: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--shm-separator, rgb(var(--shm-accent-rgb) / 0.14));
  outline: none;
}

/* Fixed columns: the table doesn't jump sideways while filtering. */
.shm-all-ships-table {
  width: 100%;
  min-width: 900px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-size: calc(13px * var(--shm-font-scale));
}

.shm-all-ships-col-value {
  width: 98px;
}

.shm-all-ships-col-count {
  width: 64px;
}

.shm-all-ships-col-store {
  width: 214px;
}

.shm-all-ships-table th,
.shm-all-ships-table td {
  padding: 2px 7px;
  text-align: center;
  vertical-align: middle;
}

.shm-all-ships-table :is(th, td):first-child {
  padding-left: 24px;
  text-align: left;
}

.shm-all-ships-table :is(th, td):last-child {
  padding-right: 24px;
  text-align: right;
}

.shm-all-ships-table thead th {
  position: sticky;
  z-index: 1;
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
  line-height: calc(16px * var(--shm-font-scale));
  background: var(--shm-surface-elevated);
  white-space: nowrap;
}

.shm-all-ships-table thead tr:first-child th {
  top: 0;
  padding-top: 8px;
}

.shm-all-ships-table thead tr:nth-child(2) th {
  top: calc(16px * var(--shm-font-scale) + 13px);
  padding-top: 5px;
  padding-bottom: 7px;
  box-shadow: 0 1px 0 var(--shm-separator, rgb(var(--shm-accent-rgb) / 0.14));
}

.shm-all-ships-table thead .shm-sort-head {
  justify-content: center;
}

.shm-all-ships-table thead :is(th:first-child, th:last-child) .shm-sort-head {
  justify-content: inherit;
}

/* The group heads with a line in the group's color: green the hangar, orange the buy back. */
.shm-all-ships-groups th > span {
  display: block;
  padding-bottom: 3px;
  color: var(--shm-text-secondary);
  border-bottom: 1px solid currentColor;
}

.shm-all-ships-groups th.is-hangar > span {
  border-bottom-color: rgb(var(--shm-success-rgb) / 0.45);
}

.shm-all-ships-groups th.is-buyback > span {
  border-bottom-color: color-mix(in srgb, var(--shm-warning) 45%, transparent);
}

/* The rows: a faint line between them, a stronger one at every $100 while sorted by value. */
.shm-all-ships-table tbody tr {
  transition: background-color 100ms ease;
}

.shm-all-ships-table tbody :is(th, td) {
  height: 30px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.07);
}

.shm-all-ships-table tbody tr:first-child :is(th, td) {
  border-top-color: transparent;
}

.shm-all-ships-table tbody tr.is-band-start :is(th, td) {
  border-top-color: color-mix(in srgb, var(--shm-text) 38%, transparent);
}

@media (hover: hover) and (pointer: fine) {
  .shm-all-ships-table tbody tr:hover {
    background-color: rgb(var(--shm-accent-rgb) / 0.07);
  }
}

/* A ship RSI doesn't sell any more: faded. */
.shm-all-ships-table tbody tr.is-not-sold {
  opacity: 0.55;
}

.shm-all-ships-table .shm-all-ships-name {
  font-weight: normal;
}

.shm-all-ships-ship {
  display: flex;
  gap: 7px;
  align-items: baseline;
  min-width: 0;
  white-space: nowrap;
}

.shm-all-ships-ship-name {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  color: var(--shm-text-strong);
  font-weight: 600;
  text-overflow: ellipsis;
}

.shm-all-ships-maker {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
  text-overflow: ellipsis;
}

.shm-all-ships-tag {
  flex: none;
  align-self: center;
  padding: 0 5px;
  color: var(--shm-text-muted);
  font-size: calc(10px * var(--shm-font-scale));
  font-weight: 700;
  line-height: calc(15px * var(--shm-font-scale));
  background: rgb(var(--shm-accent-rgb) / 0.12);
  border-radius: 4px;
}

.shm-all-ships-tag.is-available {
  color: var(--shm-accent);
  background: rgb(var(--shm-accent-rgb) / 0.14);
}

/* The value, and below it the warbond price and what it saves. */
.shm-all-ships-table td.shm-all-ships-value {
  line-height: calc(16px * var(--shm-font-scale));
  text-align: right;
}

.shm-all-ships-value > span {
  display: block;
  font-variant-numeric: tabular-nums;
}

.shm-all-ships-value > span:first-child {
  color: var(--shm-text-strong);
  font-weight: 600;
}

.shm-all-ships-warbond {
  color: var(--shm-upgraded);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-all-ships-saves {
  color: var(--shm-text-faint);
  font-size: calc(10px * var(--shm-font-scale));
}

/*
 * The counts: tinted while the group has any – a band across its three cells, inset from the
 * row's lines, with round ends (on a layer of its own, so the lines stay straight) –, empty ones
 * as a faint dot.
 */
.shm-all-ships-table td.is-count {
  position: relative;
  color: var(--shm-text-strong);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.shm-all-ships-table td.is-tinted::before {
  position: absolute;
  inset: 2px 0;
  background: var(--shm-all-ships-tint);
  content: '';
  pointer-events: none;
}

.shm-all-ships-table td.is-tinted.is-first::before {
  left: 2px;
  border-radius: 8px 0 0 8px;
}

.shm-all-ships-table td.is-tinted.is-last::before {
  right: 2px;
  border-radius: 0 8px 8px 0;
}

.shm-all-ships-table td.is-hangar {
  --shm-all-ships-tint: rgb(var(--shm-success-rgb) / 0.08);
}

.shm-all-ships-table td.is-buyback {
  --shm-all-ships-tint: color-mix(in srgb, var(--shm-warning) 8%, transparent);
}

.shm-all-ships-table td.is-count.is-from {
  color: var(--shm-text-secondary);
}

.shm-all-ships-table td.is-count.is-none {
  color: var(--shm-text-faint);
  font-weight: 400;
}

/* The Pledge Store: "Warbond" in the warbond's yellow, "Standard" or "Ship upgrade". */
.shm-all-ships-store .shm-upgrade-buttons {
  flex-wrap: nowrap;
  gap: 5px;
}

.shm-all-ships-store .shm-button {
  height: 24px;
  padding: 0 8px;
}

/* Above the themes' own button colors. */
.shm-overlay .shm-all-ships-store .shm-button.shm-upgrade-warbond {
  color: var(--shm-upgraded);
  background: rgb(var(--shm-upgraded-rgb) / 0.15);
  border-color: transparent;
}

.shm-all-ships-note {
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
  white-space: nowrap;
}

.shm-all-ships-source {
  margin: 0;
  padding: 12px 24px 16px;
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
  line-height: calc(16px * var(--shm-font-scale));
  border-top: 1px solid var(--shm-separator, rgb(var(--shm-accent-rgb) / 0.14));
}

@media (prefers-reduced-motion: reduce) {
  .shm-all-ships-table tbody tr {
    transition: none;
  }
}
</style>
