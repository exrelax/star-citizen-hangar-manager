<script setup lang="ts">
import { EXCHANGE_ATTENTION_DELAY_MS } from '@/config';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { today } from '@/orders/refund';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { formatPercent, formatUsd } from '../discount-format';
import {
  exchangeWarnings,
  reclaimPledge,
  removeFromStoredHangar,
  type ExchangeWarning,
} from '../exchange';
import type { PledgeView } from '../pledge-view';
import { useRsiText } from '../rsi-text';
import PledgeActionSummary from './PledgeActionSummary.vue';
import { maybeRunSmartUpdate } from '../sync-state';
import { vTooltip } from '@/shared/tooltip/tooltip';

/*
 * RSI's "Exchange pledge" dialog of "My Gear" with its texts, acknowledgements and password, plus
 * what the exchange costs beyond the pledge: kind and value up front, then the warnings (lost
 * discount, applied upgrades, …). Pledges with such losses need one more acknowledgement.
 */

const props = defineProps<{ pledge: PledgeView }>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
/** RSI's own texts: in English unless the setting translates them (see rsi-text.ts). */
const rsi = useRsiText();
const dialog = useTemplateRef<HTMLElement>('dialog');

const warnings = computed(() => exchangeWarnings(props.pledge, today.value));
const hasDanger = computed(() => warnings.value.some((warning) => warning.danger));

// The settings for hiding sensitive information apply here as in the list.
const value = computed(() => (settings.value.hideMeltValue ? HIDDEN : props.pledge.value));
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
    <!-- In the selected theme, or (the default) after RSI's own dialog (action-dialog.css). -->
    <div
      class="shm-overlay"
      :class="
        settings.themedActionDialogs ? themeClasses(settings) : 'shm-theme-rsi shm-rsi-dialog'
      "
      :style="fontScaleStyle(settings)"
      @click.self="close"
    >
      <section
        ref="dialog"
        class="shm-overlay-dialog shm-action-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="i18n.t('exchange.title')"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3>{{ i18n.t('exchange.title') }}</h3>
          <button
            v-tooltip="i18n.t('order.close')"
            type="button"
            class="shm-overlay-close"
            :aria-label="i18n.t('order.close')"
            :disabled="submitting"
            @click="close"
          >
            ×
          </button>
        </header>

        <!-- What is exchanged, and for how much. -->
        <PledgeActionSummary
          :pledge="pledge"
          :value-label="i18n.t('exchange.receive')"
          :value-caption="i18n.t('exchange.storeCredit')"
        />

        <p v-if="done" class="shm-action-success" role="status">
          {{ rsi('exchange.success', [value]) }}
          <span>{{ i18n.t('exchange.successNote') }}</span>
        </p>

        <!-- RSI's first step for the last pledge with game access. -->
        <div v-else-if="step === 'attention'" class="shm-exchange-attention" role="alert">
          <strong>{{ rsi('exchange.attention') }}</strong>
          <p>{{ i18n.t('exchange.warnings.lastGameAccess.text') }}</p>
          <button
            type="button"
            class="shm-button"
            :disabled="attentionLeft > 0"
            @click="step = 'confirm'"
          >
            {{
              attentionLeft > 0
                ? rsi('exchange.continueIn', [attentionLeft])
                : rsi('exchange.continue')
            }}
          </button>
        </div>

        <form v-else class="shm-action-form" @submit.prevent="submit">
          <ul v-if="warnings.length" class="shm-action-warnings">
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
          <p>{{ rsi('exchange.intro', [pledge.title, value]) }}</p>
          <p v-if="!pledge.isBuybackable" class="shm-exchange-final">
            {{ rsi('exchange.notBuybackable') }}
          </p>
          <p>
            {{ rsi(pledge.isBuybackable ? 'exchange.finalBuyback' : 'exchange.finalPermanent') }}
          </p>

          <fieldset class="shm-action-consents">
            <legend>{{ rsi('exchange.acknowledge') }}</legend>
            <label>
              <input v-model="consentLimited" type="checkbox" name="consent_limited" />
              <span>{{ rsi('exchange.consentLimited') }}</span>
            </label>
            <label>
              <input v-model="consentDiscount" type="checkbox" name="consent_discount" />
              <span>{{ rsi('exchange.consentDiscount') }}</span>
            </label>
            <label v-if="hasDanger" class="is-danger">
              <input v-model="consentWarnings" type="checkbox" />
              <span>{{ i18n.t('exchange.consentWarnings') }}</span>
            </label>
          </fieldset>

          <label class="shm-action-field">
            <span>{{ i18n.t('exchange.password') }}</span>
            <input
              v-model="password"
              type="password"
              name="current_password"
              autocomplete="current-password"
            />
          </label>

          <p v-if="error" class="shm-action-error" role="alert">{{ error }}</p>

          <div class="shm-action-buttons">
            <button type="button" class="shm-button" :disabled="submitting" @click="close">
              {{ i18n.t('exchange.cancel') }}
            </button>
            <button type="submit" class="shm-button is-danger shm-action-submit" :disabled="!ready">
              {{ submitting ? i18n.t('exchange.submitting') : i18n.t('exchange.submit', [value]) }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style src="@/shared/overlay.css"></style>
<style src="./action-dialog.css"></style>

<style scoped>
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
  font-size: calc(15px * var(--shm-font-scale));
  font-weight: normal;
  text-transform: uppercase;
}
</style>
