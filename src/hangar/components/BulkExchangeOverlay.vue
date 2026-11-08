<script setup lang="ts">
import { BULK_EXCHANGE_DELAY_MS, EXCHANGE_ATTENTION_DELAY_MS } from '@/config';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { today } from '@/orders/refund';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { formatUsd } from '../discount-format';
import {
  exchangeWarnings,
  losesAllGameAccess,
  reclaimPledges,
  removeFromStoredHangar,
  type ExchangeWarning,
} from '../exchange';
import { pledgeKind } from '../pledge-kind';
import type { PledgeView } from '../pledge-view';
import { useRsiText } from '../rsi-text';
import { summarize } from '../summary';
import { maybeRunSmartUpdate } from '../sync-state';

/*
 * Bulk melting (an experimental setting): exchanges the selected pledges of "My Hangar" at once,
 * one after the other with the same password. Like the single exchange dialog it lists what is
 * lost beyond the pledges – summed up over all of them – and asks for RSI's acknowledgements, plus
 * one for the experimental feature. It stops at the first pledge RSI refuses.
 */

const props = defineProps<{
  /** The selected pledges that can be exchanged. */
  pledges: readonly PledgeView[];
  /** All pledges of the hangar, to tell whether the selection takes all game access. */
  hangar: readonly PledgeView[];
  /** Selected pledges left out because they can't be exchanged. */
  skipped: number;
}>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
/** RSI's own texts: in English unless the setting translates them (see rsi-text.ts). */
const rsi = useRsiText();
const dialog = useTemplateRef<HTMLElement>('dialog');

const hideValue = computed(() => settings.value.hideMeltValue);
const money = (amount: number) => (hideValue.value ? HIDDEN : formatUsd(amount, locale.value));
const pledgeId = (pledge: PledgeView) => (settings.value.hidePledgeIds ? HIDDEN : pledge.id);

const total = computed(() => summarize(props.pledges));
const losesGameAccess = computed(() => losesAllGameAccess(props.pledges, props.hangar));
const allBuybackable = computed(() => props.pledges.every((pledge) => pledge.isBuybackable));

/** The warnings of every pledge, by pledge id. */
const warningsOf = computed(
  () => new Map(props.pledges.map((pledge) => [pledge.id, exchangeWarnings(pledge, today.value)])),
);

type Kind = ExchangeWarning['kind'];
/** The warnings summed up over all pledges: how many each, the discounts in USD. */
const summedWarnings = computed(() => {
  const counts = new Map<Kind, number>();
  let discount = 0;
  for (const warnings of warningsOf.value.values()) {
    for (const warning of warnings) {
      // Taken over by the warning for the whole selection below.
      if (warning.kind === 'lastGameAccess') continue;
      counts.set(warning.kind, (counts.get(warning.kind) ?? 0) + 1);
      if (warning.kind === 'discount') discount += warning.discount.amount;
    }
  }
  const order: Kind[] = ['notBuybackable', 'upgraded', 'discount', 'giftable', 'refundable'];
  const summed = order
    .filter((kind) => counts.has(kind))
    .map((kind) => ({
      kind,
      danger: kind !== 'giftable' && kind !== 'refundable',
      title: i18n.t(`bulkExchange.warnings.${kind}`, [
        counts.get(kind)!,
        money(Math.round(discount * 100) / 100),
      ]),
    }));
  if (losesGameAccess.value) {
    summed.unshift({
      kind: 'lastGameAccess',
      danger: true,
      title: i18n.t('bulkExchange.warnings.lastGameAccess'),
    });
  }
  return summed;
});
const hasDanger = computed(() => summedWarnings.value.some((warning) => warning.danger));

/** Short tags of a pledge's warnings in the list. */
const tagsOf = (pledge: PledgeView) =>
  (warningsOf.value.get(pledge.id) ?? []).map((warning) => ({
    kind: warning.kind,
    danger: warning.danger,
    label: i18n.t(`bulkExchange.tags.${warning.kind}`),
  }));

// Taking all game access starts with a warning, as RSI's dialog does for the last pledge with
// game access: "Continue" is enabled after a few seconds.
const step = ref<'attention' | 'confirm'>(losesGameAccess.value ? 'attention' : 'confirm');
const attentionLeft = ref(Math.ceil(EXCHANGE_ATTENTION_DELAY_MS / 1000));
let attentionTimer: ReturnType<typeof setInterval> | undefined;

const consentLimited = ref(false);
const consentDiscount = ref(false);
const consentWarnings = ref(false);
const consentExperimental = ref(false);
const password = ref('');
const submitting = ref(false);
const error = ref<string>();

/** The pledges RSI exchanged so far, and the one it refused. */
const exchanged = ref<number[]>([]);
const failed = ref<{ id: number; message: string }>();
const finished = ref(false);

const exchangedValue = computed(() =>
  summarize(props.pledges.filter((pledge) => exchanged.value.includes(pledge.id))),
);
const failedPledge = computed(() => props.pledges.find((pledge) => pledge.id === failed.value?.id));
/** Not sent because RSI refused one before them. */
const notSent = computed(
  () => props.pledges.length - exchanged.value.length - (failed.value ? 1 : 0),
);

const ready = computed(
  () =>
    consentLimited.value &&
    consentDiscount.value &&
    consentExperimental.value &&
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
    const result = await reclaimPledges(
      props.pledges.map((pledge) => pledge.id),
      password.value,
      {
        delayMs: BULK_EXCHANGE_DELAY_MS,
        onExchanged: (id) => (exchanged.value = [...exchanged.value, id]),
      },
    );
    failed.value = result.failed;
    finished.value = true;
  } finally {
    submitting.value = false;
    password.value = '';
  }
}

/**
 * The exchanged pledges leave the stored hangar only when the dialog closes: removing them right
 * away would remove them from the selection, and this dialog's list with them.
 */
let removed = false;
async function finish() {
  if (removed || !exchanged.value.length) return;
  removed = true;
  await removeFromStoredHangar(exchanged.value);
  // Also picks the pledges up in the buy back.
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
        :aria-label="i18n.t('bulkExchange.title', [pledges.length])"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3>{{ i18n.t('bulkExchange.title', [pledges.length]) }}</h3>
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
        <div class="shm-action-summary">
          <div class="shm-action-item">
            <strong class="shm-action-title">
              {{ i18n.t('bulkExchange.count', [pledges.length]) }}
            </strong>
            <span v-if="skipped" class="shm-action-id">
              {{ i18n.t('bulkExchange.skipped', [skipped]) }}
            </span>
          </div>
          <div class="shm-action-value">
            <span>{{ i18n.t('exchange.receive') }}</span>
            <strong>{{ money(total.value) }}</strong>
            <span>{{ i18n.t('exchange.storeCredit') }}</span>
          </div>
        </div>

        <ul class="shm-bulk-list" :aria-label="i18n.t('bulkExchange.listLabel')">
          <li
            v-for="pledge in pledges"
            :key="pledge.id"
            :class="{
              'is-done': exchanged.includes(pledge.id),
              'is-failed': failed?.id === pledge.id,
            }"
          >
            <span class="shm-action-kind" :class="`is-${pledgeKind(pledge)}`">
              {{ i18n.t(`pledge.kinds.${pledgeKind(pledge)}`) }}
            </span>
            <span class="shm-bulk-title">
              {{ pledge.title }} <span class="shm-action-id">#{{ pledgeId(pledge) }}</span>
            </span>
            <span class="shm-bulk-value">{{ hideValue ? HIDDEN : pledge.value }}</span>
            <span v-if="tagsOf(pledge).length" class="shm-bulk-tags">
              <span
                v-for="tag in tagsOf(pledge)"
                :key="tag.kind"
                class="shm-bulk-tag"
                :class="tag.danger ? 'is-danger' : 'is-notice'"
              >
                {{ tag.label }}
              </span>
            </span>
          </li>
        </ul>

        <!-- The outcome: all exchanged, or stopped at the pledge RSI refused. -->
        <template v-if="finished">
          <p v-if="exchanged.length" class="shm-action-success" role="status">
            {{ i18n.t('bulkExchange.success', [exchanged.length, money(exchangedValue.value)]) }}
            <span>{{ i18n.t('bulkExchange.successNote') }}</span>
          </p>
          <p v-if="failed" class="shm-action-error" role="alert">
            {{
              i18n.t('bulkExchange.failed', [
                failedPledge?.title ?? String(failed.id),
                failed.message,
                notSent,
              ])
            }}
          </p>
          <div class="shm-action-buttons">
            <button type="button" class="shm-button" @click="close">
              {{ i18n.t('order.close') }}
            </button>
          </div>
        </template>

        <!-- RSI's first step for the last pledge with game access, here for the selection. -->
        <div v-else-if="step === 'attention'" class="shm-exchange-attention" role="alert">
          <strong>{{ rsi('exchange.attention') }}</strong>
          <p>{{ i18n.t('bulkExchange.lastGameAccessText') }}</p>
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
          <ul v-if="summedWarnings.length" class="shm-action-warnings">
            <li
              v-for="warning in summedWarnings"
              :key="warning.kind"
              :class="warning.danger ? 'is-danger' : 'is-notice'"
            >
              <strong>{{ warning.title }}</strong>
            </li>
          </ul>

          <!-- RSI's texts of the dialog, for all pledges. -->
          <p>{{ i18n.t('bulkExchange.intro', [pledges.length, money(total.value)]) }}</p>
          <p v-if="!allBuybackable" class="shm-exchange-final">
            {{ rsi('exchange.notBuybackable') }}
          </p>
          <p>{{ rsi(allBuybackable ? 'exchange.finalBuyback' : 'exchange.finalPermanent') }}</p>

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
              <span>{{ i18n.t('bulkExchange.consentWarnings') }}</span>
            </label>
            <label class="is-danger">
              <input v-model="consentExperimental" type="checkbox" />
              <span>{{ i18n.t('bulkExchange.consentExperimental') }}</span>
            </label>
          </fieldset>

          <label class="shm-action-field">
            <span>{{ i18n.t('exchange.password') }}</span>
            <input
              v-model="password"
              type="password"
              name="current_password"
              autocomplete="current-password"
              :disabled="submitting"
            />
          </label>

          <p v-if="error" class="shm-action-error" role="alert">{{ error }}</p>

          <div class="shm-action-buttons">
            <button type="button" class="shm-button" :disabled="submitting" @click="close">
              {{ i18n.t('exchange.cancel') }}
            </button>
            <button type="submit" class="shm-button is-danger shm-action-submit" :disabled="!ready">
              {{
                submitting
                  ? i18n.t('bulkExchange.submitting', [exchanged.length + 1, pledges.length])
                  : i18n.t('bulkExchange.submit', [pledges.length, money(total.value)])
              }}
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

/* The pledges to exchange: scrolls on its own, so the form stays in view. */
.shm-bulk-list {
  max-height: min(240px, 35vh);
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--shm-separator);
}

.shm-bulk-list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: baseline;
  gap: 4px 10px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--shm-separator);
}

.shm-bulk-list li:last-child {
  border-bottom: 0;
}

.shm-bulk-list li.is-done {
  opacity: 0.55;
}

.shm-bulk-list li.is-done .shm-bulk-title {
  text-decoration: line-through;
}

.shm-bulk-list li.is-failed {
  background: color-mix(in srgb, var(--shm-danger) 12%, transparent);
}

.shm-bulk-value {
  font-variant-numeric: tabular-nums;
}

.shm-bulk-tags {
  display: flex;
  flex-wrap: wrap;
  grid-column: 2 / -1;
  gap: 4px;
}

.shm-bulk-tag {
  padding: 0 6px;
  font-size: calc(11px * var(--shm-font-scale));
  border: 1px solid currentColor;
  border-radius: var(--shm-radius-pill);
}

.shm-bulk-tag.is-danger {
  color: var(--shm-danger);
}

.shm-bulk-tag.is-notice {
  color: var(--shm-warning);
}
</style>
