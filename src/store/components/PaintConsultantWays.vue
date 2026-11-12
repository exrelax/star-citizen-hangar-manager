<script setup lang="ts">
import BulkExchangeOverlay from '@/hangar/components/BulkExchangeOverlay.vue';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import type { MissingCredit, PaintRebuyPlan } from '../paint-consultant/calculation';
import { CHART, COOLDOWN_SOURCE, usePaintWays } from '../paint-consultant/use-paint-ways';
import type { WayKind } from '../paint-consultant/ways';
import PaintCartButton from './PaintCartButton.vue';

/*
 * The plan of the Paint Discount Consultant as two ways side by side (setting "Layout": "ways"),
 * see `use-paint-ways.ts`.
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
  percent,
  comparison,
  cards,
  dual,
  images,
  countOf,
  wayTitle,
  wayNumber,
  results,
  tiers,
  tierHead,
  tierAria,
  formulas,
  why,
  waysTitle,
  wayCards,
  keepPlan,
  cartFilled,
  ownPledges,
  melting,
  openBulkMeltingSetting,
  chart,
} = usePaintWays(props);
</script>

<template>
  <div class="shm-ways" :class="`is-${comparison}`">
    <!-- What each way frees, and the tiers they reach. -->
    <section class="shm-ways-top" :aria-label="i18n.t('consultant.ways.resultLabel')">
      <div class="shm-ways-panel shm-ways-results">
        <span class="shm-ways-panel-head">
          <span>{{ i18n.t('consultant.ways.freedTitle') }}</span>
          <span v-if="credit" class="shm-ways-mono">
            {{ i18n.t('consultant.ways.yourCredit', [usd(credit)]) }}
          </span>
        </span>
        <div
          v-for="row in results"
          :key="row.kind"
          class="shm-ways-result"
          :class="`is-${row.kind}`"
        >
          <span class="shm-ways-num">{{ row.num }}</span>
          <span class="shm-ways-result-text">
            <span class="shm-ways-result-title">{{ row.title }}</span>
            <span class="shm-ways-muted">{{ row.sub }}</span>
          </span>
          <span
            class="shm-ways-result-value shm-ways-mono"
            :class="{ 'is-none': row.value === '–' }"
          >
            {{ row.value }}
          </span>
        </div>
      </div>
      <div class="shm-ways-panel shm-ways-tiers">
        <span class="shm-ways-panel-head">
          <span>{{ i18n.t('consultant.tier') }}</span>
          <span class="shm-ways-tier-head">
            <span v-for="head in tierHead" :key="head.kind" :class="`is-${head.kind}`">
              {{ head.text }}
            </span>
          </span>
        </span>
        <div class="shm-ways-tier-bars" role="img" :aria-label="tierAria">
          <div
            v-for="tier in tiers"
            :key="tier.percent"
            class="shm-ways-tier"
            :class="{
              'is-reached': tier.reached,
              'is-buy': tier.marks.includes('buy'),
              'is-melt': tier.marks.includes('melt'),
            }"
          >
            <span class="shm-ways-tier-marks">
              <span
                v-for="mark in tier.marks"
                :key="mark"
                class="shm-ways-mark"
                :class="`is-${mark}`"
              >
                {{ wayNumber(mark) }}
              </span>
            </span>
            <span class="shm-ways-mono shm-ways-tier-percent">{{ percent(tier.percent) }}</span>
            <span class="shm-ways-tier-bar" :style="{ height: tier.height }"></span>
          </div>
        </div>
        <div class="shm-ways-tier-counts shm-ways-mono" aria-hidden="true">
          <span v-for="tier in tiers" :key="tier.percent">{{ tier.paints }}</span>
        </div>
      </div>
    </section>

    <!-- The cart: own paints and filler paints, with what each costs in it. -->
    <section class="shm-ways-section" aria-labelledby="shm-ways-cart-title">
      <div class="shm-ways-section-head">
        <h4 id="shm-ways-cart-title" class="shm-ways-title">
          {{
            dual
              ? i18n.t('consultant.ways.cartTitle')
              : i18n.t('consultant.ways.cartTitleCount', [countOf(plan)])
          }}
        </h4>
        <span class="shm-ways-formulas shm-ways-mono">
          <span v-for="formula in formulas" :key="formula.kind">
            <span v-if="formula.num" :class="`is-${formula.kind}`">{{ formula.num }}</span
            >{{ formula.text }}<span class="shm-ways-strong">{{ formula.total }}</span>
          </span>
        </span>
      </div>
      <ul class="shm-ways-cart">
        <li
          v-for="card in cards"
          :key="card.key"
          class="shm-ways-paint"
          :class="{ 'is-own': !card.filler }"
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
            <template v-if="dual">
              <span v-for="kind in ['buy', 'melt'] as WayKind[]" :key="kind">
                <span :class="`is-${kind}`">{{ wayNumber(kind) }}</span>
                <span v-if="card.prices[kind]" class="shm-ways-strong">
                  {{ usd(card.prices[kind]!.price) }} → {{ usd(card.prices[kind]!.inCart) }}
                </span>
                <span v-else class="shm-ways-faint">–</span>
              </span>
            </template>
            <span v-else-if="card.prices.melt">
              <span class="shm-ways-faint">{{ usd(card.prices.melt.price) }}</span>
              <span class="shm-ways-strong">{{ usd(card.prices.melt.inCart) }}</span>
            </span>
          </span>
        </li>
      </ul>
      <div class="shm-ways-legend">
        <span>
          <span class="shm-ways-tag is-own">{{ i18n.t('consultant.ways.ownTag') }}</span>
          {{ i18n.t('consultant.ways.legendOwn') }}
        </span>
        <span v-if="plan.fillers.length">
          <span class="shm-ways-tag is-filler">
            <SvgIcon name="clock-rotate-left" />{{ i18n.t('consultant.fillerTag') }}
          </span>
          {{ i18n.t('consultant.ways.legendFiller') }}
        </span>
        <span v-if="dual">
          <span class="shm-ways-faint shm-ways-mono">–</span>
          {{ i18n.t('consultant.ways.legendNotInCart') }}
        </span>
      </div>
    </section>

    <!-- Both ways, why they differ, and their steps. -->
    <section class="shm-ways-section" aria-labelledby="shm-ways-title">
      <h4 id="shm-ways-title" class="shm-ways-title">{{ waysTitle }}</h4>

      <div v-if="why" class="shm-ways-panel shm-ways-why">
        <span class="shm-ways-result-title">{{ i18n.t('consultant.ways.whyTitle') }}</span>
        <div class="shm-ways-why-bars">
          <div v-for="row in why.rows" :key="row.kind" class="shm-ways-why-row">
            <span :class="`is-${row.kind}`"
              >{{ wayNumber(row.kind) }} · {{ wayTitle(row.kind) }}</span
            >
            <span
              class="shm-ways-why-bar"
              :class="`is-${row.kind}`"
              role="img"
              :aria-label="row.aria"
            >
              <span class="shm-ways-why-solid" :style="{ width: row.solid }"></span>
              <span
                v-if="row.rest"
                class="shm-ways-why-rest"
                :class="row.rest"
                :style="{ left: row.solid }"
              ></span>
            </span>
            <span
              class="shm-ways-mono shm-ways-why-value"
              :class="row.missing ? 'is-danger' : `is-${row.kind}`"
            >
              {{ row.value }}
            </span>
          </div>
          <div class="shm-ways-why-row is-scale" aria-hidden="true">
            <span></span>
            <span class="shm-ways-why-scale">
              <span class="shm-ways-why-marker" :style="{ left: why.marker }"></span>
              <span class="shm-ways-why-marker-text shm-ways-mono" :style="{ left: why.marker }">
                {{ i18n.t('consultant.ways.youHave', [usd(credit)]) }}
              </span>
            </span>
            <span></span>
          </div>
        </div>
        <div class="shm-ways-why-texts">
          <span
            ><strong class="is-buy">{{ wayTitle('buy') }}</strong> {{ why.buy }}</span
          >
          <span
            ><strong class="is-melt">{{ wayTitle('melt') }}</strong> {{ why.melt }}</span
          >
        </div>
      </div>

      <div class="shm-ways-cards">
        <article
          v-for="card in wayCards"
          :key="card.way.kind"
          class="shm-ways-panel shm-way"
          :class="[`is-${card.way.kind}`, { 'is-impossible': card.impossible }]"
          :aria-labelledby="`shm-way-${card.way.kind}`"
        >
          <div class="shm-way-head">
            <span class="shm-way-name">
              <span class="shm-ways-num">{{ card.num }}</span>
              <span :id="`shm-way-${card.way.kind}`" class="shm-way-title">{{ card.title }}</span>
              <span class="shm-way-badge" :class="`is-${card.badge.tone}`">{{
                card.badge.text
              }}</span>
            </span>
            <span class="shm-way-stats">
              <span>
                {{ i18n.t('consultant.ways.statDiscount') }}
                <span class="shm-ways-mono shm-way-stat" :class="{ 'is-none': card.impossible }">
                  {{ card.tier }}
                </span>
              </span>
              <span>
                {{ i18n.t('consultant.ways.statFreed') }}
                <span
                  class="shm-ways-mono shm-way-stat"
                  :class="card.impossible ? 'is-none' : 'is-gain'"
                >
                  {{ card.freed }}
                </span>
              </span>
              <span v-tooltip="i18n.t('consultant.ways.statUpfrontHint')" class="has-hint">
                {{ i18n.t('consultant.ways.statUpfront') }}
                <span class="shm-ways-mono shm-way-stat" :class="{ 'is-danger': card.impossible }">
                  {{ card.upfront }}
                </span>
              </span>
            </span>
          </div>

          <ol class="shm-way-steps">
            <li
              v-for="(step, i) in card.steps"
              :key="step.kind"
              :class="{ 'is-blocked': step.blocked, 'is-faded': step.faded }"
            >
              <span class="shm-way-step-icon">
                <span class="shm-way-step-badge"><SvgIcon :name="step.icon" /></span>
                <span v-if="i < card.steps.length - 1" class="shm-way-step-line"></span>
              </span>
              <span class="shm-way-step-text">
                <span class="shm-way-step-title">{{ step.title }}</span>
                <span class="shm-ways-muted">{{ step.sub }}</span>
              </span>
              <span class="shm-way-step-amounts shm-ways-mono">
                <span
                  :class="{ 'is-gain': step.amount > 0 && !step.faded, 'is-danger': step.blocked }"
                >
                  {{ step.amountText }}
                </span>
                <span class="shm-way-step-balance" :class="{ 'is-danger': step.blocked }">
                  {{ step.balanceText }}
                </span>
              </span>
            </li>
          </ol>

          <p class="shm-way-hint">
            <SvgIcon :name="card.safe ? 'shield-halved' : 'triangle-exclamation'" />
            <span>{{ card.hint }}</span>
          </p>

          <div class="shm-way-actions shm-consultant-cart">
            <template v-if="card.way.kind === 'buy'">
              <PaintCartButton
                v-if="card.way.plan"
                :lines="card.lines"
                @filled="keepPlan(card.way.plan, 'buy')"
              />
              <button v-else type="button" class="shm-button" disabled>
                <SvgIcon name="basket-shopping" />
                {{ i18n.t('consultant.ways.needsMore', [usd(card.way.missing)]) }}
              </button>
            </template>
            <template v-else>
              <PaintCartButton
                :lines="card.lines"
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
        </article>
      </div>
      <p v-if="next" class="shm-consultant-note is-info">
        {{ i18n.t('consultant.next') }}:
        {{ i18n.t('consultant.nextValue', [usd(next.missing), percent(next.tier.percent)]) }}
      </p>
    </section>

    <!-- The store credit after each step of both ways. -->
    <section class="shm-ways-panel shm-ways-chart" aria-labelledby="shm-ways-chart-title">
      <div class="shm-ways-section-head">
        <h4 id="shm-ways-chart-title" class="shm-ways-title">
          {{ i18n.t('consultant.ways.chartTitle') }}
        </h4>
        <span class="shm-ways-chart-legend">
          <span v-for="line in chart.lines" :key="line.kind" :class="`is-${line.kind}`">
            <span class="shm-ways-chart-swatch" :class="{ 'is-blocked': line.blocked }"></span>
            {{ wayNumber(line.kind) }} · {{ wayTitle(line.kind)
            }}{{ line.blocked ? ` – ${i18n.t('consultant.ways.badgeNotPossible')}` : '' }}
          </span>
        </span>
      </div>
      <svg
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
        width="100%"
        role="img"
        :aria-label="chart.aria"
      >
        <template v-if="chart.negative">
          <rect
            class="shm-ways-chart-negative"
            :x="CHART.left - 20"
            :y="chart.zero"
            :width="CHART.right - CHART.left + 40"
            :height="CHART.height - chart.zero"
          />
          <!-- At the left of the zone: the right end is the label of the last step ("after 24 h"). -->
          <text
            class="shm-ways-chart-negative-text"
            :x="CHART.left - 12"
            :y="CHART.height - 8"
            text-anchor="start"
          >
            {{ i18n.t('consultant.ways.chartNotEnough') }}
          </text>
          <line
            class="shm-ways-chart-axis"
            :x1="CHART.left - 20"
            :y1="chart.zero"
            :x2="CHART.right + 20"
            :y2="chart.zero"
          />
          <text
            class="shm-ways-chart-axis-text"
            :x="CHART.left - 28"
            :y="chart.zero + 4"
            text-anchor="end"
          >
            {{ usd(0) }}
          </text>
        </template>
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
          {{ i18n.t('consultant.ways.chartToday') }}
        </text>
        <g
          v-for="line in chart.lines"
          :key="line.kind"
          :class="['shm-ways-chart-line', `is-${line.kind}`, { 'is-blocked': line.blocked }]"
        >
          <polyline :points="line.points.map((point) => `${point.x},${point.y}`).join(' ')" />
          <circle v-for="(point, i) in line.points" :key="i" :cx="point.x" :cy="point.y" r="4" />
        </g>
        <text
          v-for="label in chart.labels"
          :key="label.key"
          class="shm-ways-chart-label"
          :class="`is-${label.kind}`"
          :x="label.x"
          :y="label.y"
          :text-anchor="label.x >= chart.last ? 'end' : 'middle'"
        >
          {{ label.text }}
        </text>
        <text
          class="shm-ways-chart-axis-text"
          :x="chart.last"
          :y="CHART.height - 8"
          text-anchor="end"
        >
          {{ i18n.t('consultant.ways.chartAfter') }}
        </text>
      </svg>
    </section>

    <!-- Before you start. -->
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
 * Colors by way: "buy first" in the accent, "melt first" in the warning color, in both themes;
 * the text on them as the theme has it.
 */
.shm-ways {
  --shm-way-buy: var(--shm-accent);
  --shm-way-melt: var(--shm-warning);
  --shm-way-on-buy: var(--shm-text-on-accent);
  --shm-way-on-melt: var(--shm-text-on-warning, #0b141c);
  --shm-ways-track: var(--shm-fill, rgb(var(--shm-accent-rgb) / 0.12));
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 16px;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
  line-height: 1.45;
}

.shm-ways .is-buy {
  --shm-way: var(--shm-way-buy);
  --shm-way-on: var(--shm-way-on-buy);
}

.shm-ways .is-melt {
  --shm-way: var(--shm-way-melt);
  --shm-way-on: var(--shm-way-on-melt);
}

.shm-ways .is-both {
  --shm-way: var(--shm-text);
  --shm-way-on: var(--shm-surface-elevated);
}

.shm-ways-mono {
  font-family: var(--shm-font-mono, inherit);
  font-variant-numeric: tabular-nums;
}

.shm-ways-muted {
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-faint {
  color: var(--shm-text-faint);
}

.shm-ways-strong {
  color: var(--shm-text-strong);
}

.shm-ways .is-gain {
  color: var(--shm-success);
}

.shm-ways .is-danger {
  color: var(--shm-danger);
}

.shm-ways .is-none {
  color: var(--shm-text-faint);
}

/* Panels: as the plan box of the table layout; the theme makes them grouped surfaces. */
.shm-ways-panel {
  padding: 16px 20px;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-cell);
}

.shm-ways-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shm-ways-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}

.shm-ways .shm-ways-title {
  margin: 0;
  color: var(--shm-text-strong);
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: 600;
}

/* Numbers in a square of the way's color. */
.shm-ways-num {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  box-sizing: border-box;
  color: var(--shm-way-on);
  font-size: calc(13px * var(--shm-font-scale));
  font-weight: 700;
  background: var(--shm-way);
  border-radius: var(--shm-radius-item);
}

/* ---- The result and the tiers ---- */

.shm-ways-top {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 8px;
}

.shm-ways-results,
.shm-ways-tiers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shm-ways-result {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.shm-ways-result-text {
  display: flex;
  flex-direction: column;
}

.shm-ways-result-title {
  font-weight: 500;
}

.shm-ways-result-value {
  color: var(--shm-way);
  font-size: calc(24px * var(--shm-font-scale));
  font-weight: 500;
  line-height: 1.3;
}

.shm-ways-result.is-both .shm-ways-result-value {
  color: var(--shm-success);
  font-size: calc(30px * var(--shm-font-scale));
}

.shm-ways-tier-head {
  display: flex;
  gap: 10px;
}

.shm-ways-tier-head .is-buy,
.shm-ways-tier-head .is-melt {
  color: var(--shm-way);
}

.shm-ways-tier-head .is-both {
  color: var(--shm-text-strong);
}

.shm-ways-tier-bars,
.shm-ways-tier-counts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.shm-ways-tier-bars {
  align-items: end;
}

.shm-ways-tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.shm-ways-tier-marks {
  display: flex;
  gap: 2px;
  min-height: 16px;
}

.shm-ways-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--shm-way-on);
  font-size: calc(10px * var(--shm-font-scale));
  font-weight: 700;
  background: var(--shm-way);
  border-radius: var(--shm-radius-small);
}

.shm-ways-tier-percent,
.shm-ways-tier-counts {
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
  line-height: 12px;
  text-align: center;
}

.shm-ways-tier-bar {
  width: 100%;
  background: var(--shm-fill-strong, rgb(var(--shm-accent-rgb) / 0.22));
  border-radius: 3px;
}

.shm-ways-tier.is-reached .shm-ways-tier-bar {
  background: var(--shm-text-secondary);
}

.shm-ways-tier.is-reached .shm-ways-tier-percent {
  color: var(--shm-text-strong);
}

/* A tier both ways reach can't happen (they'd be the same); a tier of one way in its color. */
.shm-ways-tier.is-buy .shm-ways-tier-bar {
  background: var(--shm-way-buy);
}

.shm-ways-tier.is-melt .shm-ways-tier-bar {
  background: var(--shm-way-melt);
}

.shm-ways-tier.is-buy .shm-ways-tier-percent,
.shm-ways-tier.is-melt .shm-ways-tier-percent {
  color: var(--shm-text-strong);
}

/* ---- The cart ---- */

.shm-ways-formulas {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-formulas .is-buy,
.shm-ways-formulas .is-melt,
.shm-ways-paint-prices .is-buy,
.shm-ways-paint-prices .is-melt {
  color: var(--shm-way);
}

/* RSI's own styles take the indent and the bullets off lists; `#billing .content ul` wins. */
.shm-ways .shm-ways-cart,
.shm-ways .shm-ways-notes,
.shm-ways .shm-way-steps {
  margin: 0 !important;
  padding: 0 !important;
  list-style: none !important;
}

.shm-ways-cart {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
}

.shm-ways .shm-ways-paint {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.12);
  border-radius: var(--shm-radius-group);
}

.shm-ways .shm-ways-paint.is-own {
  border-color: rgb(var(--shm-accent-rgb) / 0.4);
}

.shm-ways-paint-image {
  position: relative;
  display: block;
  height: 52px;
  overflow: hidden;
  background: var(--shm-ways-track);
  border-radius: var(--shm-radius-item);
}

.shm-ways-paint-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shm-ways-paint-image .shm-ways-tag {
  position: absolute;
  top: 4px;
  left: 4px;
}

.shm-ways-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
  line-height: 16px;
  border-radius: var(--shm-radius-small);
}

.shm-ways-tag .shm-icon {
  width: 9px;
  height: 9px;
}

.shm-ways-tag.is-own {
  color: var(--shm-surface-elevated);
  background: var(--shm-text-secondary);
}

.shm-ways-tag.is-filler {
  color: var(--shm-text);
  background: rgb(var(--shm-surface-rgb) / 0.85);
}

.shm-ways-paint-name {
  overflow: hidden;
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.shm-ways-paint-prices {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: calc(11px * var(--shm-font-scale));
  line-height: 14px;
}

.shm-ways-paint-prices > span {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.shm-ways-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ---- Why they differ ---- */

.shm-ways-why {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shm-ways-why-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-why-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 72px;
  align-items: center;
  gap: 12px;
}

.shm-ways-why-row > .is-buy,
.shm-ways-why-row > .is-melt,
.shm-ways-why-value.is-buy,
.shm-ways-why-value.is-melt {
  color: var(--shm-way);
}

.shm-ways-why-bar {
  position: relative;
  display: block;
  height: 14px;
  overflow: hidden;
  background: var(--shm-ways-track);
  border-radius: var(--shm-radius-small);
}

.shm-ways-why-solid,
.shm-ways-why-rest {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--shm-way);
}

.shm-ways-why-rest {
  right: 0;
}

/* The rest of the melt-first cart: missing (buying first isn't possible) or a lower tier. */
.shm-ways-why-rest.is-missing {
  background: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--shm-danger) 45%, transparent) 0 4px,
    transparent 4px 8px
  );
}

.shm-ways-why-rest.is-tier {
  background: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--shm-way-buy) 35%, transparent) 0 4px,
    transparent 4px 8px
  );
}

.shm-ways-why-value {
  text-align: right;
}

.shm-ways-why-scale {
  position: relative;
  display: block;
  height: 16px;
}

/* The store credit there is, as a dashed line across both bars. */
.shm-ways-why-marker {
  position: absolute;
  top: -52px;
  bottom: 14px;
  width: 0;
  border-left: 1px dashed var(--shm-text-strong);
}

.shm-ways-why-marker-text {
  position: absolute;
  top: 0;
  font-size: calc(11px * var(--shm-font-scale));
  line-height: 16px;
  white-space: nowrap;
  transform: translateX(-50%);
}

.shm-ways-why-texts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-why-texts strong {
  color: var(--shm-way);
  font-weight: 500;
}

/* ---- The ways ---- */

.shm-ways-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 8px;
}

.shm-ways .shm-way {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-color: color-mix(in srgb, var(--shm-way) 55%, transparent);
}

.shm-ways.is-same .shm-way.is-melt,
.shm-ways .shm-way.is-impossible {
  border-color: rgb(var(--shm-accent-rgb) / 0.12);
}

.shm-way-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shm-way-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.shm-way-title {
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-way-badge {
  padding: 0 6px;
  color: var(--shm-way);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 600;
  line-height: 16px;
  background: color-mix(in srgb, var(--shm-way) 16%, transparent);
  border-radius: var(--shm-radius-small);
}

.shm-way-badge.is-danger {
  color: var(--shm-danger);
  background: color-mix(in srgb, var(--shm-danger) 16%, transparent);
}

.shm-way-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-way-stat {
  color: var(--shm-way);
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: 500;
}

.shm-way-stats > span:last-child .shm-way-stat:not(.is-danger) {
  color: var(--shm-text-strong);
}

.shm-ways .shm-way-steps {
  display: flex;
  flex-direction: column;
}

.shm-ways .shm-way-steps li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.shm-way-steps li.is-faded {
  opacity: 0.4;
}

.shm-way-step-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: stretch;
}

.shm-way-step-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--shm-way);
  background: color-mix(in srgb, var(--shm-way) 14%, transparent);
  border-radius: var(--shm-radius-control);
}

.shm-way-steps li.is-blocked .shm-way-step-badge {
  color: var(--shm-danger);
  background: color-mix(in srgb, var(--shm-danger) 14%, transparent);
}

.shm-way-step-line {
  flex: 1;
  width: 1px;
  min-height: 12px;
  background: color-mix(in srgb, var(--shm-way) 40%, transparent);
}

.shm-way-step-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0 14px;
}

.shm-way-step-title {
  font-weight: 500;
}

.shm-way-step-amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding-top: 4px;
  font-size: calc(12px * var(--shm-font-scale));
  white-space: nowrap;
}

.shm-way-step-balance {
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-ways .shm-way-hint {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 0;
  padding: 10px 12px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  background: var(--shm-ways-track);
  border-radius: var(--shm-radius-control);
}

.shm-way-hint .shm-icon {
  flex: none;
  margin-top: 2px;
  color: var(--shm-way);
}

.shm-way.is-impossible .shm-way-hint .shm-icon {
  color: var(--shm-danger);
}

.shm-ways .shm-way-actions {
  align-items: stretch;
  margin-top: auto;
}

/* The buttons of a way span the card, a little taller than elsewhere. */
.shm-ways .shm-way-actions > .shm-button {
  justify-content: center;
  min-height: 36px;
}

/* The cart button of each way in its color, filled for the way that is recommended or works. */
html .shm-ways .shm-way .shm-way-actions .shm-button:not(.is-danger) {
  color: var(--shm-way-on);
  background: var(--shm-way);
  border-color: var(--shm-way);
}

html .shm-ways .shm-way .shm-way-actions .shm-button:not(.is-danger):disabled {
  color: var(--shm-text-faint);
  background: var(--shm-ways-track);
  border-color: transparent;
}

html .shm-ways .shm-way .shm-way-actions .shm-button:not(.is-danger):not(:disabled):hover,
html .shm-ways .shm-way .shm-way-actions .shm-button:not(.is-danger):not(:disabled):focus-visible {
  color: var(--shm-way-on);
  background: color-mix(in srgb, var(--shm-way) 85%, var(--shm-text-strong));
}

/* With the same result, melting first is no advantage: its button only tinted. */
html .shm-ways.is-same .shm-way.is-melt .shm-way-actions .shm-button:not(.is-danger) {
  color: var(--shm-way);
  background: color-mix(in srgb, var(--shm-way) 15%, transparent);
}

/* ---- The chart ---- */

.shm-ways-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shm-ways-chart svg {
  display: block;
  overflow: visible;
}

.shm-ways-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-chart-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shm-ways-chart-swatch {
  width: 14px;
  height: 0;
  border-top: 2.5px solid var(--shm-way);
}

.shm-ways-chart-swatch.is-blocked {
  border-top: 2px dashed var(--shm-danger);
}

.shm-ways-chart-axis {
  stroke: var(--shm-text-faint);
  stroke-width: 1;
}

.shm-ways-chart-axis.is-today {
  stroke-dasharray: 2 4;
}

.shm-ways-chart-axis-text {
  fill: var(--shm-text-muted);
  font-family: var(--shm-font-mono, inherit);
  font-size: 11px;
}

.shm-ways-chart-negative {
  fill: color-mix(in srgb, var(--shm-danger) 7%, transparent);
}

.shm-ways-chart-negative-text {
  fill: var(--shm-danger);
  font-size: 11px;
}

.shm-ways-chart-line polyline {
  fill: none;
  stroke: var(--shm-way);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.shm-ways-chart-line circle {
  fill: var(--shm-way);
}

.shm-ways-chart-line.is-blocked polyline {
  stroke: var(--shm-danger);
  stroke-width: 2;
  stroke-dasharray: 6 5;
}

.shm-ways-chart-line.is-blocked circle {
  fill: var(--shm-danger);
}

.shm-ways-chart-label {
  font-family: var(--shm-font-mono, inherit);
  font-size: 12px;
  fill: var(--shm-way);
}

.shm-ways-chart-label.is-both {
  fill: var(--shm-text-secondary);
}

/* ---- Before you start ---- */

.shm-ways-notes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
}

.shm-ways .shm-ways-notes li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-ways-notes .shm-icon {
  flex: none;
  margin-top: 2px;
  color: var(--shm-text-muted);
}

.shm-ways-notes a {
  color: var(--shm-accent);
}
</style>
