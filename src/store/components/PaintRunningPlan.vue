<script setup lang="ts">
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useNow } from '@/shared/use-now';
import { computed, ref } from 'vue';
import { planLinesOf, type RunStep } from '../paint-consultant/running-plan';
import {
  amountOf,
  paintsAtOf,
  shortDateOf,
  signedUsd,
  statusOf,
  stepSubOf,
  stepTitleOf,
  wayTitleOf,
} from '../paint-consultant/running-plan-texts';
import type { RunningPlanState } from '../paint-consultant/use-running-plan';
import PaintConfirm from './PaintConfirm.vue';
import PaintRunStepBody from './PaintRunStepBody.vue';

/*
 * The running plan of the Paint Discount Consultant as one card (#245): its way, since when, what
 * it gains, a rail of its steps and the steps in order – done, to do now, waiting for RSI's
 * cooldown, or next –, the ones to do now with what they need. It can be discarded (after asking);
 * that melts, buys or changes nothing.
 */

const props = defineProps<{
  running: RunningPlanState;
  pledges: readonly PledgeView[];
}>();

const now = useNow();
const view = computed(() => props.running.view.value!);
const format = computed(() => ({ locale: locale.value, now: now.value }));
const planLines = computed(() =>
  props.running.plan.value ? planLinesOf(props.running.plan.value) : [],
);

const title = computed(() => i18n.t('consultant.run.title', [wayTitleOf(view.value.way)]));
const summary = computed(() =>
  i18n.t('consultant.run.summary', [
    paintsAtOf(view.value.ownCount + view.value.fillerCount, view.value.tier.percent, format.value),
    i18n.t('consultant.run.stepsDone', [view.value.doneCount, view.value.steps.length]),
  ]),
);

const ICON = { done: 'check', next: 'lock', wait: 'clock-rotate-left' } as const;
/** The dot of a step: a check when done, what it does when it is to do now. */
const iconOf = (step: RunStep) => {
  if (step.state !== 'current') return ICON[step.state];
  return step.body?.actions.some((action) => action.kind === 'melt') ? 'recycle' : 'arrow-right';
};
/** Store credit gained by a step to do now stands out; the rest is quiet. */
const amountClass = (step: RunStep) =>
  step.state !== 'current' ? 'is-quiet' : step.signed && step.amount > 0 ? 'is-gain' : 'is-strong';

const confirming = ref(false);
async function discard() {
  confirming.value = false;
  await props.running.discard();
}
</script>

<template>
  <section class="shm-run" :class="`is-${view.way}`" aria-labelledby="shm-run-title">
    <header class="shm-run-head">
      <div class="shm-run-head-title">
        <span class="shm-ways-num shm-run-num">{{ view.way === 'buy' ? 1 : 2 }}</span>
        <h4 id="shm-run-title" class="shm-run-title">{{ title }}</h4>
        <span class="shm-run-since">
          {{ i18n.t('consultant.run.since', [shortDateOf(view.since, format)]) }}
        </span>
      </div>
      <div class="shm-run-result">
        <span class="shm-run-result-value shm-ways-mono" :class="{ 'is-gain': view.result > 0 }">{{
          signedUsd(view.result, format)
        }}</span>
        <span class="shm-run-result-label">{{ i18n.t('consultant.run.resultLabel') }}</span>
      </div>
      <p class="shm-run-summary">{{ summary }}</p>
    </header>

    <div
      class="shm-run-rail"
      aria-hidden="true"
      :style="{ '--shm-run-steps': String(view.steps.length) }"
    >
      <span
        v-for="(step, i) in view.steps"
        :key="i"
        class="shm-run-rail-part"
        :class="`is-${step.state}`"
      ></span>
    </div>

    <ol class="shm-run-steps" :aria-label="i18n.t('consultant.run.stepsLabel')">
      <li
        v-for="step in view.steps"
        :key="step.kind"
        class="shm-run-step"
        :class="[`is-${step.state}`, { 'has-body': !!step.body }]"
        :aria-current="step.ariaCurrent ? 'step' : undefined"
      >
        <span class="shm-run-dot"><SvgIcon :name="iconOf(step)" /></span>
        <span class="shm-run-step-text">
          <span class="shm-run-step-title">{{ stepTitleOf(step) }}</span>
          <span class="shm-run-step-sub">{{ stepSubOf(step, view, format) }}</span>
        </span>
        <span class="shm-run-step-figures">
          <span class="shm-run-step-amount shm-ways-mono" :class="amountClass(step)">{{
            amountOf(step, format)
          }}</span>
          <span class="shm-run-step-status">{{ statusOf(step.status, format) }}</span>
        </span>
        <PaintRunStepBody
          v-if="step.body"
          :step="step"
          :view="view"
          :running="running"
          :pledges="pledges"
          :plan-lines="planLines"
          :now="now"
          @discard="confirming = true"
        />
      </li>
    </ol>

    <footer class="shm-run-foot">
      <div class="shm-run-foot-row">
        <span>{{ i18n.t('consultant.run.footer') }}</span>
        <button
          type="button"
          class="shm-run-discard"
          :aria-expanded="confirming"
          @click="confirming = true"
        >
          {{ i18n.t('consultant.run.discard') }}
        </button>
      </div>
      <PaintConfirm
        v-if="confirming"
        :message="i18n.t('consultant.run.discardConfirm')"
        :confirm="i18n.t('consultant.run.discard')"
        @confirm="discard"
        @cancel="confirming = false"
      />
    </footer>
  </section>
</template>

<style>
/*
 * The running plan (#245) in the way's color: "buy first" in the accent, "melt first" in the
 * warning color, as the ways of a new plan. These are the styles of "Classic RSI"; "Modern Hangar"
 * adjusts them in modern.css.
 */
.shm-run,
.shm-completed {
  --shm-way-buy: var(--shm-accent);
  --shm-way-melt: var(--shm-warning);
  --shm-way-on-buy: var(--shm-text-on-accent);
  --shm-way-on-melt: var(--shm-text-on-warning, #0b141c);
  --shm-ways-track: var(--shm-fill, rgb(var(--shm-accent-rgb) / 0.12));
  --shm-run-separator: var(--shm-separator, rgb(var(--shm-accent-rgb) / 0.12));
}

.shm-run.is-buy,
.shm-completed .is-buy {
  --shm-way: var(--shm-way-buy);
  --shm-way-on: var(--shm-way-on-buy);
}

.shm-run.is-melt,
.shm-completed .is-melt {
  --shm-way: var(--shm-way-melt);
  --shm-way-on: var(--shm-way-on-melt);
}

.shm-run {
  display: flex;
  flex-direction: column;
  margin-top: 16px;
  overflow: hidden;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
  line-height: 1.45;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid color-mix(in srgb, var(--shm-way) 55%, transparent);
  border-radius: var(--shm-radius-cell);
}

.shm-run .is-gain {
  color: var(--shm-success);
}

/* ---- Head ---- */

.shm-run-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 16px;
  padding: 16px 18px 14px;
}

.shm-run-head-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
}

.shm-run .shm-run-num {
  min-width: 22px;
  height: 22px;
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-run .shm-run-title {
  /* Below RSI's fixed top bar when scrolled to from the sidebar. */
  scroll-margin-top: 90px;
  margin: 0;
  color: var(--shm-text-strong);
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-run-since {
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-run-result {
  display: flex;
  flex-direction: column;
  grid-row: span 2;
  align-items: flex-end;
}

.shm-run-result-value {
  color: var(--shm-text-strong);
  font-size: calc(20px * var(--shm-font-scale));
  font-weight: 500;
  line-height: 1.3;
}

.shm-run-result-label {
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-run .shm-run-summary {
  margin: 0;
  color: var(--shm-text-secondary);
}

/* ---- Rail ---- */

.shm-run-rail {
  display: grid;
  grid-template-columns: repeat(var(--shm-run-steps), minmax(0, 1fr));
  gap: 4px;
  padding: 0 18px 16px;
}

.shm-run-rail-part {
  height: 4px;
  background: var(--shm-ways-track);
  border-radius: 0;
}

.shm-run-rail-part.is-done {
  background: var(--shm-success);
}

.shm-run-rail-part.is-current {
  background: var(--shm-way);
}

.shm-run-rail-part.is-wait {
  background: var(--shm-text-faint);
}

/* ---- Steps ---- */

/* RSI's own styles take the indent and the bullets off lists; `#billing .content ol` wins. */
.shm-run .shm-run-steps,
.shm-run .shm-run-checks,
.shm-run .shm-run-paints {
  margin: 0 !important;
  padding: 0 !important;
  list-style: none !important;
}

.shm-run-steps {
  border-top: 1px solid var(--shm-run-separator);
}

.shm-run .shm-run-step {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 0 14px;
  margin: 0;
  padding: 14px 18px;
}

.shm-compact .shm-run .shm-run-step {
  padding-top: 10px;
  padding-bottom: 10px;
}

.shm-run .shm-run-step + .shm-run-step {
  border-top: 1px solid var(--shm-run-separator);
}

.shm-run-step.is-current,
.shm-run-step.is-wait.has-body {
  background: rgb(var(--shm-accent-rgb) / 0.06);
}

.shm-run-dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 12px;
  color: var(--shm-text-faint);
  border-radius: var(--shm-radius-pill);
  box-shadow: inset 0 0 0 1px rgb(var(--shm-accent-rgb) / 0.35);
}

.shm-run-step.is-done .shm-run-dot {
  color: var(--shm-success);
  background: rgb(var(--shm-success-rgb) / 0.16);
  box-shadow: none;
}

.shm-run-step.is-current .shm-run-dot {
  color: var(--shm-way-on);
  background: var(--shm-way);
  box-shadow: none;
}

.shm-run-step-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: 26px;
}

.shm-run-step-title {
  color: var(--shm-text);
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-run-step.is-done .shm-run-step-title {
  color: var(--shm-text-secondary);
  font-weight: 500;
}

.shm-run-step.is-next .shm-run-step-title {
  color: var(--shm-text-secondary);
  font-weight: 500;
}

.shm-run-step-sub {
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-run-step-figures {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  min-height: 26px;
  white-space: nowrap;
}

.shm-run-step-amount {
  font-size: calc(14px * var(--shm-font-scale));
  font-weight: 600;
}

.shm-run-step-amount.is-quiet {
  color: var(--shm-text-secondary);
}

.shm-run-step-amount.is-strong {
  color: var(--shm-text-strong);
}

.shm-run-step-status {
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
}

/* ---- Body of a step to do now ---- */

.shm-run-body {
  display: flex;
  grid-column: 2 / 4;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin-top: 12px;
}

.shm-run-countdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: rgb(var(--shm-accent-rgb) / 0.05);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-group);
}

.shm-run-countdown-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

.shm-run-countdown-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}

.shm-run-countdown-left {
  color: var(--shm-text-strong);
  font-size: calc(22px * var(--shm-font-scale));
  font-weight: 500;
  line-height: 1.25;
}

.shm-run-countdown-text,
.shm-run-countdown-at {
  color: var(--shm-text-secondary);
}

.shm-run-countdown-at {
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-run-bar {
  display: block;
  height: 4px;
  overflow: hidden;
  background: rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: 0;
}

.shm-run-bar-fill {
  display: block;
  height: 100%;
  background: var(--shm-accent);
  transform-origin: left;
  transition: transform 0.6s ease;
}

.shm-run-countdown-note {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-run-countdown-note .shm-icon {
  color: var(--shm-accent);
}

.shm-run-checks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.shm-run .shm-run-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--shm-radius-group);
}

.shm-run-check > .shm-icon {
  flex: none;
  margin-top: 3px;
  font-size: 14px;
}

.shm-run-check.is-ok {
  background: rgb(var(--shm-success-rgb) / 0.08);
  border-color: rgb(var(--shm-success-rgb) / 0.4);
}

.shm-run-check.is-ok > .shm-icon {
  color: var(--shm-success);
}

.shm-run-check.is-warning {
  background: color-mix(in srgb, var(--shm-warning) 8%, transparent);
  border-color: color-mix(in srgb, var(--shm-warning) 40%, transparent);
}

.shm-run-check.is-warning > .shm-icon {
  color: var(--shm-warning);
}

.shm-run-check.is-unknown {
  background: rgb(var(--shm-accent-rgb) / 0.05);
  border-color: rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-run-check.is-unknown > .shm-icon {
  color: var(--shm-text-secondary);
}

.shm-run-check-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shm-run-check-title {
  font-weight: 600;
}

.shm-run-check-sub {
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.shm-run-paints {
  display: flex;
  flex-direction: column;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.12);
  border-radius: var(--shm-radius-group);
}

.shm-run .shm-run-paint {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) minmax(56px, auto) minmax(70px, auto);
  align-items: center;
  gap: 10px;
  min-height: 34px;
  margin: 0;
  padding: 0 12px;
}

.shm-run .shm-run-paint + .shm-run-paint {
  border-top: 1px solid var(--shm-run-separator);
}

.shm-run-paint > .shm-icon {
  font-size: 12px;
}

.shm-run-paint.is-ok > .shm-icon {
  color: var(--shm-success);
}

.shm-run-paint.is-missing > .shm-icon,
.shm-run-paint.is-melt > .shm-icon {
  color: var(--shm-warning);
}

.shm-run-paint.is-wait > .shm-icon {
  color: var(--shm-text-faint);
}

.shm-run-paint-name {
  overflow: hidden;
  color: var(--shm-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.shm-run-paint.is-missing .shm-run-paint-name {
  color: color-mix(in srgb, var(--shm-warning) 50%, var(--shm-text));
}

.shm-run-paint-count {
  color: var(--shm-text-secondary);
}

.shm-run-paint-was,
.shm-run-paint-value {
  text-align: right;
  white-space: nowrap;
}

.shm-run-paint-was {
  color: var(--shm-text-secondary);
}

.shm-run-paint-value {
  color: var(--shm-text);
}

.shm-run-paint.is-missing .shm-run-paint-value {
  color: var(--shm-warning);
}

/* The filler tag as the consultant's other tags in this theme: outlined. */
.shm-run .shm-run-filler {
  margin-left: 6px;
  color: var(--shm-text-muted);
  font-size: calc(10px * var(--shm-font-scale));
  background: transparent;
  box-shadow: inset 0 0 0 1px currentColor;
  border-radius: var(--shm-radius-tag);
}

.shm-run .shm-run-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-run-note .shm-icon {
  flex: none;
  margin-top: 2px;
}

.shm-run-note:is(.is-notFound, .is-unavailable, .is-cartUnread) .shm-icon {
  color: var(--shm-warning);
}

.shm-run-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.shm-run-actions > .shm-button {
  min-height: 36px;
  padding: 0 14px;
}

.shm-run-actions > .shm-button:not(.shm-run-ghost) {
  flex: 1 1 220px;
  gap: 8px;
}

/* Its notes (an occupied cart, refused paints) below the buttons. */
.shm-run-actions > .shm-consultant-note {
  flex: 1 0 100%;
  margin: 0;
}

/* The main button in the way's color, as on the ways of a new plan. */
html .shm-run .shm-run-actions > .shm-button:not(.shm-run-ghost):not(.is-danger) {
  color: var(--shm-way-on);
  background: var(--shm-way);
  border-color: var(--shm-way);
}

html .shm-run .shm-run-actions > .shm-button:not(.shm-run-ghost):not(.is-danger):disabled {
  color: var(--shm-text-faint);
  background: var(--shm-ways-track);
  border-color: transparent;
}

html
  .shm-run
  .shm-run-actions
  > .shm-button:not(.shm-run-ghost):not(.is-danger):not(:disabled):hover,
html
  .shm-run
  .shm-run-actions
  > .shm-button:not(.shm-run-ghost):not(.is-danger):not(:disabled):focus-visible {
  color: var(--shm-way-on);
  background: color-mix(in srgb, var(--shm-way) 85%, var(--shm-text-strong));
}

.shm-run-actions > .shm-button:not(:disabled):active {
  transform: scale(0.98);
}

.shm-run-actions > .shm-button {
  transition:
    transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
    background-color 160ms ease;
}

.shm-run .shm-run-bulk {
  margin: -6px 0 0;
  color: var(--shm-text-faint);
  font-size: calc(11px * var(--shm-font-scale));
}

/* ---- Footer ---- */

.shm-run-foot {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 18px;
  color: var(--shm-text-faint);
  font-size: calc(12px * var(--shm-font-scale));
  border-top: 1px solid var(--shm-run-separator);
}

.shm-run-foot-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}

.shm-run .shm-run-discard {
  padding: 0;
  color: var(--shm-text-secondary);
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-run .shm-run-discard:hover {
  color: var(--shm-text);
  text-decoration: underline;
}

.shm-run .shm-run-discard:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: 2px;
}

.shm-run-foot .shm-consultant-note {
  margin: 0;
}

.shm-run .shm-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .shm-run-bar-fill,
  .shm-run-actions > .shm-button {
    transition: none;
  }

  .shm-run-actions > .shm-button:not(:disabled):active {
    transform: none;
  }
}
</style>
