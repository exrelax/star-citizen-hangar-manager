<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { i18n, locale } from '@/i18n';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { listViewRequest, takeExpand } from '../list-jump';
import { REFUND_DAYS, REFUND_URGENT_DAYS, RSI_GAMES_LIBRARY_URL } from '@/config';
import { refundWindow, today } from '@/orders/refund';
import { formatDiscount, formatPercent, formatUsd } from '../discount-format';
import { openPaintConsultant, paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import { insuranceLabel, supersededInsurances } from '../insurance';
import { kindIcon } from '../pledge-kind';
import type { PledgeView } from '../pledge-view';
import { myGearHref } from '../route';
import OrderInfo from '@/orders/OrderInfo.vue';
import SvgIcon from '@/icons/SvgIcon.vue';
import ExchangeOverlay from './ExchangeOverlay.vue';
import ExternalLinks from './ExternalLinks.vue';
import GiftOverlay from './GiftOverlay.vue';
import ProtectedBadge from './ProtectedBadge.vue';
import PriceIncreaseBadge from '@/price-increases/components/PriceIncreaseBadge.vue';
import { openCcuAdvice } from '@/price-increases/ccu-advice-request';
import { openShipRemoval } from '@/store/open-current-warbonds';
import { futureDiscount } from '@/price-increases/future-discount';
import { formatExpectedTime } from '@/price-increases/price-increase-label';
import UpgradeLog from './UpgradeLog.vue';
import CcuCoverage from '@/ccu-consultant/components/CcuCoverage.vue';
import { useProvidedCcuCoverage, useProvidedCoverageSources } from '@/ccu-consultant/coverage';
import { standingOf } from '@/ccu-consultant/base-ship-list';
import { rsiUrl } from '@/shared/rsi-api';
import { listDate, useProvidedAlwaysAvailable } from '@/ccu-consultant/always-available';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { selection } from '../selection';
import { formatTimeLeft, toggleMeltMark } from '../melt-marks';
import { useMarkedPledges } from '../use-melt-marks';
import { useNow } from '@/shared/use-now';
import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import { limitedSaleNote } from '@/ship-removals/removal-availability';

const props = defineProps<{
  pledge: PledgeView;
  /** Set while this is the only pledge in the list: it then opens on its own. */
  autoExpand?: boolean;
}>();

/** The current ship of an upgraded pledge first, then the other ships. */
const linkedShips = computed(() =>
  props.pledge.titleShip ? [props.pledge.titleShip, ...props.pledge.ships] : props.pledge.ships,
);

/** Days left to refund a purchase paid with money (CIG: 30 days), while there are any. */
const refund = computed(() =>
  props.pledge.order?.placedAt ? refundWindow(props.pledge.order.placedAt, today.value) : undefined,
);

/** Insurances of an upgraded ship replaced by a better one (hidden by a setting, see row.css). */
const superseded = computed(() =>
  props.pledge.isUpgraded
    ? supersededInsurances(
        props.pledge.items.map((item) => (item.kind === 'Insurance' ? item.title : '')),
      )
    : new Set<number>(),
);

/** The discount, unless there is none: exactly the original price ("$0 (0%)" says nothing). */
/** The Paint Discount Consultant would melt this paint and buy it again (see `paintRebuys`). */
const rebuy = computed(() => paintRebuys.value.get(props.pledge.id));
const rebuyText = computed(() => {
  const value = rebuy.value;
  if (!value) return undefined;
  const from = formatPercent(value.from, locale.value);
  const to = formatPercent(value.to, locale.value);
  const freed = formatUsd(value.freed, locale.value);
  // Bought again already (#139): this old pledge is only left to melt.
  return value.kind === 'melt'
    ? {
        label: i18n.t('consultant.markMelt', [to]),
        hint: i18n.t('consultant.markMeltHint', [to, freed]),
      }
    : {
        label: i18n.t('consultant.mark', [from, to]),
        hint: i18n.t('consultant.markHint', [from, to, freed]),
      };
});

/**
 * The discount after an expected price increase, where its change in USD is known (#274): next
 * to today's, in the warning color, with when it changes in its tooltip.
 */
const future = computed(() => {
  const value = futureDiscount(props.pledge);
  if (!value) return undefined;
  const money = (amount: number) => formatUsd(amount, locale.value);
  const share =
    value.percent === undefined ? '' : ` (${formatPercent(Math.abs(value.percent), locale.value)})`;
  const sign = value.amount === 0 ? '' : value.amount < 0 ? '+' : '−';
  const amount = `${money(Math.abs(value.amount))}${share}`;
  return {
    text: `→ ${sign}${amount}`,
    title: i18n.t(
      `pledge.${value.amount < 0 ? 'futureSurchargeTitle' : 'futureDiscountTitle'}${
        value.increase.confirmed ? 'Confirmed' : ''
      }` as 'pledge.futureDiscountTitle',
      [
        formatExpectedTime(value.increase.priceIncreaseAt, locale.value),
        value.increase.ship.name,
        money(value.original),
        money(props.pledge.discount?.original ?? value.original),
        amount,
      ],
    ),
  };
});

/**
 * A CCU whose base ship leaves the Pledge Store (#289): a warning triangle with the ship and the
 * date, and – expanded – how many CCUs to that ship the hangar and the buy back have. Red with
 * fewer CCUs to the ship than from it (#287): not every CCU from it has a ship to go on.
 */
/** What gives the base ship of a CCU (#108, #111). */
const coverages = useProvidedCcuCoverage();
const coverage = computed(() => coverages.value.get(props.pledge.id));
// A CCU whose base ship is always available in the Pledge Store (#112), with or without coverage.
const alwaysAvailableShips = useProvidedAlwaysAvailable();
const alwaysAvailable = computed(() => {
  const list = alwaysAvailableShips.value;
  const ship = coverage.value?.baseShip;
  if (!list || ship?.id === undefined || !list.has(ship.id)) return undefined;
  const date = listDate(list.changedAt, locale.value);
  return date
    ? i18n.t('ccuCoverage.alwaysAvailableHint', [ship.name, list.source.name, date])
    : i18n.t('ccuCoverage.alwaysAvailableHintUndated', [ship.name, list.source.name]);
});
/**
 * A CCU without its base ship (#114): neither the hangar nor the buy back gives it, and – while
 * those are considered – it isn't always available. The same rule as the CCU Consultant's list.
 */
const coverageSources = useProvidedCoverageSources();
const baseMissing = computed(() => {
  const value = coverage.value;
  if (!props.pledge.isCcu || !value) return undefined;
  if (standingOf(value, alwaysAvailableShips.value) !== 'missing') return undefined;
  const id = value.baseShip?.id;
  const ship =
    id !== undefined ? coverageSources.value.ships.find((entry) => entry.id === id) : undefined;
  const name = ship?.name ?? value.baseShip?.name ?? i18n.t('ccuCoverage.baseShip');
  return {
    note: i18n.t(
      alwaysAvailableShips.value ? 'ccuCoverage.missingNote' : 'ccuCoverage.missingNoteAll',
      [name],
    ),
    ...(ship?.link && {
      link: rsiUrl(ship.link),
      linkLabel: i18n.t('ccuCoverage.missingLink', [ship.name]),
    }),
  };
});
const removals = useProvidedRemovalCcus();
const removal = computed(() => {
  const entry = removals.value.byHangarCcu.get(props.pledge.id);
  if (!entry) return undefined;
  const { ship, removedAt } = entry.removal;
  const count = (source: 'hangar' | 'buyback') =>
    entry.to.filter((ccu) => ccu.source === source).length;
  const critical = entry.level === 'critical';
  const about = i18n.t('shipRemovals.ccuHint', [
    ship.name,
    formatExpectedTime(removedAt, locale.value),
  ]);
  const shortage = critical ? i18n.t('shipRemovals.ccuCritical', [ship.name]) : '';
  const ccusTo = i18n.t('shipRemovals.ccusTo', [ship.name, count('hangar'), count('buyback')]);
  // On sale now, but not always available (#293): it may be gone before the date.
  const limited = limitedSaleNote([entry.removal], removals.value.limited, locale.value) ?? '';
  return {
    critical,
    shipId: ship.id,
    /** The button to the ship in the Pledge Store tab (#381). */
    showHint: i18n.t('shipRemovals.showShipHint', [ship.name]),
    /** The tooltip: the ship, the date and, if so, that there are too few CCUs to it. */
    hint: [about, shortage, limited].filter(Boolean).join(' '),
    /** Expanded: the counts before the shortage they show. */
    details: [about, ccusTo, shortage, limited].filter(Boolean).join(' '),
  };
});

const discount = computed(() =>
  props.pledge.discount && props.pledge.discount.amount !== 0
    ? formatDiscount(props.pledge.discount, locale.value)
    : undefined,
);

/** The icon of the pledge's kind, on the row's image. */
const kind = computed(() => kindIcon({ ...props.pledge, isReward: !!props.pledge.reward }));

/** Marked to melt (#97): when it can be melted, counted down in the badge. */
const marked = useMarkedPledges();
const mark = computed(() => marked.value.get(props.pledge.id));
const now = useNow();
const meltMark = computed(() => {
  const value = mark.value;
  if (!value) return undefined;
  const left = value.meltableAt - now.value;
  const at = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' });
  return {
    ready: left <= 0,
    label:
      left <= 0
        ? i18n.t('meltMark.ready')
        : i18n.t('meltMark.waiting', [formatTimeLeft(left, locale.value)]),
    hint: i18n.t('meltMark.hint', [at.format(value.meltableAt)]),
  };
});

/** RSI's exchange (melt) dialog, in the manager's design. */
const exchanging = ref(false);
/** RSI's gift dialog, in the manager's design. */
const gifting = ref(false);

const expanded = ref(!!props.autoExpand);
// Only rows opened automatically close again automatically; a manual toggle is kept.
let openedAutomatically = expanded.value;
watch(
  () => props.autoExpand,
  (autoExpand) => {
    if (autoExpand && !expanded.value) {
      expanded.value = true;
      openedAutomatically = true;
    } else if (!autoExpand && openedAutomatically) {
      expanded.value = false;
      openedAutomatically = false;
    }
  },
);

// Back to a list after opening a pledge from this CCU's "Base ship" (#436): expanded again and in
// view.
const row = useTemplateRef<HTMLElement>('row');
watch(
  listViewRequest,
  async () => {
    if (!takeExpand(props.pledge.id, 'row')) return;
    expanded.value = true;
    openedAutomatically = false;
    await nextTick();
    row.value?.scrollIntoView({ block: 'center' });
  },
  { immediate: true },
);

// The manager lives on the hangar page, so this is its path including the locale prefix.
const pathname = location.pathname;
const demo = useDemoContext();
const selected = computed(() => selection.ids.value.has(props.pledge.id));

const toggle = () => {
  expanded.value = !expanded.value;
  openedAutomatically = false;
};
</script>

<template>
  <div ref="row" class="shm-row" :class="{ 'is-expanded': expanded, 'is-selected': selected }">
    <!-- Selects the pledge for the sidebar; outside the summary, so it doesn't open the row. -->
    <button
      type="button"
      role="checkbox"
      class="shm-select-toggle"
      :aria-checked="selected"
      :aria-label="i18n.t('pledge.select', [pledge.title])"
      @click="selection.toggle(pledge.id)"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 8.2l2.3 2.3 4.7-4.9" />
      </svg>
    </button>
    <!-- Clicking anywhere toggles the details; the chevron button makes it keyboard accessible. -->
    <div class="shm-row-summary" @click="toggle">
      <span class="shm-thumb">
        <img
          v-if="pledge.image"
          :src="pledge.image"
          alt=""
          loading="lazy"
          decoding="async"
          width="128"
          height="72"
        />
        <!-- The kind of item (ship, CCU, paint, …) as a badge on the image. -->
        <span v-if="kind" class="shm-row-kind"><SvgIcon :name="kind" /></span>
      </span>

      <span class="shm-main">
        <span class="shm-title">{{ pledge.title }}</span>
        <span v-if="pledge.originalName" class="shm-original">
          {{ i18n.t('pledge.originalName', [pledge.originalName]) }}
        </span>
        <span v-if="pledge.ships.length" class="shm-ships">
          {{ i18n.t('pledge.shipsLabel') }}
          <template v-for="(ship, index) in pledge.ships" :key="ship.name">
            <span class="shm-ship">{{ ship.name }}</span
            ><template v-if="index < pledge.ships.length - 1">, </template>
          </template>
        </span>
        <span class="shm-meta">
          <span class="shm-pledge-id">#{{ pledge.displayId ?? pledge.id }}</span>
          <span class="shm-value">{{ pledge.value }}</span>
          <span
            v-if="discount"
            v-tooltip="discount.title"
            class="shm-discount"
            :class="{ 'is-surcharge': discount.isSurcharge }"
          >
            {{ discount.text }}
          </span>
          <span v-if="future" v-tooltip="future.title" class="shm-discount is-future">
            {{ future.text }}
          </span>
          <span v-if="pledge.createdAt">{{ pledge.createdAt }}</span>
        </span>
      </span>

      <span class="shm-badges">
        <span
          v-if="meltMark"
          v-tooltip="meltMark.hint"
          class="shm-badge is-melt-mark"
          :class="{ 'is-ready': meltMark.ready }"
        >
          <SvgIcon name="recycle" />
          {{ meltMark.label }}
        </span>
        <!-- Opens the Paint Discount Consultant in the Pledge Store tab. -->
        <button
          v-if="rebuyText"
          v-tooltip="rebuyText.hint"
          type="button"
          class="shm-badge is-rebuy"
          @click.stop="openPaintConsultant(rebuy?.kind === 'melt' ? 'running' : 'new')"
        >
          {{ rebuyText.label }}
        </button>
        <ProtectedBadge
          v-if="pledge.protectedGames.length"
          :games="pledge.protectedGames"
          :has-ship="pledge.items.some((item) => item.kind === 'Ship')"
        />
        <span
          v-if="refund"
          v-tooltip="i18n.t('refund.hint', [pledge.order!.placedAt!, REFUND_DAYS, refund.until])"
          class="shm-badge is-refund"
          :class="{ 'is-urgent': refund.daysLeft < REFUND_URGENT_DAYS }"
        >
          {{
            refund.daysLeft === 0
              ? i18n.t('refund.lastDay')
              : i18n.n('refund.days', refund.daysLeft)
          }}
        </span>
        <span
          v-if="removal"
          v-tooltip="removal.hint"
          class="shm-badge is-price-increase is-warning shm-removal-badge"
          :class="{ 'is-critical': removal.critical }"
          role="img"
          :aria-label="removal.hint"
          tabindex="0"
        >
          <SvgIcon name="triangle-exclamation" />
        </span>
        <PriceIncreaseBadge
          v-if="pledge.priceIncrease || pledge.ccuPriceChange"
          :match="pledge.priceIncrease"
          :ccu="pledge.ccuPriceChange"
          place="hangar"
        />
        <span v-if="baseMissing" v-tooltip="baseMissing.note" class="shm-badge is-base-missing">
          {{ i18n.t('ccuCoverage.missing') }}
        </span>
        <span
          v-if="alwaysAvailable"
          v-tooltip="alwaysAvailable"
          class="shm-badge is-always-available"
        >
          {{ i18n.t('ccuCoverage.alwaysAvailable') }}
        </span>
        <span
          v-if="pledge.insurance"
          v-tooltip="i18n.t('insurance.badgeTitle')"
          class="shm-badge is-insurance"
          :class="{ 'is-lti': pledge.insurance.lifetime }"
        >
          {{ insuranceLabel(pledge.insurance) }}
        </span>
        <span v-if="pledge.isUpgraded" class="shm-badge is-upgraded">
          {{ i18n.t('pledge.upgraded') }}
        </span>
        <span
          v-tooltip="i18n.t(pledge.isGiftable ? 'pledge.giftable' : 'pledge.notGiftable')"
          class="shm-badge is-gift"
          :class="{ 'is-off': !pledge.isGiftable }"
        >
          Gift
        </span>
        <span
          v-tooltip="i18n.t(pledge.isMeltable ? 'pledge.meltable' : 'pledge.notMeltable')"
          class="shm-badge is-melt"
          :class="{ 'is-off': !pledge.isMeltable }"
        >
          Melt
        </span>
      </span>

      <button
        v-tooltip="i18n.t('pledge.toggleDetails')"
        type="button"
        class="shm-chevron"
        :aria-expanded="expanded"
        :aria-label="i18n.t('pledge.toggleDetails')"
        @click.stop="toggle"
      >
        <SvgIcon name="chevron-right" />
      </button>
    </div>

    <!-- Two columns like the row above: the way to RSI's original under the image, then the rest. -->
    <div v-if="expanded" class="shm-details">
      <div class="shm-details-side">
        <!-- In the demo the link would reveal the real pledge id (and page): it stays inert. -->
        <a
          class="shm-button shm-origin-button"
          :href="demo ? '#' : myGearHref(pathname, pledge.page, pledge.id)"
          @click="demo && $event.preventDefault()"
        >
          {{ i18n.t('pledge.showInMyGear', [pledge.page]) }}
        </a>
        <!-- Opens the dialog in the demo too; there its exchange button is disabled. -->
        <button
          v-if="pledge.isMeltable"
          v-tooltip="i18n.t('exchange.buttonHint')"
          type="button"
          class="shm-button shm-origin-button shm-exchange-button is-danger"
          @click="exchanging = true"
        >
          <SvgIcon name="triangle-exclamation" />
          {{ i18n.t('exchange.button') }}
        </button>
        <ExchangeOverlay v-if="exchanging" :pledge="pledge" @close="exchanging = false" />
        <!-- Marks it to melt later: tells when RSI lets it be melted (#97). -->
        <!-- In the demo it marks in the demo's own marks (see `demoMeltMarksItem`). -->
        <button
          v-if="pledge.isMeltable"
          v-tooltip="i18n.t('meltMark.buttonHint')"
          type="button"
          class="shm-button shm-origin-button shm-melt-mark-button"
          :aria-pressed="!!mark"
          @click="toggleMeltMark(pledge.id, !!demo)"
        >
          <SvgIcon name="recycle" />
          {{ i18n.t(mark ? 'meltMark.unmark' : 'meltMark.mark') }}
        </button>
        <button
          v-if="pledge.isGiftable"
          v-tooltip="i18n.t('gift.buttonHint')"
          type="button"
          class="shm-button shm-origin-button shm-gift-button"
          @click="gifting = true"
        >
          <SvgIcon name="gift" />
          {{ i18n.t('gift.button') }}
        </button>
        <GiftOverlay v-if="gifting" :pledge="pledge" @close="gifting = false" />
        <!-- A CCU losing upgrade value with a price increase: how to keep its discount (#252). -->
        <button
          v-if="pledge.ccuPriceChange?.direction === 'loses'"
          v-tooltip="i18n.t('ccuAdvice.buttonHint')"
          type="button"
          class="shm-button is-warning shm-origin-button shm-ccu-advice-button"
          @click="openCcuAdvice(pledge.id)"
        >
          <SvgIcon name="scale-balanced" />
          {{ i18n.t('ccuAdvice.button') }}
        </button>
        <!-- Its base ship leaves the Pledge Store (#381): its CCUs from and to it there. -->
        <button
          v-if="removal"
          v-tooltip="removal.showHint"
          type="button"
          class="shm-button shm-origin-button shm-removal-button"
          :class="removal.critical ? 'is-danger' : 'is-warning'"
          @click="openShipRemoval(removal.shipId)"
        >
          <SvgIcon name="basket-shopping" />
          {{ i18n.t('notifications.showInStore') }}
        </button>
      </div>
      <div class="shm-details-main">
        <OrderInfo v-if="pledge.order" :order="pledge.order" :base="pledge.isUpgraded" refundable />
        <p v-if="pledge.upgrade" class="shm-upgrade">
          {{ pledge.upgrade.matchItems.map((item) => item.name).join(', ') }}
          →
          {{ pledge.upgrade.targetItems.map((item) => item.name).join(', ') }}
        </p>
        <!-- Its base ship leaves the Pledge Store (#289): what to apply it to afterwards. -->
        <p
          v-if="removal"
          class="shm-hint shm-removal-hint"
          :class="{ 'is-critical': removal.critical }"
        >
          <SvgIcon name="triangle-exclamation" />
          <span>{{ removal.details }}</span>
        </p>
        <!-- No base ship for this CCU (#114): a hint, with the ship in the Pledge Store. -->
        <div v-if="baseMissing" class="shm-hint shm-base-missing-note">
          <SvgIcon name="triangle-exclamation" />
          <span>
            <strong>{{ i18n.t('ccuCoverage.missing') }}</strong>
            {{ baseMissing.note }}
            <a
              v-if="baseMissing.link"
              class="shm-hint-link"
              :href="baseMissing.link"
              target="_blank"
              rel="noopener"
              >{{ baseMissing.linkLabel }} <SvgIcon name="square-up-right"
            /></a>
          </span>
        </div>
        <ul v-if="pledge.items.length" class="shm-items">
          <li
            v-for="(item, index) in pledge.items"
            :key="index"
            :class="{ 'is-superseded-insurance': superseded.has(index) }"
          >
            <span class="shm-item-title">{{ item.title }}</span>
            <span v-if="item.kind" class="shm-item-kind">{{ item.kind }}</span>
            <span v-if="item.manufacturer" class="shm-item-manufacturer">
              {{ item.manufacturer }}
            </span>
          </li>
        </ul>
        <CcuCoverage v-if="pledge.isCcu && coverage" :coverage="coverage" />
        <UpgradeLog
          v-if="pledge.isUpgraded"
          :pledge-id="pledge.id"
          :created-at="pledge.createdAt"
        />
        <!-- Every pledge with the game, protected or not: below the upgrades, above the links. -->
        <a
          v-if="pledge.hasGameAccess || pledge.protectedGames.length"
          v-tooltip="i18n.t('pledge.gamesLibraryHint')"
          class="shm-games-library"
          :href="RSI_GAMES_LIBRARY_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ i18n.t('pledge.gamesLibrary') }}<SvgIcon name="square-up-right" />
        </a>
        <ExternalLinks :ships="linkedShips" />
      </div>
    </div>
  </div>
</template>

<style src="./row.css"></style>
