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
  type BaseShipGroup,
  type BaseShipRow,
  type CcuStanding,
} from '../base-ship-list';
import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { openCcuAdvice } from '@/price-increases/ccu-advice-request';
import CcuShips from '@/price-increases/components/CcuShips.vue';
import ConsultantCcuList from './ConsultantCcuList.vue';
import { groupItems as groupCcus, pledgeFacts } from '@/hangar/grouping';
import { countdown, formatExpectedTime } from '@/price-increases/price-increase-label';
import { useCcuAdvice } from '@/price-increases/use-ccu-advice';
import { useNow } from '@/shared/use-now';
import { limitedSaleNote } from '@/ship-removals/removal-availability';
import { removalLabel } from '@/ship-removals/removal-label';
import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import { standardSku } from '@/ships/ships';
import { buyableShipsItem, current, warbondsItem } from '@/ships/ships-storage';
import { useCountdownNow } from '@/shared/use-countdown-now';
import { useStored } from '@/storage/use-stored';
import ShipUpgradeButtons from '@/store/components/ShipUpgradeButtons.vue';
import { openCcusToSecure, openShipRemoval } from '@/store/open-current-warbonds';
import { discountAtRisk, type AtRiskRow } from '../discount-at-risk';
import { missingCounts, useBaseShipList } from '../use-base-ship-list';
import type { CoverageMatch } from '../coverage';

/*
 * The CCU Consultant in the tab "Consultants" (#113): whether every CCU of the hangar can be
 * applied. A bar shows how the base ships are covered (#108) – by the hangar, by an always available
 * ship (#110), only by the buy back, or not at all –, and the groups that may need something list
 * their base ships with the CCUs from them: what the buy back has of each (opened in "Buy Back",
 * #436), and a missing one's page in the Pledge Store. "Consider always available ships" can be
 * switched here as in the settings. Below the CCUs without base ship, "Soon without base ship"
 * (#454) lists those whose base ship can still be had, but leaves the Pledge Store.
 */

const props = defineProps<{
  settings: Settings;
  /** The shown hangar and buy back, for the tab "Discount at risk" (#455). */
  pledges?: readonly PledgeView[];
  buyback?: readonly BuybackView[];
}>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const alwaysAvailable = useProvidedAlwaysAvailable();
const removals = useProvidedRemovalCcus();
const list = useBaseShipList();

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
const chosen = ref<BaseShipGroup>();
/**
 * The CCUs of each group's tab. "Without base ship" also counts the CCUs that will be short of a
 * way to a leaving base ship (#454) though covered today; those without any way are among its own.
 */
const tabCount = (id: BaseShipGroup) =>
  id === 'missing' ? missingCounts(list.value).total : list.value.counts[id];
/** The sections below the CCUs without base ship, in the tab "Without base ship". */
const shortSections = computed(() =>
  group.value === 'missing'
    ? [
        { id: 'soon' as const, rows: list.value.soon, count: list.value.soonCount },
        { id: 'tooFew' as const, rows: list.value.tooFew, count: list.value.tooFewCount },
      ].filter((section) => section.rows.length)
    : [],
);
/** The group shown: the one chosen, else the first one with CCUs (those without base ship first). */
const group = computed(
  (): BaseShipGroup =>
    (chosen.value && groups.value.includes(chosen.value) ? chosen.value : undefined) ??
    groups.value.find((id) => tabCount(id) > 0) ??
    'missing',
);
const groupItems = computed(() =>
  groups.value.map((id) => ({
    id,
    label: i18n.t(`ccuConsultant.tab.${id}`),
    count: format(tabCount(id)),
  })),
);
const rows = computed(() => list.value.groups[group.value]);

/** The tab "Discount at risk" (#455): after the tabs of the base ship coverage, not in the bar. */
const atRiskChosen = ref(false);
const { groups: adviceGroups, storeCredit } = useCcuAdvice(
  () => props.pledges ?? [],
  () => props.buyback ?? [],
);
const clock = useNow();
const atRisk = computed(() =>
  discountAtRisk(adviceGroups.value ?? [], clock.value, props.settings.priceIncreaseDays),
);
const atRiskSections = computed(() =>
  [
    {
      id: 'confirmed' as const,
      rows: atRisk.value.confirmed,
      count: atRisk.value.confirmed.reduce((sum, row) => sum + row.group.ccus.length, 0),
    },
    {
      id: 'expected' as const,
      rows: atRisk.value.expected,
      count: atRisk.value.expected.reduce((sum, row) => sum + row.group.ccus.length, 0),
    },
  ].filter((section) => section.rows.length),
);
const tabItems = computed(() => [
  ...groupItems.value,
  {
    id: 'atRisk' as const,
    label: i18n.t('ccuConsultant.tab.atRisk'),
    count: format(atRisk.value.count),
  },
]);
function selectTab(id: BaseShipGroup | 'atRisk') {
  atRiskChosen.value = id === 'atRisk';
  if (id !== 'atRisk') chosen.value = id;
}
const baseName = (row: AtRiskRow) => row.group.base?.name ?? row.group.increase.ship.name;
/** "−$145" for a negative amount, else "$620". */
const money = (value: number) =>
  props.settings.hideMeltValue
    ? HIDDEN
    : `${value < 0 ? '−' : ''}${formatUsd(Math.abs(value), locale.value)}`;
const increaseText = (row: AtRiskRow) => {
  const { increase } = row.group;
  const when = formatExpectedTime(increase.priceIncreaseAt, locale.value);
  const price = increase.price
    ? i18n.t('ccuAdvice.eventPrice', [
        baseName(row),
        usd(increase.price.from),
        usd(increase.price.to),
      ])
    : i18n.t('ccuAdvice.eventUnknown', [baseName(row)]);
  return `${price} · ${i18n.t(
    increase.confirmed ? 'ccuAdvice.eventWhenConfirmed' : 'ccuAdvice.eventWhen',
    [when],
  )}`;
};
/** What the Price Increase Advisor recommends, in short (#252). */
const adviceText = (row: AtRiskRow) => {
  const { group } = row;
  if (group.switch) {
    const plan = group.switch;
    return i18n.t('ccuConsultant.atRisk.swap', [
      format(group.ccus.length),
      plan.from.name,
      plan.to.name,
      usd(plan.total),
      formatExpectedTime(group.increase.priceIncreaseAt, locale.value),
    ]);
  }
  if (group.noSwitch === 'notSold') return i18n.t('ccuAdvice.notSold', [baseName(row)]);
  if (group.noSwitch === 'keepIsBetter') return i18n.t('ccuAdvice.keepIsBetter', [baseName(row)]);
  return i18n.t('ccuAdvice.riseUnknown', [
    baseName(row),
    formatExpectedTime(group.increase.priceIncreaseAt, locale.value),
  ]);
};
const creditText = (row: AtRiskRow) => {
  const plan = row.group.switch;
  if (!plan) return undefined;
  if (!plan.storeCreditNeeded) return i18n.t('ccuAdvice.creditCovered');
  return storeCredit.value === undefined || props.settings.hideMeltValue
    ? i18n.t('ccuAdvice.creditNeeded', [usd(plan.storeCreditNeeded)])
    : i18n.t('ccuAdvice.creditNeededHave', [usd(plan.storeCreditNeeded), usd(storeCredit.value)]);
};
const giftableText = (row: AtRiskRow) => {
  const { giftable, ccus } = row.group;
  if (ccus.length === 1) return i18n.t('ccuAdvice.giftableSingle');
  if (giftable === ccus.length) return i18n.t('ccuAdvice.giftableAll', [format(giftable)]);
  return i18n.n('ccuAdvice.giftable', giftable, [format(giftable), format(ccus.length)]);
};

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
/**
 * "Soon without base ship" (#454): when each base ship leaves the Pledge Store, as the Ship
 * Removals show it (#288), and RSI's ship upgrade dialog with it as target (#391).
 */
const now = useCountdownNow(() => list.value.soon.flatMap((row) => row.removal?.removedAt ?? []));
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
const storedBuyable = useStored(buyableShipsItem);
const storedWarbonds = useStored(warbondsItem);
/** The ship's standard SKU, not a warbond one, as in the Pledge Store tab. */
const skuOf = (row: BaseShipRow) =>
  row.shipId !== undefined
    ? standardSku(
        {
          buyable: current(storedBuyable.value ?? null)?.skus ?? [],
          warbonds: current(storedWarbonds.value ?? null)?.warbonds ?? [],
        },
        row.shipId,
      )?.skuId
    : undefined;
const hrefOf = (match: CoverageMatch) =>
  urlOfView(location.href, { tab: 'buyback', search: String(match.displayId ?? match.id) });
</script>

<template>
  <!-- Its name is the sub tab or the heading of the tab "Consultants" (#453). -->
  <section class="shm-ccu-consultant" :aria-label="i18n.t('ccuConsultant.title')">
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
          fit-content
          :items="tabItems"
          :selected="atRiskChosen ? 'atRisk' : group"
          :label="i18n.t('ccuConsultant.groups')"
          panels="shm-ccu-consultant"
          @select="selectTab"
        />
        <!-- CCUs whose base ship rises in price (#455), with the Price Increase Advisor's advice. -->
        <div
          v-if="atRiskChosen"
          id="shm-ccu-consultant-panel-atRisk"
          class="shm-ccu-consultant-panel"
          role="tabpanel"
          aria-labelledby="shm-ccu-consultant-tab-atRisk"
        >
          <p class="shm-ccu-consultant-hint">
            {{
              i18n.n('ccuConsultant.atRisk.hint', settings.priceIncreaseDays, [
                format(settings.priceIncreaseDays),
              ])
            }}
          </p>
          <div v-if="!atRisk.count" class="shm-ccu-consultant-empty is-missing">
            <SvgIcon name="circle-check" />
            <span>
              <strong>{{ i18n.t('ccuConsultant.atRisk.empty') }}</strong>
              {{
                i18n.n('ccuConsultant.atRisk.emptyText', settings.priceIncreaseDays, [
                  format(settings.priceIncreaseDays),
                ])
              }}
            </span>
          </div>
          <template v-for="section in atRiskSections" :key="section.id">
            <h5
              :id="`shm-ccu-consultant-atRisk-${section.id}`"
              class="shm-ccu-consultant-soon-title"
            >
              {{ i18n.t(`ccuConsultant.atRisk.${section.id}`) }}
              <span class="shm-ccu-consultant-soon-count">{{ format(section.count) }}</span>
            </h5>
            <div class="shm-ccu-consultant-table">
              <table
                class="shm-warbond-table"
                :aria-labelledby="`shm-ccu-consultant-atRisk-${section.id}`"
              >
                <thead>
                  <tr>
                    <th scope="col">{{ i18n.t('ccuAdvice.colCcu') }}</th>
                    <th scope="col">{{ i18n.t('ccuConsultant.atRisk.colIncrease') }}</th>
                    <th scope="col">{{ i18n.t('ccuConsultant.atRisk.colDiscount') }}</th>
                    <th scope="col">{{ i18n.t('ccuAdvice.howTitle') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in section.rows"
                    :key="`${row.group.increase.ship.id}>${row.group.target.id}`"
                  >
                    <td>
                      <span class="shm-ccu-consultant-atrisk-ccu">
                        <CcuShips :from="row.group.base" :to="row.group.target" />
                        <span>
                          <span class="shm-ccu-consultant-ship">
                            {{
                              i18n.t('ccuAdvice.ccuName', [baseName(row), row.group.target.name])
                            }}
                          </span>
                          <span class="shm-ccu-consultant-meta">
                            {{
                              i18n.n('ccuConsultant.atRisk.ccus', row.group.ccus.length, [
                                format(row.group.ccus.length),
                                usd(row.group.meltValue),
                              ])
                            }}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span
                        v-tooltip="formatExpectedTime(row.group.increase.priceIncreaseAt, locale)"
                        class="shm-badge is-price-increase is-warning"
                        tabindex="0"
                      >
                        {{ countdown(row.group.increase.priceIncreaseAt, clock, locale) }}
                      </span>
                      <span class="shm-ccu-consultant-meta">{{ increaseText(row) }}</span>
                      <a
                        v-if="row.group.increase.source"
                        class="shm-ccu-consultant-store"
                        :href="row.group.increase.source"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ i18n.t('priceIncrease.source') }}
                        <SvgIcon name="square-up-right" />
                      </a>
                    </td>
                    <td>
                      <template v-if="row.group.keep">
                        <span class="shm-ccu-consultant-meta">
                          {{
                            i18n.t('ccuConsultant.atRisk.discount', [
                              money(row.group.keep.discountNow),
                              money(row.group.keep.discountAfter),
                            ])
                          }}
                        </span>
                        <span class="shm-ccu-consultant-cover is-missing is-short">
                          <SvgIcon name="triangle-exclamation" />
                          {{ i18n.t('ccuConsultant.atRisk.loss', [usd(row.loss ?? 0)]) }}
                        </span>
                      </template>
                      <template v-else>
                        <span
                          v-if="row.group.discountNow !== undefined"
                          class="shm-ccu-consultant-meta"
                        >
                          {{
                            i18n.t('ccuConsultant.atRisk.discountNow', [
                              money(row.group.discountNow),
                            ])
                          }}
                        </span>
                        <span class="shm-ccu-consultant-cover is-buyback">
                          {{ i18n.t('ccuAdvice.mayBeLost') }}
                        </span>
                      </template>
                    </td>
                    <td>
                      <span class="shm-ccu-consultant-advice">{{ adviceText(row) }}</span>
                      <span v-if="creditText(row)" class="shm-ccu-consultant-meta">{{
                        creditText(row)
                      }}</span>
                      <span v-if="row.group.giftable" class="shm-ccu-consultant-meta">
                        {{ giftableText(row) }}
                      </span>
                      <span class="shm-ccu-consultant-actions">
                        <button
                          v-tooltip="i18n.t('ccuAdvice.buttonHint')"
                          type="button"
                          class="shm-ccu-consultant-more"
                          @click="openCcuAdvice(row.group.ccus[0]!.id)"
                        >
                          {{ i18n.t('ccuAdvice.button') }}
                        </button>
                        <button
                          v-if="row.group.switch"
                          v-tooltip="i18n.t('ccuConsultant.atRisk.secureHint')"
                          type="button"
                          class="shm-ccu-consultant-more"
                          @click="openCcusToSecure()"
                        >
                          {{ i18n.t('ccuConsultant.atRisk.secure') }}
                        </button>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
        <div
          v-else
          :id="`shm-ccu-consultant-panel-${group}`"
          class="shm-ccu-consultant-panel"
          role="tabpanel"
          :aria-labelledby="`shm-ccu-consultant-tab-${group}`"
        >
          <div class="shm-ccu-consultant-panel-head">
            <p class="shm-ccu-consultant-hint">{{ hint }}</p>
            <!-- The CCUs of each base ship as groups (#456), like the toggle of the lists. -->
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
                <template v-for="row in rows" :key="row.key">
                  <tr>
                    <td>
                      <span class="shm-ccu-consultant-ship">{{ nameOf(row) }}</span>
                      <span v-if="metaOf(row)" class="shm-ccu-consultant-meta">{{
                        metaOf(row)
                      }}</span>
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
                  <tr
                    v-if="openCcus.has(`${group}:${row.key}`)"
                    class="shm-ccu-consultant-ccus-row"
                  >
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
              <table
                class="shm-warbond-table"
                :aria-labelledby="`shm-ccu-consultant-${section.id}`"
              >
                <thead>
                  <tr>
                    <th scope="col">{{ i18n.t('ccuConsultant.col.ship') }}</th>
                    <th scope="col" class="is-number">{{ i18n.t('ccuConsultant.col.ccus') }}</th>
                    <th scope="col">{{ i18n.t('ccuConsultant.col.ways') }}</th>
                    <th scope="col">
                      {{
                        i18n.t(
                          section.id === 'soon'
                            ? 'ccuConsultant.col.leaves'
                            : 'ccuConsultant.col.store',
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
                            i18n.n('ccuConsultant.soon.short', row.short ?? 0, [
                              format(row.short ?? 0),
                            ])
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
    </div>
  </section>
</template>

<style scoped>
.shm-ccu-consultant {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
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

/* The hint and, on its right, the toggle of the grouped view (#456), as above the lists. */
.shm-ccu-consultant-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.shm-ccu-consultant-panel-head .shm-ccu-consultant-hint {
  flex: 1;
}

.shm-ccu-consultant-group-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 2px 0;
  color: var(--shm-text-muted);
  font: inherit;
  font-size: calc(12px * var(--shm-font-scale));
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-ccu-consultant-group-toggle:hover,
.shm-ccu-consultant-group-toggle:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-ccu-consultant-group-toggle[aria-pressed='true'] {
  color: var(--shm-accent);
}

.shm-ccu-consultant-ccus-toggle {
  display: block;
}

/* The CCUs of an opened base ship (#456): below its row, indented like the coverage section. */
.shm-ccu-consultant-ccus-row td {
  padding-top: 0;
  padding-bottom: 12px;
  padding-left: 28px !important;
}

/* "Discount at risk" (#455): the CCU's two ships next to its name, the advice's buttons in a row. */
.shm-ccu-consultant-atrisk-ccu {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shm-ccu-consultant-advice {
  display: block;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
}

.shm-ccu-consultant-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin-top: 4px;
}

.shm-ccu-consultant-actions .shm-ccu-consultant-more {
  margin: 0;
}

/* "Soon without base ship" (#454): set apart from the table above. */
.shm-ccu-consultant-cover.is-short {
  white-space: nowrap;
}

.shm-ccu-consultant-ways {
  display: block;
  color: var(--shm-text-strong);
  font-variant-numeric: tabular-nums;
}

.shm-ccu-consultant-soon-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 20px;
  margin-bottom: 0;
  color: var(--shm-text-strong);
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-ccu-consultant-soon-count {
  color: var(--shm-text-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.shm-ccu-consultant-leaves {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.shm-ccu-consultant-removal-link {
  margin-top: 4px;
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
