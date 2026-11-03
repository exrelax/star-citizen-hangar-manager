<script setup lang="ts">
import { EXCHANGE_ATTENTION_DELAY_MS } from '@/config';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { today } from '@/orders/refund';
import { useSettings } from '@/settings/use-settings';
import { themeClass } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { formatPercent, formatUsd } from '../discount-format';
import {
  exchangeKind,
  exchangeWarnings,
  reclaimPledge,
  removeFromStoredHangar,
  type ExchangeWarning,
} from '../exchange';
import type { PledgeView } from '../pledge-view';
import { maybeRunSmartUpdate } from '../sync-state';

/*
 * RSI's "Exchange pledge" dialog of "My Gear" with its texts, acknowledgements and password, plus
 * what the exchange costs beyond the pledge: kind and value up front, then the warnings (lost
 * discount, applied upgrades, …). Pledges with such losses need one more acknowledgement.
 */

const props = defineProps<{ pledge: PledgeView }>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const dialog = useTemplateRef<HTMLElement>('dialog');

const kind = computed(() => exchangeKind(props.pledge));
const warnings = computed(() => exchangeWarnings(props.pledge, today.value));
const hasDanger = computed(() => warnings.value.some((warning) => warning.danger));

// The settings for hiding sensitive information apply here as in the list.
const value = computed(() => (settings.value.hideMeltValue ? HIDDEN : props.pledge.value));
const pledgeId = computed(() => (settings.value.hidePledgeIds ? HIDDEN : props.pledge.id));
const money = (amount: number) =>
  settings.value.hideMeltValue ? HIDDEN : formatUsd(amount, locale.value);

function warningTitle(warning: ExchangeWarning) {
  if (warning.kind === 'discount') {
    return i18n.t('exchange.warnings.discount.title', [
      money(warning.discount.amount),
      formatPercent(warning.discount.percent, locale.value),
    ]);
  }
  return i18n.t(`exchange.warnings.${warning.kind}.title`);
}

function warningText(warning: ExchangeWarning) {
  if (warning.kind === 'discount') {
    return i18n.t('exchange.warnings.discount.text', [
      money(warning.discount.original),
      money(warning.discount.paid),
    ]);
  }
  if (warning.kind === 'refundable') {
    const { daysLeft, until } = warning.refund;
    const left =
      daysLeft === 0
        ? i18n.t('refund.leftLastDay', [until])
        : i18n.t(daysLeft === 1 ? 'refund.leftDay' : 'refund.leftDays', [daysLeft, until]);
    return i18n.t('exchange.warnings.refundable.text', [left]);
  }
  return i18n.t(`exchange.warnings.${warning.kind}.text`);
}

// The last pledge with game access starts with a warning, as in RSI's dialog: "Continue" is
// enabled after a few seconds.
const step = ref<'attention' | 'confirm'>(props.pledge.isLastAlpha ? 'attention' : 'confirm');
const attentionLeft = ref(Math.ceil(EXCHANGE_ATTENTION_DELAY_MS / 1000));
let attentionTimer: ReturnType<typeof setInterval> | undefined;

const consentLimited = ref(false);
const consentDiscount = ref(false);
const consentWarnings = ref(false);
const password = ref('');
const submitting = ref(false);
const error = ref<string>();
/** Set once RSI confirmed the exchange. */
const done = ref(false);

const ready = computed(
  () =>
    consentLimited.value &&
    consentDiscount.value &&
    (!hasDanger.value || consentWarnings.value) &&
    password.value !== '' &&
    !submitting.value,
);

async function submit() {
  if (!ready.value) {
    error.value = i18n.t('exchange.missing');
    return;
  }
  submitting.value = true;
  error.value = undefined;
  try {
    await reclaimPledge(props.pledge.id, password.value);
    done.value = true;
  } catch (failure) {
    error.value = i18n.t('exchange.failed', [
      failure instanceof Error ? failure.message : String(failure),
    ]);
  } finally {
    submitting.value = false;
    password.value = '';
  }
}

/**
 * After the exchange the pledge leaves the stored hangar only now: removing it right away would
 * remove its row, and this dialog with it, before the confirmation could be read.
 */
let removed = false;
async function finish() {
  if (!done.value || removed) return;
  removed = true;
  await removeFromStoredHangar(props.pledge.id);
  // Also picks the pledge up in the buy back.
  void maybeRunSmartUpdate({ force: true });
}

function close() {
  if (submitting.value) return;
  void finish();
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
  if (step.value === 'attention') {
    attentionTimer = setInterval(() => {
      attentionLeft.value--;
      if (attentionLeft.value <= 0) clearInterval(attentionTimer);
    }, 1000);
  }
});
onUnmounted(() => {
  removeEventListener('keydown', onKeydown);
  clearInterval(attentionTimer);
  void finish();
});
</script>

<template>
  <Teleport to="body">
    <!-- Teleported out of the manager: it carries the theme class itself. -->
    <div class="shm-overlay" :class="themeClass(settings.theme)" @click.self="close">
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-exchange"
        role="dialog"
        aria-modal="true"
        :aria-label="i18n.t('exchange.title')"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3>{{ i18n.t('exchange.title') }}</h3>
          <button
            type="button"
            class="shm-overlay-close"
            :title="i18n.t('order.close')"
            :aria-label="i18n.t('order.close')"
            :disabled="submitting"
            @click="close"
          >
            ×
          </button>
        </header>

        <!-- What is exchanged, and for how much. -->
        <div class="shm-exchange-summary">
          <div class="shm-exchange-item">
            <span class="shm-exchange-kind" :class="`is-${kind}`">
              {{ i18n.t(`exchange.kinds.${kind}`) }}
            </span>
            <strong class="shm-exchange-title">{{ pledge.title }}</strong>
            <span class="shm-exchange-id">#{{ pledgeId }}</span>
          </div>
          <div class="shm-exchange-value">
            <span>{{ i18n.t('exchange.receive') }}</span>
            <strong>{{ value }}</strong>
            <span>{{ i18n.t('exchange.storeCredit') }}</span>
          </div>
        </div>

        <p v-if="done" class="shm-exchange-success" role="status">
          {{ i18n.t('exchange.success', [value]) }}
          <span>{{ i18n.t('exchange.successNote') }}</span>
        </p>

        <!-- RSI's first step for the last pledge with game access. -->
        <div v-else-if="step === 'attention'" class="shm-exchange-attention" role="alert">
          <strong>{{ i18n.t('exchange.attention') }}</strong>
          <p>{{ i18n.t('exchange.warnings.lastGameAccess.text') }}</p>
          <button
            type="button"
            class="shm-button"
            :disabled="attentionLeft > 0"
            @click="step = 'confirm'"
          >
            {{
              attentionLeft > 0
                ? i18n.t('exchange.continueIn', [attentionLeft])
                : i18n.t('exchange.continue')
            }}
          </button>
        </div>

        <form v-else class="shm-exchange-form" @submit.prevent="submit">
          <ul v-if="warnings.length" class="shm-exchange-warnings">
            <li
              v-for="warning in warnings"
              :key="warning.kind"
              :class="warning.danger ? 'is-danger' : 'is-notice'"
            >
              <strong>{{ warningTitle(warning) }}</strong>
              <span>{{ warningText(warning) }}</span>
            </li>
          </ul>

          <!-- RSI's texts of the dialog. -->
          <p>{{ i18n.t('exchange.intro', [pledge.title, value]) }}</p>
          <p v-if="!pledge.isBuybackable" class="shm-exchange-final">
            {{ i18n.t('exchange.notBuybackable') }}
          </p>
          <p>
            {{ i18n.t(pledge.isBuybackable ? 'exchange.finalBuyback' : 'exchange.finalPermanent') }}
          </p>

          <fieldset class="shm-exchange-consents">
            <legend>{{ i18n.t('exchange.acknowledge') }}</legend>
            <label>
              <input v-model="consentLimited" type="checkbox" name="consent_limited" />
              <span>{{ i18n.t('exchange.consentLimited') }}</span>
            </label>
            <label>
              <input v-model="consentDiscount" type="checkbox" name="consent_discount" />
              <span>{{ i18n.t('exchange.consentDiscount') }}</span>
            </label>
            <label v-if="hasDanger" class="is-danger">
              <input v-model="consentWarnings" type="checkbox" />
              <span>{{ i18n.t('exchange.consentWarnings') }}</span>
            </label>
          </fieldset>

          <label class="shm-exchange-password">
            <span>{{ i18n.t('exchange.password') }}</span>
            <input
              v-model="password"
              type="password"
              name="current_password"
              autocomplete="current-password"
            />
          </label>

          <p v-if="error" class="shm-exchange-error" role="alert">{{ error }}</p>

          <div class="shm-exchange-actions">
            <button type="button" class="shm-button" :disabled="submitting" @click="close">
              {{ i18n.t('exchange.cancel') }}
            </button>
            <button type="submit" class="shm-button shm-exchange-submit" :disabled="!ready">
              {{ submitting ? i18n.t('exchange.submitting') : i18n.t('exchange.submit', [value]) }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>

<style scoped>
.shm-exchange {
  width: min(640px, 100%);
}

.shm-exchange p {
  margin: 0 0 10px;
}

.shm-exchange-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  margin-bottom: 16px;
  padding: 12px 14px;
  background: rgb(var(--shm-accent-rgb) / 0.06);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-exchange-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.shm-exchange-kind {
  padding: 2px 7px;
  color: var(--shm-accent);
  font-size: 11px;
  text-transform: uppercase;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.6);
}

.shm-exchange-kind.is-upgradedShip {
  color: var(--shm-upgraded);
  border-color: rgb(var(--shm-upgraded-rgb) / 0.7);
}

.shm-exchange-title {
  color: var(--shm-text-strong);
  font-size: 15px;
  font-weight: normal;
}

.shm-exchange-id {
  color: var(--shm-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.shm-exchange-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--shm-text-muted);
  font-size: 11px;
  text-transform: uppercase;
}

.shm-exchange-value strong {
  color: var(--shm-accent);
  font-size: 22px;
  font-weight: normal;
  font-variant-numeric: tabular-nums;
}

.shm-exchange-warnings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.shm-exchange-warnings li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-left: 3px solid;
}

.shm-exchange-warnings strong {
  font-weight: normal;
  text-transform: uppercase;
}

.shm-exchange-warnings .is-danger {
  border-color: var(--shm-danger);
  background: color-mix(in srgb, var(--shm-danger) 12%, transparent);
}

.shm-exchange-warnings .is-danger strong {
  color: var(--shm-danger);
}

.shm-exchange-warnings .is-notice {
  border-color: var(--shm-warning);
  background: color-mix(in srgb, var(--shm-warning) 10%, transparent);
}

.shm-exchange-warnings .is-notice strong {
  color: var(--shm-warning);
}

.shm-exchange-final {
  color: var(--shm-danger);
}

.shm-exchange-attention {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--shm-danger);
  background: color-mix(in srgb, var(--shm-danger) 12%, transparent);
}

.shm-exchange-attention strong {
  color: var(--shm-danger);
  font-size: 15px;
  font-weight: normal;
  text-transform: uppercase;
}

.shm-exchange-consents {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0;
  padding: 0;
  border: 0;
}

.shm-exchange-consents legend {
  margin-bottom: 8px;
  padding: 0;
  color: var(--shm-text);
}

.shm-exchange-consents label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--shm-text);
  cursor: pointer;
}

.shm-exchange-consents label.is-danger {
  color: var(--shm-danger);
}

.shm-exchange-consents input {
  margin-top: 2px;
  accent-color: var(--shm-accent);
}

.shm-exchange-password {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--shm-text);
}

.shm-exchange-password input {
  width: min(320px, 100%);
  height: 32px;
  padding: 0 10px;
  color: var(--shm-text);
  font: inherit;
  background: rgb(var(--shm-surface-rgb) / 0.9);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.35);
}

.shm-exchange-password input:focus-visible {
  border-color: var(--shm-accent);
  outline: none;
}

.shm-exchange-error {
  margin-top: 12px !important;
  color: var(--shm-danger);
}

.shm-exchange-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.shm-exchange-submit:not(:disabled) {
  color: var(--shm-danger);
  border-color: var(--shm-danger);
}

.shm-exchange-submit:not(:disabled):hover,
.shm-exchange-submit:not(:disabled):focus-visible {
  color: var(--shm-text-strong);
  background: color-mix(in srgb, var(--shm-danger) 35%, transparent);
  border-color: var(--shm-danger);
}

.shm-exchange-success {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  color: var(--shm-success);
  border: 1px solid rgb(var(--shm-success-rgb) / 0.6);
}

.shm-exchange-success span {
  color: var(--shm-text-secondary);
}
</style>
