<script setup lang="ts">
import type { BuybackView } from '@/buyback/buyback-view';
import { openListShortcut } from '@/hangar/list-shortcut';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useCcuAdvice } from '@/price-increases/use-ccu-advice';
import type { CcuConsultantView, Settings } from '@/settings/settings';
import SegmentedControl from '@/shared/components/SegmentedControl.vue';
import TabBar from '@/shared/components/TabBar.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useNow } from '@/shared/use-now';
import { standardSku } from '@/ships/ships';
import { buyableShipsItem, current, warbondsItem } from '@/ships/ships-storage';
import { useStored } from '@/storage/use-stored';
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
import { ccuGroupShortcut, type ConsultantGroup } from '../consultant-shortcuts';
import { deepCcuIds, deepShips } from '../deep-view';
import { discountAtRisk } from '../discount-at-risk';
import { groupCcuIds } from '../ship-cards';
import { missingCounts, useBaseShipList, useChainCoverage } from '../use-base-ship-list';
import CcuAtRisk from './CcuAtRisk.vue';
import CcuDeepView from './CcuDeepView.vue';
import CcuShipCards from './CcuShipCards.vue';

/*
 * The CCU Consultant in the tab "Consultants" (#113): whether every CCU of the hangar can be
 * applied. Its header (#563) is the same in both views: the question, "Consider always available
 * ships" (as in the settings), a bar of how the base ships are covered (#108) – by the hangar, by
 * an always available ship (#110), only by the buy back, or not at all –, and the groups as tabs,
 * with "Discount at risk" (#455) last. Below them the chosen group's heading with its count and
 * hint, "Show N CCUs in My Hangar" (a List Shortcut, #428) and the toggle "Simple | Deep view",
 * remembered in the settings. The views show the group's base ships:
 * - Simple (`CcuShipCards`): a card per base ship; in "Without base ship" the base ships soon
 *   without one and with too few ways to them (#454) follow the group's own;
 * - Deep (`CcuDeepView`): a row per base ship with the chains followed (`chain-coverage.ts`) and
 *   what securing the missing CCUs costs now. Its first group is "Too few ways": every base ship
 *   with fewer ways than CCUs from it by the chain rule – also those without any, those leaving the
 *   Pledge Store, and those only the chain rule finds.
 * "Discount at risk" looks the same in both (`CcuAtRisk`).
 */

const props = defineProps<{
  settings: Settings;
  /** The shown hangar and buy back, for the tab "Discount at risk" (#455). */
  pledges?: readonly PledgeView[];
  buyback?: readonly BuybackView[];
}>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const alwaysAvailable = useProvidedAlwaysAvailable();
const list = useBaseShipList();
const chains = useChainCoverage();

const consider = computed(() => props.settings.ccuConsultant.considerAlwaysAvailable);
const setConsider = (value: boolean) =>
  emit('update', {
    ccuConsultant: { ...props.settings.ccuConsultant, considerAlwaysAvailable: value },
  });

/** The view of the toggle "Simple | Deep view", remembered in the settings. */
const view = computed(() => props.settings.ccuConsultant.view);
const setView = (value: CcuConsultantView) =>
  emit('update', { ccuConsultant: { ...props.settings.ccuConsultant, view: value } });
const views = computed(() => [
  { value: 'simple' as const, label: i18n.t('ccuConsultant.view.simple'), icon: 'list' as const },
  { value: 'deep' as const, label: i18n.t('ccuConsultant.view.deep'), icon: 'link' as const },
]);

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
/**
 * The CCUs of each group's tab. "Without base ship" also counts the CCUs that will be short of a
 * way to a leaving base ship (#454) though covered today; those without any way are among its own.
 */
const tabCount = (id: BaseShipGroup) => {
  if (id !== 'missing') return list.value.counts[id];
  // The deep view's: the CCUs short of a way by the chain rule (#563).
  return view.value === 'deep' ? chains.value.tooFewCount : missingCounts(list.value).total;
};
/** The deep view's "Too few ways" instead of "Without base ship". */
const deepMissing = (id: ConsultantGroup) => view.value === 'deep' && id === 'missing';
/** The group shown: the one chosen, else the first one with CCUs (those without base ship first). */
const group = computed(
  (): BaseShipGroup =>
    (chosen.value && groups.value.includes(chosen.value) ? chosen.value : undefined) ??
    groups.value.find((id) => tabCount(id) > 0) ??
    'missing',
);

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
const selected = computed((): ConsultantGroup => (atRiskChosen.value ? 'atRisk' : group.value));
const countOf = (id: ConsultantGroup) => (id === 'atRisk' ? atRisk.value.count : tabCount(id));
const tabItems = computed(() =>
  [...groups.value, 'atRisk' as const].map((id) => ({
    id,
    label: deepMissing(id) ? i18n.t('ccuConsultant.deep.tab') : i18n.t(`ccuConsultant.tab.${id}`),
    count: format(countOf(id)),
  })),
);
function selectTab(id: ConsultantGroup) {
  atRiskChosen.value = id === 'atRisk';
  if (id !== 'atRisk') chosen.value = id;
}

/** The heading of the chosen group, with its count and hint. */
const heading = computed(() =>
  selected.value === 'atRisk'
    ? i18n.t('ccuConsultant.atRisk.title')
    : deepMissing(selected.value)
      ? i18n.t('ccuConsultant.tooFew.title')
      : i18n.t(`ccuConsultant.standing.${selected.value}`),
);
const hint = computed(() => {
  if (selected.value === 'atRisk') {
    return i18n.n('ccuConsultant.atRisk.hint', props.settings.priceIncreaseDays, [
      format(props.settings.priceIncreaseDays),
    ]);
  }
  if (deepMissing(group.value)) return i18n.t('ccuConsultant.deep.hint');
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

/** Every CCU of the chosen group, for "Show N CCUs in My Hangar". */
const groupIds = computed(() =>
  selected.value === 'atRisk'
    ? [
        ...new Set(
          [...atRisk.value.confirmed, ...atRisk.value.expected].flatMap((row) =>
            row.group.ccus.map((ccu) => ccu.id),
          ),
        ),
      ]
    : view.value === 'deep'
      ? deepCcuIds(deepShips(chains.value, list.value, group.value))
      : groupCcuIds(list.value, group.value),
);
/** Whether the chosen group has no base ship to show. */
// "Without base ship" in the simple view also holds the sections "soon" and "too few" (#454).
const groupEmpty = computed(() => {
  if (deepMissing(group.value)) return !chains.value.tooFew.length;
  if (list.value.groups[group.value].length) return false;
  return group.value !== 'missing' || (!list.value.soon.length && !list.value.tooFew.length);
});
const showInHangar = () =>
  openListShortcut(ccuGroupShortcut(selected.value, groupIds.value, view.value === 'deep'));

const storedBuyable = useStored(buyableShipsItem);
const storedWarbonds = useStored(warbondsItem);
/** The ship's standard SKU, not a warbond one, as in the Pledge Store tab. */
const skuOfShip = (shipId: number) =>
  standardSku(
    {
      buyable: current(storedBuyable.value ?? null)?.skus ?? [],
      warbonds: current(storedWarbonds.value ?? null)?.warbonds ?? [],
    },
    shipId,
  )?.skuId;
const skuOf = (row: BaseShipRow) => (row.shipId !== undefined ? skuOfShip(row.shipId) : undefined);
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
          :selected="selected"
          :label="i18n.t('ccuConsultant.groups')"
          panels="shm-ccu-consultant"
          @select="selectTab"
        />
        <div
          :id="`shm-ccu-consultant-panel-${selected}`"
          class="shm-ccu-consultant-panel"
          role="tabpanel"
          :aria-labelledby="`shm-ccu-consultant-tab-${selected}`"
        >
          <!-- The group's heading, its CCUs in My Hangar and the view, the same in both views. -->
          <div class="shm-ccu-consultant-panel-head">
            <div class="shm-ccu-consultant-heading">
              <h5 class="shm-ccu-consultant-group-title">
                {{ heading }}
                <span class="shm-ccu-consultant-group-count" :class="`is-${selected}`">
                  {{ format(countOf(selected)) }}
                </span>
              </h5>
              <p class="shm-ccu-consultant-hint">{{ hint }}</p>
            </div>
            <div class="shm-ccu-consultant-panel-actions">
              <button
                v-if="groupIds.length"
                v-tooltip="i18n.t('ccuConsultant.showInHangarHint')"
                type="button"
                class="shm-button shm-ccu-consultant-show"
                @click="showInHangar"
              >
                <SvgIcon name="filter" />
                {{
                  i18n.n('ccuConsultant.showInHangar', groupIds.length, [format(groupIds.length)])
                }}
              </button>
              <SegmentedControl
                class="shm-ccu-consultant-views"
                :model-value="view"
                :options="views"
                :label="i18n.t('ccuConsultant.view.label')"
                @update:model-value="setView"
              />
            </div>
          </div>

          <CcuAtRisk
            v-if="selected === 'atRisk'"
            :settings="settings"
            :at-risk="atRisk"
            :store-credit="storeCredit"
            :clock="clock"
          />
          <template v-else>
            <div v-if="groupEmpty" class="shm-ccu-consultant-empty" :class="`is-${group}`">
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
            <CcuShipCards
              v-if="view === 'simple'"
              :settings="settings"
              :list="list"
              :group="group"
              :sku-of="skuOf"
            />
            <CcuDeepView
              v-else
              :settings="settings"
              :list="list"
              :chains="chains"
              :group="group"
              :sku-of="skuOfShip"
              :store-credit="storeCredit"
            />
          </template>
        </div>
      </template>
    </div>
  </section>
</template>

<style src="./ccu-consultant.css"></style>
