<script setup lang="ts">
import { openPledgeInList, urlOfView } from '@/hangar/list-jump';
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import type { Settings } from '@/settings/settings';
import TabBar from '@/shared/components/TabBar.vue';
import { rsiUrl } from '@/shared/rsi-api';
import { vTooltip } from '@/shared/tooltip/tooltip';
import SvgIcon from '@/icons/SvgIcon.vue';
import { computed, ref } from 'vue';
// The store's tables (`shm-warbond-table`), shared and unscoped.
import '@/store/components/store-table.css';
import { listDate, useProvidedAlwaysAvailable } from '../always-available';
import {
  BASE_SHIP_GROUPS,
  baseShipList,
  type BaseShipGroup,
  type BaseShipRow,
  type CcuStanding,
} from '../base-ship-list';
import {
  useProvidedCcuCoverage,
  useProvidedCoverageSources,
  type CoverageMatch,
} from '../coverage';

/*
 * The CCU Consultant in the tab "Consultants" (#113): whether every CCU of the hangar can be
 * applied. A bar shows how the base ships are covered (#108) – by the hangar, by an always available
 * ship (#110), only by the buy back, or not at all –, and the groups that may need something list
 * their base ships with the CCUs from them: what the buy back has of each (opened in "Buy Back",
 * #436), and a missing one's page in the Pledge Store. "Consider always available ships" can be
 * switched here as in the settings.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const coverages = useProvidedCcuCoverage();
const alwaysAvailable = useProvidedAlwaysAvailable();
const sources = useProvidedCoverageSources();
const list = computed(() =>
  baseShipList(coverages.value.values(), alwaysAvailable.value, sources.value.ships),
);

const consider = computed(() => props.settings.ccuConsultant.considerAlwaysAvailable);
const setConsider = (value: boolean) =>
  emit('update', {
    ccuConsultant: { ...props.settings.ccuConsultant, considerAlwaysAvailable: value },
  });

const number = computed(() => new Intl.NumberFormat(locale.value));
const format = (value: number) => number.value.format(value);

/** The bar's parts, in its order; none without CCUs of it. */
const STANDINGS: readonly CcuStanding[] = ['hangar', 'always', 'buyback', 'missing'];
const bar = computed(() =>
  STANDINGS.filter((standing) => standing !== 'always' || consider.value).map((standing) => ({
    standing,
    count: list.value.counts[standing],
  })),
);
const barLabel = computed(() =>
  i18n.t('ccuConsultant.barLabel', [
    format(list.value.counts.hangar),
    format(list.value.counts.always),
    format(list.value.counts.buyback),
    format(list.value.counts.missing),
  ]),
);

/** The groups offered: "Base always available" only while those ships are considered. */
const groups = computed(() =>
  BASE_SHIP_GROUPS.filter((group) => group !== 'always' || consider.value),
);
const chosen = ref<BaseShipGroup>();
/** The group shown: the one chosen, else the first one with CCUs (those without base ship first). */
const group = computed(
  (): BaseShipGroup =>
    (chosen.value && groups.value.includes(chosen.value) ? chosen.value : undefined) ??
    groups.value.find((id) => list.value.counts[id] > 0) ??
    'missing',
);
const groupItems = computed(() =>
  groups.value.map((id) => ({
    id,
    label: i18n.t(`ccuConsultant.standing.${id}`),
    count: format(list.value.counts[id]),
  })),
);
const rows = computed(() => list.value.groups[group.value]);

const hint = computed(() => {
  if (group.value === 'missing') {
    return i18n.t(consider.value ? 'ccuConsultant.hint.missing' : 'ccuConsultant.hint.missingAll');
  }
  if (group.value === 'buyback') return i18n.t('ccuConsultant.hint.buyback');
  const source = alwaysAvailable.value?.source.name ?? '';
  const date = listDate(alwaysAvailable.value?.changedAt, locale.value);
  return date
    ? i18n.t('ccuConsultant.hint.always', [source, date])
    : i18n.t('ccuConsultant.hint.alwaysUndated', [source]);
});

const usd = (value: number) =>
  props.settings.hideMeltValue ? HIDDEN : formatUsd(value, locale.value);
const nameOf = (row: BaseShipRow) => row.name ?? i18n.t('ccuConsultant.unknownShip');
const metaOf = (row: BaseShipRow) => {
  const price = row.price !== undefined ? i18n.t('ccuConsultant.price', [usd(row.price)]) : '';
  if (group.value === 'always') return price;
  return [i18n.t('ccuConsultant.notAlways'), price].filter(Boolean).join(' · ');
};
/** The buy back's pledges of a base ship: the first few, all once a row is opened. */
const MATCHES_SHOWN = 3;
const openRows = ref(new Set<string>());
const shownMatches = (row: BaseShipRow) =>
  openRows.value.has(row.key) ? row.matches : row.matches.slice(0, MATCHES_SHOWN);
function toggleRow(row: BaseShipRow) {
  const next = new Set(openRows.value);
  if (!next.delete(row.key)) next.add(row.key);
  openRows.value = next;
}
const idOf = (match: CoverageMatch) =>
  props.settings.hidePledgeIds ? HIDDEN : (match.displayId ?? match.id);
/** A pledge of the buy back, opened in "Buy Back" by its id (#436); Back returns here. */
function openMatch(event: MouseEvent, match: CoverageMatch) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  openPledgeInList('buyback', String(match.displayId ?? match.id));
}
const hrefOf = (match: CoverageMatch) =>
  urlOfView(location.href, { tab: 'buyback', search: String(match.displayId ?? match.id) });
</script>

<template>
  <section class="shm-ccu-consultant" aria-labelledby="shm-ccu-consultant-title">
    <!-- The consultant's name; with several consultants in the tab, tabs instead (#453). -->
    <h3 id="shm-ccu-consultant-title" class="shm-store-title shm-ccu-consultant-title">
      <SvgIcon name="link" />
      {{ i18n.t('ccuConsultant.title') }}
    </h3>
    <div class="shm-ccu-consultant-box">
      <div class="shm-ccu-consultant-head">
        <span class="shm-ccu-consultant-icon"><SvgIcon name="link" /></span>
        <div class="shm-ccu-consultant-head-text">
          <h4 class="shm-ccu-consultant-question">{{ i18n.t('ccuConsultant.question') }}</h4>
          <p class="shm-ccu-consultant-intro">
            {{
              list.total
                ? i18n.n('ccuConsultant.intro', list.total, [format(list.total)])
                : i18n.t('ccuConsultant.noCcus')
            }}
          </p>
        </div>
        <label
          v-tooltip="i18n.t('settings.ccuAlwaysAvailableHint')"
          class="shm-ccu-consultant-option"
        >
          <input
            type="checkbox"
            role="switch"
            class="shm-switch is-small"
            :checked="consider"
            @change="setConsider(($event.target as HTMLInputElement).checked)"
          />
          <span>{{ i18n.t('settings.ccuAlwaysAvailable') }}</span>
        </label>
      </div>

      <template v-if="list.total">
        <!-- How the base ships of all CCUs are covered: the bar and its legend. -->
        <div class="shm-ccu-consultant-coverage">
          <div class="shm-ccu-consultant-bar" role="img" :aria-label="barLabel">
            <span
              v-for="part in bar"
              v-show="part.count"
              :key="part.standing"
              :class="`is-${part.standing}`"
              :style="{ flexGrow: part.count }"
            ></span>
          </div>
          <ul class="shm-ccu-consultant-legend">
            <li v-for="part in bar" :key="part.standing">
              <span class="shm-ccu-consultant-swatch" :class="`is-${part.standing}`"></span>
              {{ i18n.t(`ccuConsultant.standing.${part.standing}`) }}
              <strong>{{ format(part.count) }}</strong>
            </li>
          </ul>
        </div>

        <TabBar
          class="shm-ccu-consultant-groups"
          :items="groupItems"
          :selected="group"
          :label="i18n.t('ccuConsultant.groups')"
          panels="shm-ccu-consultant"
          @select="chosen = $event"
        />
        <div
          :id="`shm-ccu-consultant-panel-${group}`"
          class="shm-ccu-consultant-panel"
          role="tabpanel"
          :aria-labelledby="`shm-ccu-consultant-tab-${group}`"
        >
          <p class="shm-ccu-consultant-hint">{{ hint }}</p>

          <div v-if="!rows.length" class="shm-ccu-consultant-empty" :class="`is-${group}`">
            <template v-if="group === 'missing'">
              <SvgIcon name="circle-check" />
              <span>
                <strong>{{ i18n.t('ccuConsultant.empty.missing') }}</strong>
                {{
                  i18n.t(
                    consider
                      ? 'ccuConsultant.empty.missingText'
                      : 'ccuConsultant.empty.missingTextAll',
                  )
                }}
              </span>
            </template>
            <span v-else>{{ i18n.t(`ccuConsultant.empty.${group}`) }}</span>
          </div>

          <div v-else class="shm-ccu-consultant-table">
            <table class="shm-warbond-table">
              <thead>
                <tr>
                  <th scope="col">{{ i18n.t('ccuConsultant.col.ship') }}</th>
                  <th scope="col" class="is-number">{{ i18n.t('ccuConsultant.col.ccus') }}</th>
                  <th scope="col">
                    {{
                      i18n.t(
                        group === 'missing' ? 'ccuConsultant.col.found' : 'ccuConsultant.col.cover',
                      )
                    }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.key">
                  <td>
                    <span class="shm-ccu-consultant-ship">{{ nameOf(row) }}</span>
                    <span v-if="metaOf(row)" class="shm-ccu-consultant-meta">{{
                      metaOf(row)
                    }}</span>
                  </td>
                  <td class="is-number is-strong">{{ format(row.ccus.length) }}</td>
                  <td>
                    <span class="shm-ccu-consultant-cover" :class="`is-${group}`">
                      <SvgIcon
                        :name="
                          group === 'buyback'
                            ? 'clock-rotate-left'
                            : group === 'always'
                              ? 'basket-shopping'
                              : 'triangle-exclamation'
                        "
                      />
                      {{ i18n.t(`ccuConsultant.cover.${group}`) }}
                    </span>
                    <ul v-if="group === 'buyback'" class="shm-ccu-consultant-matches">
                      <li v-for="match in shownMatches(row)" :key="match.id">
                        <a
                          v-tooltip="i18n.t('ccuConsultant.openBuyback')"
                          :href="hrefOf(match)"
                          @click="openMatch($event, match)"
                          >{{ match.title }}</a
                        >
                        <span class="shm-pledge-id">#{{ idOf(match) }}</span>
                      </li>
                    </ul>
                    <button
                      v-if="group === 'buyback' && row.matches.length > MATCHES_SHOWN"
                      type="button"
                      class="shm-ccu-consultant-more"
                      :aria-expanded="openRows.has(row.key)"
                      @click="toggleRow(row)"
                    >
                      {{
                        openRows.has(row.key)
                          ? i18n.t('ccuConsultant.fewerMatches')
                          : i18n.n(
                              'ccuConsultant.moreMatches',
                              row.matches.length - MATCHES_SHOWN,
                              [format(row.matches.length - MATCHES_SHOWN)],
                            )
                      }}
                    </button>
                    <span v-if="group !== 'buyback'" class="shm-ccu-consultant-meta">
                      {{
                        i18n.t(
                          group === 'always'
                            ? 'ccuConsultant.cover.alwaysSub'
                            : 'ccuConsultant.cover.missingSub',
                        )
                      }}
                    </span>
                    <a
                      v-if="group === 'missing' && row.link"
                      v-tooltip="i18n.t('ccuConsultant.pledgeStoreHint', [nameOf(row)])"
                      class="shm-ccu-consultant-store"
                      :href="rsiUrl(row.link)"
                      target="_blank"
                      rel="noopener"
                    >
                      {{ i18n.t('ccuConsultant.pledgeStore') }}
                      <SvgIcon name="square-up-right" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.shm-ccu-consultant {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.shm-ccu-consultant-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-ccu-consultant-title .shm-icon {
  color: var(--shm-accent);
}

/* The consultant in a box of its own, like the running plan of the Paint Discount Consultant. */
.shm-ccu-consultant-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0 0;
  overflow: hidden;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.25);
  border-radius: var(--shm-radius-cell);
}

/* Everything but the table keeps the box's inner margin; the table's rows reach its edges. */
.shm-ccu-consultant-box > :not(.shm-ccu-consultant-panel),
.shm-ccu-consultant-panel > :not(.shm-ccu-consultant-table) {
  margin-right: 16px;
  margin-left: 16px;
}

.shm-ccu-consultant-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 14px;
}

.shm-ccu-consultant-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--shm-accent);
  background: rgb(var(--shm-accent-rgb) / 0.16);
}

.shm-ccu-consultant-head-text {
  flex: 1 1 260px;
  min-width: 0;
}

.shm-ccu-consultant-question {
  margin: 0;
  color: var(--shm-text-strong);
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-ccu-consultant-intro {
  margin: 2px 0 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-consultant-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  cursor: pointer;
}

.shm-ccu-consultant-coverage {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shm-ccu-consultant-bar {
  display: flex;
  gap: 2px;
  height: 10px;
  overflow: hidden;
  background: rgb(var(--shm-accent-rgb) / 0.08);
}

.shm-ccu-consultant-bar > span {
  flex-basis: 0;
  min-width: 3px;
}

.shm-ccu-consultant-bar .is-hangar,
.shm-ccu-consultant-swatch.is-hangar {
  background: var(--shm-success);
}

.shm-ccu-consultant-bar .is-always,
.shm-ccu-consultant-swatch.is-always {
  background: var(--shm-accent);
}

.shm-ccu-consultant-bar .is-buyback,
.shm-ccu-consultant-swatch.is-buyback {
  background: var(--shm-warning);
}

.shm-ccu-consultant-bar .is-missing,
.shm-ccu-consultant-swatch.is-missing {
  background: var(--shm-danger);
}

.shm-ccu-consultant-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
  list-style: none;
}

.shm-ccu-consultant-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shm-ccu-consultant-legend strong {
  color: var(--shm-text-strong);
}

.shm-ccu-consultant-legend strong {
  font-weight: 600;
}

.shm-ccu-consultant-swatch {
  width: 8px;
  height: 8px;
}

.shm-ccu-consultant-hint {
  margin: 4px 0 8px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-consultant-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  color: var(--shm-text-muted);
  background: rgb(var(--shm-accent-rgb) / 0.06);
}

.shm-ccu-consultant-empty.is-missing {
  color: var(--shm-text);
  background: rgb(var(--shm-success-rgb) / 0.08);
}

.shm-ccu-consultant-empty.is-missing .shm-icon {
  flex: none;
  color: var(--shm-success);
}

.shm-ccu-consultant-empty strong {
  display: block;
  color: var(--shm-text-strong);
}

/* Wide tables scroll in their box instead of the page. */
.shm-ccu-consultant-table {
  overflow-x: auto;
}

.shm-ccu-consultant-ship {
  display: block;
  color: var(--shm-text-strong);
}

.shm-ccu-consultant-meta {
  display: block;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ccu-consultant-cover {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shm-ccu-consultant-cover.is-buyback {
  color: var(--shm-warning);
}

.shm-ccu-consultant-cover.is-always {
  color: var(--shm-accent);
}

.shm-ccu-consultant-cover.is-missing {
  color: var(--shm-danger);
}

.shm-ccu-consultant-matches {
  margin: 2px 0 0;
  padding: 0;
  font-size: calc(12px * var(--shm-font-scale));
  list-style: none;
}

.shm-ccu-consultant-matches a {
  color: var(--shm-text);
  text-decoration: none;
}

.shm-ccu-consultant-matches a:hover,
.shm-ccu-consultant-matches a:focus-visible {
  color: var(--shm-accent);
  text-decoration: underline;
}

.shm-ccu-consultant-matches .shm-pledge-id {
  margin-left: 6px;
  color: var(--shm-text-muted);
}

.shm-ccu-consultant-more {
  margin: 2px 0 0;
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  font-size: calc(12px * var(--shm-font-scale));
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-ccu-consultant-more:hover,
.shm-ccu-consultant-more:focus-visible {
  text-decoration: underline;
  outline: none;
}

.shm-ccu-consultant-store {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
}

/* The group tabs follow the legend closely, as one block of the box. */
.shm-ccu-consultant-box .shm-ccu-consultant-groups {
  margin-top: 4px;
}

/* The table's outer cells keep the box's inner margin. */
.shm-ccu-consultant-table th:first-child,
.shm-ccu-consultant-table td:first-child {
  padding-left: 16px;
}

.shm-ccu-consultant-table th:last-child,
.shm-ccu-consultant-table td:last-child {
  padding-right: 16px;
}

.shm-ccu-consultant-panel > :last-child {
  margin-bottom: 16px;
}

.shm-ccu-consultant-panel > .shm-ccu-consultant-table:last-child {
  margin-bottom: 4px;
}

.shm-theme-modern .shm-ccu-consultant-box {
  background: var(--shm-surface-elevated);
  border-color: transparent;
  box-shadow: inset 0 0 0 1px var(--shm-fill);
}

.shm-theme-modern .shm-ccu-consultant-icon {
  border-radius: var(--shm-radius-control);
}

.shm-theme-modern .shm-ccu-consultant-bar {
  border-radius: 5px;
}

.shm-theme-modern .shm-ccu-consultant-swatch {
  border-radius: 2px;
}

.shm-theme-modern .shm-ccu-consultant-empty {
  border-radius: var(--shm-radius-small);
}
</style>
