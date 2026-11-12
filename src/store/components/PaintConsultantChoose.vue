<script setup lang="ts">
import { PAINT_DISCOUNT_TIERS } from '@/config';
import BulkExchangeOverlay from '@/hangar/components/BulkExchangeOverlay.vue';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import type { MissingCredit, PaintRebuyPlan } from '../paint-consultant/calculation';
import { CHART, COOLDOWN_SOURCE, usePaintWays } from '../paint-consultant/use-paint-ways';
import type { WayKind } from '../paint-consultant/ways';
import PaintCartButton from './PaintCartButton.vue';

/*
 * The plan of the Paint Discount Consultant as a choice between its two ways (setting "Layout":
 * "choose", #246): both ways at a glance with what they free, their tier, their paints and the
 * store credit they need up front; a click chooses one. Its steps with the store credit after
 * each, the chart of both ways with the chosen one in front, its cart and the cart's paints follow
 * for the chosen way only. The recommended way is chosen first: buying first, where it works.
 * A way that doesn't work can't be chosen and says why. See `use-paint-ways.ts`.
 */

const props = defineProps<{
  /** The best cart with the melt value ("melt first"). */
  plan: PaintRebuyPlan;
  /** The best cart the store credit pays alone ("buy first"), if any. */
  buyFirst?: PaintRebuyPlan;
  /** The store credit the plan may use. */
  credit: number;
  next?: MissingCredit;
  settings: Settings;
}>();

const {
  pledges,
  usd,
  factor,
  percent,
  signed,
  comparison,
  cards,
  dual,
  images,
  countOf,
  wayCards,
  keepPlan,
  cartFilled,
  ownPledges,
  melting,
  openBulkMeltingSetting,
  chart,
} = usePaintWays(props);

// ---- The choice ----

/** Buying first is safe, so it is recommended wherever it works. */
const recommended = computed((): WayKind => (props.buyFirst ? 'buy' : 'melt'));
const picked = ref<WayKind>();
/** The chosen way; one that doesn't work (anymore) falls back to the recommended one. */
const selected = computed((): WayKind =>
  picked.value && (picked.value === 'melt' || props.buyFirst) ? picked.value : recommended.value,
);
const choose = (kind: WayKind) => (picked.value = kind);

const choices = computed(() =>
  wayCards.value.map((card) => ({
    ...card,
    on: card.way.kind === selected.value,
    sub: card.impossible
      ? i18n.t('consultant.ways.needsMore', [usd(card.way.missing)])
      : i18n.t('consultant.choose.wayStat', [card.tier, countOf(card.way.plan!), card.upfront]),
  })),
);
const current = computed(() => wayCards.value.find((card) => card.way.kind === selected.value)!);
/** The cart of the chosen way. */
const currentPlan = computed(() => current.value.way.plan ?? props.plan);
const other = computed(() => wayCards.value.find((card) => card.way.kind !== selected.value)!);

// ---- The chart: both ways, the chosen one in front ----

const chartLines = computed(() =>
  // The chosen line last, so it is drawn on top.
  [...chart.value.lines].sort(
    (a, b) => Number(a.kind === selected.value) - Number(b.kind === selected.value),
  ),
);
const chosenLine = computed(() => chart.value.lines.find((line) => line.kind === selected.value)!);
/** The last value of the chosen way and what it changes the store credit by. */
const chartEnd = computed(() => {
  const last = chosenLine.value.points.at(-1)!;
  return {
    x: last.x,
    y: last.y - 12,
    text: `${usd(last.value)} · ${signed(currentPlan.value.storeCreditFreed) || usd(0)}`,
  };
});

// ---- The cart ----

const formula = computed(() => {
  const plan = currentPlan.value;
  const own = plan.own.reduce((sum, paint) => sum + paint.storePaint.price, 0);
  const fillers = plan.fillers.reduce((sum, f) => sum + f.paint.price * f.quantity, 0);
  const prices = fillers ? `(${usd(own)} + ${usd(fillers)})` : usd(own);
  return `${prices} × ${factor(plan.tier.percent)} =`;
});

const tiers = computed(() => {
  const chosen = currentPlan.value.tier.percent;
  // The other way's tier as a ring, where it is another one.
  const otherTier = other.value.way.plan?.tier.percent;
  return PAINT_DISCOUNT_TIERS.tiers.map((tier, i) => ({
    ...tier,
    height: `${14 + i * 6}px`,
    chosen: tier.percent === chosen,
    other: comparison.value === 'lowerTier' && tier.percent === otherTier,
  }));
});
const tierAria = computed(() =>
  [
    i18n.t('consultant.ways.tiersAria', [
      PAINT_DISCOUNT_TIERS.tiers
        .map((tier) => i18n.t('consultant.ways.tierAria', [percent(tier.percent), tier.paints]))
        .join(', '),
    ]),
    comparison.value === 'lowerTier' && other.value.way.plan
      ? i18n.t('consultant.choose.tiersOther', [
          percent(currentPlan.value.tier.percent),
          percent(other.value.way.plan.tier.percent),
        ])
      : i18n.t('consultant.choose.tiersOne', [percent(currentPlan.value.tier.percent)]),
  ].join(' '),
);

/** The paints of both carts; those not in the chosen one are faded. */
const paintCards = computed(() =>
  cards.value.map((card) => {
    // With one cart for both ways, its prices are the melt-first cart's.
    const prices = dual.value ? card.prices[selected.value] : card.prices.melt;
    return { ...card, inWay: prices };
  }),
);
</script>

<template>
  <div class="shm-ways shm-choose" :class="[`is-${comparison}`, `is-${selected}`]">
    <!-- Both ways at a glance; a click chooses one. -->
    <section class="shm-choose-ways" :aria-label="i18n.t('consultant.choose.label')">
      <button
        v-for="choice in choices"
        :key="choice.way.kind"
        v-tooltip="choice.impossible ? choice.hint : undefined"
        type="button"
        class="shm-choose-way"
        :class="[`is-${choice.way.kind}`, { 'is-on': choice.on }]"
        :aria-pressed="choice.on"
        :disabled="choice.impossible"
        @click="choose(choice.way.kind)"
      >
        <span class="shm-ways-num">{{ choice.num }}</span>
        <span class="shm-choose-way-title">
          {{ choice.title }}
          <span class="shm-way-badge" :class="`is-${choice.badge.tone}`">{{
            choice.badge.text
          }}</span>
        </span>
        <span class="shm-choose-way-freed shm-ways-mono" :class="{ 'is-none': choice.impossible }">
          {{ choice.freed }}
        </span>
        <span class="shm-choose-way-sub shm-ways-mono">{{ choice.sub }}</span>
      </button>
    </section>

    <!-- The chosen way: its steps, the store credit along the way, and its cart button. -->
    <section
      class="shm-ways-panel shm-choose-detail"
      :class="`is-${selected}`"
      :aria-label="current.title"
    >
      <ol class="shm-choose-steps">
        <li v-for="(step, i) in current.steps" :key="step.kind">
          <span class="shm-choose-step-icon">
            <span class="shm-way-step-badge"><SvgIcon :name="step.icon" /></span>
            <span v-if="i < current.steps.length - 1" class="shm-choose-step-line"></span>
          </span>
          <span class="shm-way-step-title">{{ step.title }}</span>
          <span class="shm-ways-muted">{{ step.sub }}</span>
          <span class="shm-choose-step-amounts shm-ways-mono">
            <span :class="{ 'is-gain': step.amount > 0 }">{{ step.amountText }}</span>
            <span class="shm-ways-faint">{{ step.balanceText }}</span>
          </span>
        </li>
      </ol>

      <svg
        class="shm-choose-chart"
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        width="100%"
        role="img"
        :aria-label="chart.aria"
      >
        <line
          class="shm-ways-chart-axis is-today"
          :x1="CHART.left - 20"
          :y1="chart.today"
          :x2="CHART.right + 20"
          :y2="chart.today"
        />
        <text
          class="shm-ways-chart-axis-text"
          :x="CHART.left - 28"
          :y="chart.today + 4"
          text-anchor="end"
        >
          {{ usd(credit) }}
        </text>
        <g
          v-for="line in chartLines"
          :key="line.kind"
          :class="[
            'shm-ways-chart-line',
            `is-${line.kind}`,
            { 'is-chosen': line.kind === selected, 'is-blocked': line.blocked },
          ]"
        >
          <polyline :points="line.points.map((point) => `${point.x},${point.y}`).join(' ')" />
          <template v-if="line.kind === selected">
            <circle
              v-for="(point, i) in line.points"
              :key="i"
              :cx="point.x"
              :cy="point.y"
              r="4.5"
            />
          </template>
        </g>
        <text
          class="shm-ways-chart-label"
          :class="`is-${selected}`"
          :x="chartEnd.x"
          :y="chartEnd.y"
          text-anchor="end"
        >
          {{ chartEnd.text }}
        </text>
      </svg>

      <div class="shm-choose-foot">
        <p class="shm-choose-hint">
          <SvgIcon :name="current.safe ? 'shield-halved' : 'triangle-exclamation'" />
          <span>{{ current.hint }}</span>
        </p>
        <div class="shm-way-actions shm-consultant-cart">
          <PaintCartButton
            v-if="current.way.kind === 'buy'"
            :lines="current.lines"
            @filled="keepPlan(current.way.plan, 'buy')"
          />
          <template v-else>
            <PaintCartButton
              :lines="current.lines"
              :label="i18n.t('consultant.ways.fillCart')"
              @filled="keepPlan(plan, 'melt')"
            />
            <!-- Bulk melting (experimental): after the cart was filled, before paying. -->
            <template v-if="cartFilled && ownPledges.length">
              <template v-if="settings.bulkMelting">
                <button
                  v-tooltip="i18n.t('consultant.meltHintReady')"
                  type="button"
                  class="shm-button is-danger"
                  @click="melting = true"
                >
                  <SvgIcon name="triangle-exclamation" />
                  {{ i18n.n('consultant.meltOwn', ownPledges.length) }}
                </button>
                <BulkExchangeOverlay
                  v-if="melting"
                  :pledges="ownPledges"
                  :hangar="pledges"
                  :skipped="0"
                  :extra-consent="i18n.t('consultant.meltConsent')"
                  @close="melting = false"
                />
              </template>
              <button
                v-else
                v-tooltip="i18n.t('bulkExchange.disabledHint')"
                type="button"
                class="shm-button"
                @click="openBulkMeltingSetting"
              >
                <SvgIcon name="gear" />
                {{ i18n.t('bulkExchange.disabled') }}
              </button>
            </template>
          </template>
        </div>
      </div>
    </section>

    <!-- The cart of the chosen way, with the tier it reaches. -->
    <section class="shm-ways-section" aria-labelledby="shm-choose-cart-title">
      <div class="shm-choose-cart-head">
        <div class="shm-choose-cart-text">
          <h4 id="shm-choose-cart-title" class="shm-ways-title">
            {{
              i18n.t('consultant.choose.cartTitle', [
                countOf(currentPlan),
                percent(currentPlan.tier.percent),
              ])
            }}
          </h4>
          <span class="shm-ways-mono shm-ways-muted">
            {{ formula }} <span class="shm-ways-strong">{{ usd(currentPlan.cartCost) }}</span>
          </span>
        </div>
        <div class="shm-choose-tiers" role="img" :aria-label="tierAria">
          <span
            v-for="tier in tiers"
            :key="tier.percent"
            class="shm-choose-tier"
            :class="{ 'is-chosen': tier.chosen, 'is-other': tier.other }"
          >
            <span class="shm-ways-mono shm-choose-tier-percent">{{ percent(tier.percent) }}</span>
            <span class="shm-choose-tier-bar" :style="{ height: tier.height }"></span>
            <span class="shm-ways-mono shm-ways-faint">×{{ tier.paints }}</span>
          </span>
        </div>
      </div>
      <ul class="shm-ways-cart">
        <li
          v-for="card in paintCards"
          :key="card.key"
          class="shm-ways-paint"
          :class="{ 'is-own': !card.filler, 'is-out': !card.inWay }"
        >
          <span class="shm-ways-paint-image">
            <img
              v-if="images.get(card.skuId)"
              :src="images.get(card.skuId)"
              alt=""
              loading="lazy"
            />
            <span class="shm-ways-tag" :class="card.filler ? 'is-filler' : 'is-own'">
              <SvgIcon v-if="card.filler" name="clock-rotate-left" />
              {{ card.filler ? i18n.t('consultant.fillerTag') : i18n.t('consultant.ways.ownTag') }}
            </span>
          </span>
          <span class="shm-ways-paint-name" :title="card.name">{{ card.name }}</span>
          <span class="shm-ways-paint-prices shm-ways-mono">
            <span v-if="card.inWay">
              <span class="shm-ways-faint shm-choose-was">{{ usd(card.inWay.price) }}</span>
              <span class="shm-ways-strong">{{ usd(card.inWay.inCart) }}</span>
            </span>
            <span v-else class="shm-ways-faint">{{ i18n.t('consultant.choose.notInCart') }}</span>
          </span>
        </li>
      </ul>
      <p v-if="next" class="shm-consultant-note is-info">
        {{ i18n.t('consultant.next') }}:
        {{ i18n.t('consultant.nextValue', [usd(next.missing), percent(next.tier.percent)]) }}
      </p>
    </section>

    <!-- Good to know. -->
    <ul class="shm-ways-notes" :aria-label="i18n.t('consultant.beforeTitle')">
      <li class="shm-ways-panel">
        <SvgIcon name="money-check-dollar" />
        <span>{{ i18n.t('consultant.ways.noteCredit') }}</span>
      </li>
      <li class="shm-ways-panel">
        <SvgIcon name="clock-rotate-left" />
        <span>
          {{ i18n.t('consultant.ways.noteCooldown') }}
          <a :href="COOLDOWN_SOURCE" target="_blank" rel="noopener noreferrer">
            {{ i18n.t('consultant.ways.noteCooldownSource') }}
          </a>
        </span>
      </li>
      <li class="shm-ways-panel">
        <SvgIcon name="gift" />
        <span>{{ i18n.t('consultant.ways.noteGiftable') }}</span>
      </li>
      <li class="shm-ways-panel">
        <SvgIcon name="box" />
        <span>{{ i18n.t('consultant.ways.notePacks') }}</span>
      </li>
    </ul>
  </div>
</template>

<style>
/*
 * Builds on the styles of the "ways" layout (`PaintConsultantWays.vue`, `.shm-ways`): the colors
 * by way, panels, numbers, badges, paint cards, chart lines and notes. Only the choice and the
 * detail of the chosen way are its own.
 */

/* The chosen way's color for everything that follows it, e.g. the tier of its cart. */
.shm-ways.shm-choose.is-buy {
  --shm-way: var(--shm-way-buy);
  --shm-way-on: var(--shm-way-on-buy);
}

.shm-ways.shm-choose.is-melt {
  --shm-way: var(--shm-way-melt);
  --shm-way-on: var(--shm-way-on-melt);
}

/* ---- The choice ---- */

.shm-choose-ways {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 8px;
}

.shm-ways .shm-choose-way {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding: 14px 16px;
  color: var(--shm-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 0;
  border-radius: var(--shm-radius-cell);
  box-shadow: inset 0 0 0 1px rgb(var(--shm-accent-rgb) / 0.2);
  transition:
    transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.shm-ways .shm-choose-way .shm-ways-num {
  grid-row: span 2;
  min-width: 28px;
  height: 28px;
}

.shm-ways .shm-choose-way.is-on {
  box-shadow: inset 0 0 0 2px var(--shm-way);
}

.shm-ways .shm-choose-way:not(:disabled):active {
  transform: scale(0.98);
}

.shm-ways .shm-choose-way:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .shm-ways .shm-choose-way:not(:disabled):not(.is-on):hover {
    background: color-mix(in srgb, var(--shm-way) 6%, rgb(var(--shm-surface-rgb) / 0.8));
  }
}

/* A way that doesn't work: faded, its number and badge tell why. */
.shm-ways .shm-choose-way:disabled {
  cursor: default;
}

.shm-ways .shm-choose-way:disabled .shm-ways-num {
  color: var(--shm-text-faint);
  background: var(--shm-ways-track);
}

.shm-ways .shm-choose-way:disabled .shm-choose-way-title {
  color: var(--shm-text-muted);
}

.shm-choose-way-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--shm-text-strong);
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-choose-way-freed {
  grid-row: span 2;
  color: var(--shm-way);
  font-size: calc(22px * var(--shm-font-scale));
  font-weight: 500;
}

.shm-choose-way-sub {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways .shm-choose-way:disabled .shm-choose-way-sub {
  color: var(--shm-danger);
}

/* ---- The chosen way ---- */

.shm-ways .shm-choose-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shm-way) 35%, transparent);
  transition: box-shadow 200ms ease;
}

.shm-ways .shm-choose-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-ways .shm-choose-steps li {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.shm-choose-step-icon {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shm-ways .shm-choose-step-icon .shm-way-step-badge {
  width: 32px;
  height: 32px;
  border-radius: 999px;
}

.shm-choose-step-line {
  flex: 1;
  height: 2px;
  background: color-mix(in srgb, var(--shm-way) 25%, transparent);
  border-radius: 1px;
}

.shm-choose-step-amounts {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: calc(13px * var(--shm-font-scale));
}

.shm-choose-step-amounts .shm-ways-faint {
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-choose-chart {
  display: block;
  overflow: visible;
}

/* The other way stays as a faint line, the chosen one in front. */
.shm-choose-chart .shm-ways-chart-line polyline {
  stroke-width: 1.5;
  opacity: 0.3;
  transition:
    opacity 200ms ease,
    stroke-width 200ms ease;
}

.shm-choose-chart .shm-ways-chart-line.is-chosen polyline {
  stroke-width: 3;
  opacity: 1;
}

.shm-choose-chart .shm-ways-chart-label {
  font-size: 13px;
}

.shm-choose-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.shm-ways .shm-choose-hint {
  display: flex;
  flex: 1 1 260px;
  gap: 8px;
  align-items: flex-start;
  margin: 0;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-choose-hint .shm-icon {
  flex: none;
  margin-top: 2px;
  color: var(--shm-way);
}

.shm-ways .shm-choose-foot .shm-way-actions {
  margin: 0;
}

/* The cart button in the chosen way's color, as on the way cards of the "ways" layout. */
html .shm-ways .shm-choose-detail .shm-way-actions .shm-button:not(.is-danger) {
  min-height: 40px;
  color: var(--shm-way-on);
  background: var(--shm-way);
  border-color: var(--shm-way);
}

html .shm-ways .shm-choose-detail .shm-way-actions .shm-button:not(.is-danger):disabled {
  color: var(--shm-text-faint);
  background: var(--shm-ways-track);
  border-color: transparent;
}

html .shm-ways .shm-choose-detail .shm-way-actions .shm-button:not(.is-danger):not(:disabled):hover,
html
  .shm-ways
  .shm-choose-detail
  .shm-way-actions
  .shm-button:not(.is-danger):not(:disabled):focus-visible {
  color: var(--shm-way-on);
  background: color-mix(in srgb, var(--shm-way) 85%, var(--shm-text-strong));
}

/* ---- The cart ---- */

.shm-choose-cart-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 24px;
}

.shm-choose-cart-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shm-choose-tiers {
  display: grid;
  grid-template-columns: repeat(5, 40px);
  align-items: end;
  gap: 4px;
}

.shm-choose-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: calc(10px * var(--shm-font-scale));
}

.shm-choose-tier-percent {
  color: var(--shm-text-faint);
}

.shm-choose-tier-bar {
  width: 100%;
  background: var(--shm-ways-track);
  border-radius: 3px;
  transition:
    background-color 200ms ease,
    box-shadow 200ms ease;
}

.shm-choose-tier.is-chosen .shm-choose-tier-bar {
  background: var(--shm-way);
}

.shm-choose-tier.is-chosen .shm-choose-tier-percent {
  color: var(--shm-text-strong);
}

/* The other way's tier: a ring in its color. */
.shm-ways.is-buy .shm-choose-tier.is-other .shm-choose-tier-bar {
  box-shadow: inset 0 0 0 1px var(--shm-way-melt);
}

.shm-ways.is-melt .shm-choose-tier.is-other .shm-choose-tier-bar {
  box-shadow: inset 0 0 0 1px var(--shm-way-buy);
}

.shm-ways .shm-ways-paint.is-out {
  opacity: 0.4;
}

.shm-choose-was {
  text-decoration: line-through;
}

@media (prefers-reduced-motion: reduce) {
  .shm-ways .shm-choose-way,
  .shm-ways .shm-choose-detail,
  .shm-choose-chart .shm-ways-chart-line polyline,
  .shm-choose-tier-bar {
    transition: none;
  }

  .shm-ways .shm-choose-way:not(:disabled):active {
    transform: none;
  }
}
</style>
