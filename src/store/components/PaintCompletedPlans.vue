<script setup lang="ts">
import { PAINT_DISCOUNT_TIERS } from '@/config';
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { computed, ref } from 'vue';
import type { CompletedPaint, CompletedPaintPlan } from '../paint-consultant/completed-plans';
import { paintsAtOf, signedUsd, wayTitleOf } from '../paint-consultant/running-plan-texts';

/*
 * The plans of the Paint Discount Consultant that ended on their own (#245), newest first: what
 * each gained at a glance, and opened what was melted and bought, the discount reached and the
 * store credit and melt value before and after. Which ones are open is kept only while shown; the
 * newest one starts open.
 */

const props = defineProps<{ plans: readonly CompletedPaintPlan[] }>();

const format = computed(() => ({ locale: locale.value, now: 0 }));
const usd = (value: number) => formatUsd(value, locale.value);
const percent = (value: number) => formatPercent(value, locale.value);
const change = (from: string, to: string) => i18n.t('consultant.discountChange', [from, to]);

const keyOf = (plan: CompletedPaintPlan) => `${plan.way}-${plan.startedAt}`;
/** Opened or closed by the user; untouched, only the newest one is open. */
const toggled = ref(new Map<string, boolean>());
const isOpen = (plan: CompletedPaintPlan, index: number) =>
  toggled.value.get(keyOf(plan)) ?? index === 0;
function toggle(plan: CompletedPaintPlan, index: number) {
  const next = new Map(toggled.value);
  next.set(keyOf(plan), !isOpen(plan, index));
  toggled.value = next;
}

const total = computed(() => {
  const sum = Math.round(props.plans.reduce((acc, plan) => acc + plan.result * 100, 0)) / 100;
  const result = signedUsd(sum, format.value);
  return props.plans.length === 1
    ? i18n.t('consultant.completed.totalOne', [result])
    : i18n.t('consultant.completed.total', [props.plans.length, result]);
});

const dates = computed(
  () => new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', year: 'numeric' }),
);

function metaOf(plan: CompletedPaintPlan) {
  const parts = [dates.value.formatRange(plan.startedAt, plan.completedAt)];
  parts.push(
    plan.ownCount === 1
      ? i18n.t('consultant.completed.ownOne')
      : i18n.t('consultant.completed.own', [plan.ownCount]),
  );
  if (plan.fillerCount) {
    parts.push(
      plan.fillerCount === 1
        ? i18n.t('consultant.completed.fillersOne')
        : i18n.t('consultant.completed.fillers', [plan.fillerCount]),
    );
  }
  return parts.join(' · ');
}

/** The volume discount tiers, the reached one highlighted (as the cart of a new plan shows them). */
function tiersOf(plan: CompletedPaintPlan) {
  return PAINT_DISCOUNT_TIERS.tiers.map((tier, i) => ({
    percent: tier.percent,
    chosen: tier.percent === plan.tier.percent,
    height: `${14 + i * 6}px`,
  }));
}

const columnsOf = (plan: CompletedPaintPlan) => [
  {
    key: 'melted',
    title: i18n.t('consultant.completed.melted'),
    icon: 'recycle' as const,
    items: plan.melted,
    gain: true,
    totalLabel: i18n.t('consultant.completed.freed'),
    total: signedUsd(plan.freed, format.value),
  },
  {
    key: 'bought',
    title: i18n.t('consultant.completed.bought'),
    icon: 'basket-shopping' as const,
    items: plan.bought,
    gain: false,
    totalLabel: i18n.t('consultant.completed.paid'),
    total: signedUsd(-plan.paid, format.value),
  },
];

const valueOf = (paint: CompletedPaint, gain: boolean) =>
  gain ? signedUsd(paint.value, format.value) : usd(paint.value);
</script>

<template>
  <section class="shm-completed" aria-labelledby="shm-completed-title">
    <div class="shm-completed-head">
      <h4 id="shm-completed-title" class="shm-completed-title">
        {{ i18n.t('consultant.completed.title') }}
      </h4>
      <span class="shm-completed-total shm-ways-mono">{{ total }}</span>
    </div>
    <ul class="shm-completed-list">
      <li
        v-for="(plan, index) in plans"
        :key="keyOf(plan)"
        class="shm-completed-plan"
        :class="[`is-${plan.way}`, { 'is-open': isOpen(plan, index) }]"
      >
        <h5 class="shm-completed-plan-heading">
          <button
            type="button"
            class="shm-completed-toggle"
            :aria-expanded="isOpen(plan, index)"
            :aria-controls="`shm-completed-${keyOf(plan)}`"
            @click="toggle(plan, index)"
          >
            <span class="shm-completed-check"><SvgIcon name="check" /></span>
            <span class="shm-completed-plan-title">
              {{ paintsAtOf(plan.ownCount + plan.fillerCount, plan.tier.percent, format) }}
              <span class="shm-way-badge">{{ wayTitleOf(plan.way) }}</span>
            </span>
            <span class="shm-completed-result">
              <span class="shm-ways-mono" :class="{ 'is-gain': plan.result > 0 }">{{
                signedUsd(plan.result, format)
              }}</span>
              <span class="shm-completed-result-label">{{
                i18n.t('consultant.completed.resultLabel')
              }}</span>
            </span>
            <SvgIcon name="chevron-down" class="shm-completed-chevron" />
            <span class="shm-completed-meta">{{ metaOf(plan) }}</span>
          </button>
        </h5>
        <div
          v-if="isOpen(plan, index)"
          :id="`shm-completed-${keyOf(plan)}`"
          class="shm-completed-body"
        >
          <section
            v-for="column in columnsOf(plan)"
            :key="column.key"
            class="shm-completed-col"
            :aria-label="column.title"
          >
            <h6 class="shm-completed-col-title">
              <SvgIcon :name="column.icon" />
              {{ column.title }}
            </h6>
            <ul class="shm-completed-items">
              <li v-for="(paint, i) in column.items" :key="i" class="shm-completed-item">
                <span class="shm-completed-item-name">
                  <span v-if="paint.count > 1" class="shm-completed-item-count shm-ways-mono">{{
                    i18n.t('consultant.run.count', [paint.count])
                  }}</span>
                  {{ paint.name }}
                </span>
                <span class="shm-ways-mono" :class="{ 'is-gain': column.gain }">{{
                  valueOf(paint, column.gain)
                }}</span>
              </li>
            </ul>
            <div class="shm-completed-col-total">
              <span>{{ column.totalLabel }}</span>
              <span class="shm-ways-mono" :class="{ 'is-gain': column.gain }">{{
                column.total
              }}</span>
            </div>
          </section>
          <div class="shm-completed-facts">
            <span class="shm-completed-col-title">{{
              i18n.t('consultant.completed.discount')
            }}</span>
            <div
              class="shm-choose-tiers shm-completed-tiers"
              role="img"
              :aria-label="
                i18n.t('consultant.completed.tierAria', [
                  percent(plan.tier.percent),
                  plan.tier.paints,
                ])
              "
            >
              <span
                v-for="tier in tiersOf(plan)"
                :key="tier.percent"
                class="shm-choose-tier"
                :class="{ 'is-chosen': tier.chosen }"
              >
                <span class="shm-ways-mono shm-choose-tier-percent">{{
                  percent(tier.percent)
                }}</span>
                <span class="shm-choose-tier-bar" :style="{ height: tier.height }"></span>
              </span>
            </div>
            <dl class="shm-completed-fact-list">
              <div v-if="plan.creditBefore !== undefined && plan.creditAfter !== undefined">
                <dt>{{ i18n.t('consultant.choose.credit') }}</dt>
                <dd class="shm-ways-mono">
                  {{ change(usd(plan.creditBefore), usd(plan.creditAfter)) }}
                </dd>
              </div>
              <div>
                <dt>
                  {{
                    plan.ownCount === 1
                      ? i18n.t('consultant.completed.meltValueOne')
                      : i18n.t('consultant.completed.meltValue', [plan.ownCount])
                  }}
                </dt>
                <dd class="shm-ways-mono is-muted">
                  {{ change(usd(plan.meltBefore), usd(plan.meltAfter)) }}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<style>
/* Completed plans (#245): closed cards, opened what each melted and bought. "Classic RSI" here. */
.shm-completed {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
  line-height: 1.45;
}

.shm-completed .is-gain {
  color: var(--shm-success);
}

.shm-completed-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  padding: 0 2px;
}

/* As the headings of the warbond CCUs. */
.shm-completed .shm-completed-title {
  margin: 0;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-completed-total {
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
}

/* RSI's own styles take the indent and the bullets off lists; `#billing .content ul` wins. */
.shm-completed .shm-completed-list,
.shm-completed .shm-completed-items {
  display: flex;
  flex-direction: column;
  margin: 0 !important;
  padding: 0 !important;
  list-style: none !important;
}

.shm-completed-list {
  gap: 8px;
}

.shm-completed .shm-completed-plan {
  margin: 0;
  overflow: hidden;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-cell);
}

.shm-completed .shm-completed-plan-heading {
  margin: 0;
  font: inherit;
}

.shm-completed .shm-completed-toggle {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 14px;
  align-items: center;
  gap: 2px 12px;
  width: 100%;
  padding: 12px 16px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
  transition: background-color 120ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .shm-completed .shm-completed-toggle:hover {
    background: rgb(var(--shm-accent-rgb) / 0.06);
  }
}

.shm-completed .shm-completed-toggle:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: -2px;
}

.shm-completed-check {
  display: flex;
  grid-row: span 2;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: var(--shm-success);
  font-size: 11px;
  background: rgb(var(--shm-success-rgb) / 0.16);
  border-radius: var(--shm-radius-pill);
}

.shm-completed-plan-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-completed-result {
  display: flex;
  flex-direction: column;
  grid-row: span 2;
  align-items: flex-end;
  font-size: calc(16px * var(--shm-font-scale));
  font-weight: 500;
}

.shm-completed-result-label {
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: normal;
}

.shm-completed .shm-completed-chevron {
  grid-row: span 2;
  width: 11px;
  height: 11px;
  color: var(--shm-text-faint);
  transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.shm-completed-plan.is-open .shm-completed-chevron {
  transform: rotate(180deg);
}

.shm-completed-meta {
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-completed-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  padding: 0 16px 16px;
  animation: shm-completed-in 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

@keyframes shm-completed-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.shm-completed-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.12);
  border-radius: var(--shm-radius-group);
}

.shm-completed .shm-completed-col-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 10px 12px 6px;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-completed .shm-completed-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin: 0;
  padding: 5px 12px;
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-completed-item-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.shm-completed-item-count {
  color: var(--shm-text-faint);
}

.shm-completed-col-total {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding: 8px 12px 10px;
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: 600;
  border-top: 1px solid var(--shm-separator, rgb(var(--shm-accent-rgb) / 0.12));
}

.shm-completed-facts {
  --shm-way: var(--shm-success);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  background: rgb(var(--shm-success-rgb) / 0.08);
  border-radius: var(--shm-radius-group);
}

.shm-completed-facts .shm-completed-col-title {
  padding: 0;
}

.shm-completed .shm-completed-tiers {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.shm-completed .shm-completed-fact-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.shm-completed-fact-list dt {
  color: var(--shm-text-secondary);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-completed-fact-list dd {
  margin: 0;
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-completed-fact-list dd.is-muted {
  color: var(--shm-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .shm-completed .shm-completed-toggle,
  .shm-completed .shm-completed-chevron {
    transition: none;
  }

  .shm-completed-body {
    animation: none;
  }
}
</style>
