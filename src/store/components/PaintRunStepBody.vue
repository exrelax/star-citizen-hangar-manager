<script setup lang="ts">
import { RSI_CART_PATH } from '@/buyback/cart';
import { useDemoContext } from '@/demo/use-demo';
import BulkExchangeOverlay from '@/hangar/components/BulkExchangeOverlay.vue';
import { formatTimeLeft } from '@/hangar/melt-marks';
import { openTabAt } from '@/hangar/open-tab-at';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { BULK_MELTING_SETTING_ID } from '@/settings/anchors';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import type { PaintCartLine } from '../paint-consultant/cart';
import type {
  RunAction,
  RunPaintRow,
  RunStep,
  RunningPlanView,
} from '../paint-consultant/running-plan';
import {
  actionLabelOf,
  checkOf,
  dateTimeOf,
  noteOf,
  reasonOf,
  signedUsd,
} from '../paint-consultant/running-plan-texts';
import { formatUsd } from '@/hangar/discount-format';
import type { RunningPlanState } from '../paint-consultant/use-running-plan';
import PaintCartButton from './PaintCartButton.vue';

/*
 * What a step of the running plan offers now (#245): RSI's cooldown with its countdown, the
 * checks of the cart and the store credit, the paints of the step, a note and its buttons. Filling
 * the cart adds only what is missing; paying opens RSI's cart (never checks out); melting opens
 * the bulk melting dialog as the consultant always did, or points to its setting while it is off.
 */

const props = defineProps<{
  step: RunStep;
  view: RunningPlanView;
  running: RunningPlanState;
  /** The hangar's pledges, for the bulk melting dialog. */
  pledges: readonly PledgeView[];
  /** All paints of the plan, as cart lines. */
  planLines: readonly PaintCartLine[];
  now: number;
}>();
const emit = defineEmits<{ discard: [] }>();

const demo = useDemoContext();
const format = computed(() => ({ locale: locale.value, now: props.now }));
const body = computed(() => props.step.body!);
const usd = (value: number) => formatUsd(value, locale.value);

// ---- Countdown of RSI's cooldown ----

const countdown = computed(() => {
  const { countdown } = body.value;
  if (!countdown) return undefined;
  const span = countdown.endsAt - countdown.startedAt;
  const elapsed = Math.min(1, Math.max(0, (props.now - countdown.startedAt) / (span || 1)));
  return {
    left: formatTimeLeft(countdown.endsAt - props.now, locale.value),
    at: dateTimeOf(countdown.endsAt, format.value),
    fraction: elapsed,
    percent: Math.round(elapsed * 100),
  };
});

// ---- Rows ----

const checks = computed(() =>
  body.value.checks.map((check) => ({
    check,
    ...checkOf(check, props.step, format.value),
  })),
);
const note = computed(() => body.value.note && noteOf(body.value.note, format.value));

const ROW_ICON = {
  ok: 'check',
  missing: 'xmark',
  melt: 'recycle',
  wait: 'clock-rotate-left',
} as const;
/** Rows to melt show what melting gives; rows of the cart what they cost there. */
const isMeltRow = (row: RunPaintRow) => row.pledgeIds.length > 0;
/** One own paint to melt needs no count. */
const showsCount = (row: RunPaintRow) => !(isMeltRow(row) && !row.filler && row.count === 1);

// ---- Actions ----

const ghosts = computed(() => body.value.actions.filter((action) => action.role === 'ghost'));
const cta = computed(() => body.value.actions.find((action) => action.role === 'cta'));
const total = computed(() => props.view.ownCount + props.view.fillerCount);

function openCart() {
  if (!window.open(RSI_CART_PATH, '_blank')) location.assign(RSI_CART_PATH);
}

const busy = ref(false);
async function ghost(action: RunAction) {
  if (action.kind === 'discard') {
    emit('discard');
    return;
  }
  busy.value = true;
  try {
    if (action.kind === 'readCart') await props.running.refreshCart();
    else if (action.kind === 'readCredit') await props.running.refreshCredit();
    else if (action.kind === 'recalculate') await props.running.recalculate();
  } finally {
    busy.value = false;
  }
}

/** The pledges the melt button melts, as the hangar has them. */
const meltPledges = computed(() => {
  const action = cta.value;
  if (action?.kind !== 'melt') return [];
  const ids = new Set(action.pledgeIds);
  return props.pledges.filter((pledge) => ids.has(pledge.id) && pledge.isMeltable);
});
/**
 * The demo shows the dialog as the consultant always did, but melts nothing there
 * (`BulkExchangeOverlay`); a button that waits for RSI's cooldown stays disabled.
 */
const canMelt = computed(() => {
  const action = cta.value;
  if (action?.kind !== 'melt' || !meltPledges.value.length) return false;
  return action.enabled || (!!demo.value && props.step.state === 'current');
});
const melting = ref(false);
async function exchanged(ids: number[]) {
  await props.running.recordMelted(ids);
}
/** Melting before buying again (way 2) needs its own acknowledgement, as before (#168). */
const extraConsent = computed(() =>
  cta.value?.kind === 'melt' && cta.value.target === 'own'
    ? i18n.t('consultant.meltFirstConsent')
    : undefined,
);

const openBulkMeltingSetting = () =>
  openTabAt('settings', BULK_MELTING_SETTING_ID, { highlight: true });

/** After the cart was filled, it is read again to check it. */
const filled = () => void props.running.refreshCart();
</script>

<template>
  <div class="shm-run-body">
    <div v-if="countdown" class="shm-run-countdown">
      <div class="shm-run-countdown-head">
        <span class="shm-run-countdown-main">
          <span class="shm-run-countdown-left shm-ways-mono">{{ countdown.left }}</span>
          <span class="shm-run-countdown-text">{{ i18n.t('consultant.run.untilMelt') }}</span>
        </span>
        <span class="shm-run-countdown-at shm-ways-mono">{{ countdown.at }}</span>
      </div>
      <span
        class="shm-run-bar"
        role="progressbar"
        :aria-label="i18n.t('consultant.run.cooldownLabel')"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="countdown.percent"
        :aria-valuetext="countdown.left"
      >
        <span
          class="shm-run-bar-fill"
          :style="{ transform: `scaleX(${countdown.fraction})` }"
        ></span>
      </span>
      <span class="shm-run-countdown-note">
        <SvgIcon name="bell" />
        {{ i18n.t('consultant.run.countdownNote') }}
      </span>
    </div>

    <ul v-if="checks.length" class="shm-run-checks">
      <li
        v-for="{ check, title, sub } in checks"
        :key="check.kind"
        class="shm-run-check"
        :class="check.ok === true ? 'is-ok' : check.ok === false ? 'is-warning' : 'is-unknown'"
      >
        <SvgIcon
          :name="
            check.ok === true
              ? 'circle-check'
              : check.ok === false
                ? 'triangle-exclamation'
                : 'circle-info'
          "
        />
        <span class="shm-run-check-text">
          <span class="shm-run-check-title">{{ title }}</span>
          <span v-if="sub" class="shm-run-check-sub">{{ sub }}</span>
        </span>
      </li>
    </ul>

    <ul v-if="body.paints.length" class="shm-run-paints">
      <li
        v-for="row in body.paints"
        :key="row.key"
        v-tooltip="row.reason ? reasonOf(row.reason) : undefined"
        class="shm-run-paint"
        :class="`is-${row.state}`"
      >
        <SvgIcon :name="ROW_ICON[row.state]" />
        <span class="shm-run-paint-name">
          <span v-if="showsCount(row)" class="shm-run-paint-count shm-ways-mono">{{
            i18n.t('consultant.run.count', [row.count])
          }}</span>
          {{ row.name }}
          <span v-if="row.filler" class="shm-ways-tag is-filler shm-run-filler">{{
            i18n.t('consultant.fillerTag')
          }}</span>
          <span v-if="row.reason" class="shm-visually-hidden">({{ reasonOf(row.reason) }})</span>
        </span>
        <span class="shm-run-paint-was shm-ways-mono">{{
          row.was !== undefined ? usd(row.was) : ''
        }}</span>
        <span class="shm-run-paint-value shm-ways-mono">{{
          isMeltRow(row) ? signedUsd(row.value, format) : usd(row.value)
        }}</span>
      </li>
    </ul>

    <p v-if="note" class="shm-run-note" :class="`is-${body.note!.kind}`">
      <SvgIcon :name="note.icon" />
      <span>{{ note.text }}</span>
    </p>

    <div v-if="ghosts.length || cta" class="shm-run-actions">
      <button
        v-for="action in ghosts"
        :key="action.kind"
        v-tooltip="!action.enabled && demo ? i18n.t('exchange.demo') : undefined"
        type="button"
        class="shm-button shm-run-ghost"
        :disabled="!action.enabled || busy"
        @click="ghost(action)"
      >
        {{ actionLabelOf(action, total, format) }}
      </button>

      <template v-if="cta?.kind === 'fillCart'">
        <PaintCartButton
          :lines="cta.lines"
          :expected="planLines"
          :label="actionLabelOf(cta, total, format)"
          @filled="filled"
        />
      </template>
      <button
        v-else-if="cta?.kind === 'pay' || cta?.kind === 'openCart'"
        v-tooltip="demo ? i18n.t('exchange.demo') : i18n.t('consultant.run.payHint')"
        type="button"
        class="shm-button shm-run-cta"
        :disabled="!cta.enabled"
        @click="openCart"
      >
        <SvgIcon name="square-up-right" />
        {{ actionLabelOf(cta, total, format) }}
      </button>
      <template v-else-if="cta?.kind === 'melt'">
        <template v-if="cta.bulk">
          <button
            v-tooltip="
              step.state === 'wait'
                ? i18n.t('consultant.run.untilMelt')
                : i18n.t('consultant.run.meltHint')
            "
            type="button"
            class="shm-button shm-run-cta"
            :disabled="!canMelt"
            @click="melting = true"
          >
            <SvgIcon :name="step.state === 'wait' ? 'lock' : 'recycle'" />
            {{ actionLabelOf(cta, total, format) }}
          </button>
          <BulkExchangeOverlay
            v-if="melting"
            :pledges="meltPledges"
            :hangar="pledges"
            :skipped="0"
            :extra-consent="extraConsent"
            @exchanged="exchanged"
            @close="melting = false"
          />
        </template>
        <!-- Off: points to the experimental setting, as the consultant always did. -->
        <button
          v-else
          v-tooltip="i18n.t('bulkExchange.disabledHint')"
          type="button"
          class="shm-button shm-run-ghost"
          @click="openBulkMeltingSetting"
        >
          <SvgIcon name="gear" />
          {{ i18n.t('bulkExchange.disabled') }}
        </button>
      </template>
    </div>
    <p v-if="cta?.kind === 'melt' && cta.bulk && step.state === 'current'" class="shm-run-bulk">
      {{ i18n.t('consultant.run.bulkNote') }}
    </p>
  </div>
</template>
