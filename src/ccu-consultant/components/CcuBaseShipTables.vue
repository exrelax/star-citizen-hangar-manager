<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { groupItems as groupCcus, pledgeFacts } from '@/hangar/grouping';
import { openPledgeInList, urlOfView } from '@/hangar/list-jump';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { HIDDEN } from '@/orders/orders';
import { formatExpectedTime } from '@/price-increases/price-increase-label';
import type { Settings } from '@/settings/settings';
import { rsiUrl } from '@/shared/rsi-api';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { limitedSaleNote } from '@/ship-removals/removal-availability';
import { removalLabel } from '@/ship-removals/removal-label';
import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import ShipUpgradeButtons from '@/store/components/ShipUpgradeButtons.vue';
import { openShipRemoval } from '@/store/open-current-warbonds';
import { computed, ref } from 'vue';
import type { BaseShipGroup, BaseShipList, BaseShipRow } from '../base-ship-list';
import type { CoverageMatch } from '../coverage';
import ConsultantCcuList from './ConsultantCcuList.vue';

/*
 * The base ships of a group of the CCU Consultant as tables (#113, #454, #456): each base ship with
 * the CCUs from it (opened below its row, as a grouped list), what covers it, and in the group
 * "Without base ship" the base ships with too few ways to them. The "Deep view" of the toggle for
 * now (#563), until the chains to each base ship replace it.
 */

const props = defineProps<{
  settings: Settings;
  list: BaseShipList;
  group: BaseShipGroup;
  /** The shown hangar, for the CCUs of a base ship. */
  pledges?: readonly PledgeView[];
  /** The standard SKU of a base ship on sale, for RSI's ship upgrade dialog. */
  skuOf: (row: BaseShipRow) => number | undefined;
}>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const removals = useProvidedRemovalCcus();
const number = computed(() => new Intl.NumberFormat(locale.value));
const format = (value: number) => number.value.format(value);
const usd = (value: number) =>
  props.settings.hideMeltValue ? HIDDEN : formatUsd(value, locale.value);

const rows = computed(() => props.list.groups[props.group]);
/** The sections below the CCUs without base ship, in the tab "Without base ship". */
const shortSections = computed(() =>
  props.group === 'missing'
    ? [
        { id: 'soon' as const, rows: props.list.soon, count: props.list.soonCount },
        { id: 'tooFew' as const, rows: props.list.tooFew, count: props.list.tooFewCount },
      ].filter((section) => section.rows.length)
    : [],
);

/** The CCUs from a base ship, opened below its row (#456), by `<section>:<row key>`. */
const openCcus = ref(new Set<string>());
function toggleCcus(key: string) {
  const next = new Set(openCcus.value);
  if (!next.delete(key)) next.add(key);
  openCcus.value = next;
}
const pledgesById = computed(
  () => new Map((props.pledges ?? []).map((pledge) => [pledge.id, pledge])),
);
const ccusOf = (row: BaseShipRow) => row.ccus.flatMap((id) => pledgesById.value.get(id) ?? []);
/** "Show the 28 CCUs · 5 different": how many kinds of CCUs the grouped list has. */
const showCcusText = (row: BaseShipRow) => {
  const count = row.ccus.length;
  const kinds = groupCcus(ccusOf(row), pledgeFacts).length;
  const show = i18n.n('ccuConsultant.showCcus', count, [format(count)]);
  return kinds > 1 && kinds < count
    ? `${show} · ${i18n.t('ccuConsultant.ccuKinds', [format(kinds)])}`
    : show;
};
const setGrouped = (consultant: boolean) =>
  emit('update', { grouped: { ...props.settings.grouped, consultant } });

/** The ships and CCUs that give a leaving base ship (#454). */
const waysOf = (row: BaseShipRow) => (row.ways ? row.ways.hangar + row.ways.buyback : 0);

const nameOf = (row: BaseShipRow) => row.name ?? i18n.t('ccuConsultant.unknownShip');
const metaOf = (row: BaseShipRow) => {
  const price = row.price !== undefined ? i18n.t('ccuConsultant.price', [usd(row.price)]) : '';
  if (props.group === 'always') return price;
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
/**
 * "Soon without base ship" (#454): when each base ship leaves the Pledge Store, as the Ship
 * Removals show it (#288), and RSI's ship upgrade dialog with it as target (#391).
 */
const now = useCountdownNow(() => props.list.soon.flatMap((row) => row.removal?.removedAt ?? []));
const removalLabelOf = (row: BaseShipRow) =>
  row.removal ? removalLabel(row.removal, now.value, locale.value) : undefined;
const limitedOf = (row: BaseShipRow) =>
  row.removal ? limitedSaleNote([row.removal], removals.value.limited, locale.value) : undefined;
const soonMetaOf = (row: BaseShipRow) => {
  const price = row.price !== undefined ? i18n.t('ccuConsultant.price', [usd(row.price)]) : '';
  const until = row.removal
    ? i18n.t('ccuConsultant.soon.until', [formatExpectedTime(row.removal.removedAt, locale.value)])
    : i18n.t('ccuConsultant.notAlways');
  return [until, price].filter(Boolean).join(' · ');
};
</script>

<template>
  <div class="shm-ccu-consultant-view">
    <!-- The CCUs of each base ship as groups (#456), like the toggle of the lists. -->
    <div v-if="rows.length || shortSections.length" class="shm-ccu-consultant-view-bar">
      <button
        v-tooltip="i18n.t('ccuConsultant.groupHint')"
        type="button"
        class="shm-ccu-consultant-group-toggle"
        :aria-pressed="settings.grouped.consultant"
        @click="setGrouped(!settings.grouped.consultant)"
      >
        <SvgIcon name="layer-group" />
        {{ i18n.t('manager.group') }}
      </button>
    </div>

    <div v-if="rows.length" class="shm-ccu-consultant-table">
      <table class="shm-warbond-table">
        <thead>
          <tr>
            <th scope="col">{{ i18n.t('ccuConsultant.col.ship') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('ccuConsultant.col.ccus') }}</th>
            <th scope="col">
              {{
                i18n.t(group === 'missing' ? 'ccuConsultant.col.found' : 'ccuConsultant.col.cover')
              }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in rows" :key="row.key">
            <tr>
              <td>
                <span class="shm-ccu-consultant-ship">{{ nameOf(row) }}</span>
                <span v-if="metaOf(row)" class="shm-ccu-consultant-meta">{{ metaOf(row) }}</span>
                <button
                  type="button"
                  class="shm-ccu-consultant-more shm-ccu-consultant-ccus-toggle"
                  :aria-expanded="openCcus.has(`${group}:${row.key}`)"
                  @click="toggleCcus(`${group}:${row.key}`)"
                >
                  {{
                    openCcus.has(`${group}:${row.key}`)
                      ? i18n.t('ccuConsultant.hideCcus')
                      : showCcusText(row)
                  }}
                </button>
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
                      : i18n.n('ccuConsultant.moreMatches', row.matches.length - MATCHES_SHOWN, [
                          format(row.matches.length - MATCHES_SHOWN),
                        ])
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
            <tr v-if="openCcus.has(`${group}:${row.key}`)" class="shm-ccu-consultant-ccus-row">
              <td colspan="3">
                <ConsultantCcuList
                  :ccus="ccusOf(row)"
                  :grouped="settings.grouped.consultant"
                  :hide-values="settings.hideMeltValue"
                  :hide-ids="settings.hidePledgeIds"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!--
      Base ships with fewer ways to them than CCUs from them (#454): leaving the Pledge Store
      ("Soon without base ship"), and not always available ("Too few ways").
    -->
    <template v-for="section in shortSections" :key="section.id">
      <h5 :id="`shm-ccu-consultant-${section.id}`" class="shm-ccu-consultant-soon-title">
        {{ i18n.t(`ccuConsultant.${section.id}.title`) }}
        <span class="shm-ccu-consultant-soon-count">{{ format(section.count) }}</span>
      </h5>
      <p class="shm-ccu-consultant-hint">{{ i18n.t(`ccuConsultant.${section.id}.hint`) }}</p>
      <div class="shm-ccu-consultant-table">
        <table class="shm-warbond-table" :aria-labelledby="`shm-ccu-consultant-${section.id}`">
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('ccuConsultant.col.ship') }}</th>
              <th scope="col" class="is-number">{{ i18n.t('ccuConsultant.col.ccus') }}</th>
              <th scope="col">{{ i18n.t('ccuConsultant.col.ways') }}</th>
              <th scope="col">
                {{
                  i18n.t(
                    section.id === 'soon' ? 'ccuConsultant.col.leaves' : 'ccuConsultant.col.store',
                  )
                }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in section.rows" :key="row.key">
              <tr>
                <td>
                  <span class="shm-ccu-consultant-ship">{{ nameOf(row) }}</span>
                  <span class="shm-ccu-consultant-meta">{{ soonMetaOf(row) }}</span>
                  <span v-if="limitedOf(row)" class="shm-ccu-consultant-meta">
                    {{ limitedOf(row) }}
                  </span>
                  <button
                    type="button"
                    class="shm-ccu-consultant-more shm-ccu-consultant-ccus-toggle"
                    :aria-expanded="openCcus.has(`${section.id}:${row.key}`)"
                    @click="toggleCcus(`${section.id}:${row.key}`)"
                  >
                    {{
                      openCcus.has(`${section.id}:${row.key}`)
                        ? i18n.t('ccuConsultant.hideCcus')
                        : showCcusText(row)
                    }}
                  </button>
                </td>
                <td class="is-number is-strong">{{ format(row.ccus.length) }}</td>
                <td>
                  <span class="shm-ccu-consultant-ways">{{ format(waysOf(row)) }}</span>
                  <span v-if="waysOf(row)" class="shm-ccu-consultant-meta">
                    {{
                      i18n.t('ccuConsultant.soon.ways', [
                        format(row.ways?.hangar ?? 0),
                        format(row.ways?.buyback ?? 0),
                      ])
                    }}
                  </span>
                  <span class="shm-ccu-consultant-cover is-missing is-short">
                    <SvgIcon name="triangle-exclamation" />
                    {{
                      i18n.n('ccuConsultant.soon.short', row.short ?? 0, [format(row.short ?? 0)])
                    }}
                  </span>
                </td>
                <td>
                  <div class="shm-ccu-consultant-leaves">
                    <span
                      v-if="row.removal"
                      v-tooltip="removalLabelOf(row)?.hint"
                      class="shm-badge is-price-increase is-warning"
                      tabindex="0"
                    >
                      {{ removalLabelOf(row)?.text }}
                    </span>
                    <ShipUpgradeButtons
                      v-if="row.shipId !== undefined && skuOf(row) !== undefined"
                      :ship-id="row.shipId"
                      :ship-name="nameOf(row)"
                      :sku-id="skuOf(row)"
                    />
                    <span v-else-if="!row.removal" class="shm-ccu-consultant-meta">
                      {{ i18n.t('ccuConsultant.tooFew.notOnSale') }}
                    </span>
                  </div>
                  <button
                    v-if="row.removal && row.shipId !== undefined"
                    v-tooltip="i18n.t('shipRemovals.showShipHint', [nameOf(row)])"
                    type="button"
                    class="shm-ccu-consultant-more shm-ccu-consultant-removal-link"
                    @click="openShipRemoval(row.shipId)"
                  >
                    {{ i18n.t('notifications.showInStore') }}
                  </button>
                  <a
                    v-else-if="row.link"
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
              <tr
                v-if="openCcus.has(`${section.id}:${row.key}`)"
                class="shm-ccu-consultant-ccus-row"
              >
                <td colspan="4">
                  <ConsultantCcuList
                    :ccus="ccusOf(row)"
                    :grouped="settings.grouped.consultant"
                    :hide-values="settings.hideMeltValue"
                    :hide-ids="settings.hidePledgeIds"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
