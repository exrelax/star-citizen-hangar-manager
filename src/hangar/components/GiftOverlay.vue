<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { giftingRulesDate } from '@/buyback/giftable-hint';
import { GIFTING_FAQ_URL } from '@/config';
import { i18n } from '@/i18n';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { giftPledge, giftWarnings, isEmail } from '../gift';
import type { PledgeView } from '../pledge-view';
import { useRsiText } from '../rsi-text';
import { maybeRunSmartUpdate } from '../sync-state';
import PledgeActionSummary from './PledgeActionSummary.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';

/*
 * RSI's "Gift your pledge" dialog of "My Gear" with its texts, password and recipient, plus the
 * pledge up front and a second entry of the email address, so a typo doesn't send the gift to
 * someone else.
 */

const props = defineProps<{ pledge: PledgeView }>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
/** RSI's own texts: in English unless the setting translates them (see rsi-text.ts). */
const rsi = useRsiText();
const dialog = useTemplateRef<HTMLElement>('dialog');

const warnings = computed(() => giftWarnings(props.pledge));

const name = ref('');
const email = ref('');
const emailRepeated = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<string>();
/** The address RSI sent the gift to, once it confirmed. */
const sentTo = ref<string>();

const emailInvalid = computed(() => email.value !== '' && !isEmail(email.value));
const emailMismatch = computed(
  () => emailRepeated.value !== '' && emailRepeated.value.trim() !== email.value.trim(),
);
const ready = computed(
  () =>
    name.value.trim() !== '' &&
    isEmail(email.value) &&
    emailRepeated.value.trim() === email.value.trim() &&
    password.value !== '' &&
    !submitting.value,
);

/** The demo shows the dialog, but changes nothing: its pledge ids are made up. */
const demo = useDemoContext();

async function submit() {
  if (demo.value) return;
  if (!ready.value) {
    error.value = i18n.t('gift.missing');
    return;
  }
  submitting.value = true;
  error.value = undefined;
  try {
    await giftPledge(props.pledge.id, { name: name.value, email: email.value }, password.value);
    sentTo.value = email.value.trim();
  } catch (failure) {
    error.value = i18n.t('gift.failed', [
      failure instanceof Error ? failure.message : String(failure),
    ]);
  } finally {
    submitting.value = false;
    password.value = '';
  }
}

function close() {
  if (submitting.value) return;
  // The pledge now shows the pending gift in "My Gear": the smart update picks that up.
  if (sentTo.value) void maybeRunSmartUpdate({ force: true });
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  addEventListener('keydown', onKeydown);
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
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
        :aria-label="i18n.t('gift.title')"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3>{{ i18n.t('gift.title') }}</h3>
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

        <PledgeActionSummary :pledge="pledge" :value-label="i18n.t('gift.value')" />

        <p v-if="sentTo" class="shm-action-success" role="status">
          {{ rsi('gift.success', [sentTo, pledge.title]) }}
          <span>{{ rsi('gift.successNote') }}</span>
        </p>

        <form v-else class="shm-action-form" @submit.prevent="submit">
          <ul v-if="warnings.length" class="shm-action-warnings">
            <li
              v-for="warning in warnings"
              :key="warning.kind"
              :class="warning.danger ? 'is-danger' : 'is-notice'"
            >
              <strong>{{ i18n.t(`gift.warnings.${warning.kind}.title`) }}</strong>
              <span>{{ i18n.t(`gift.warnings.${warning.kind}.text`) }}</span>
            </li>
          </ul>

          <!-- The rules changed on 30 Oct 2026; RSI's dialog doesn't say so (see config). -->
          <p class="shm-gift-rules">
            {{ i18n.t('gift.rules', [giftingRulesDate]) }}
            <a :href="GIFTING_FAQ_URL" target="_blank" rel="noopener noreferrer">
              {{ i18n.t('gift.faqLink') }}
            </a>
          </p>

          <!-- RSI's texts of the dialog; RSI disables re-gifting for all accounts. -->
          <p>{{ rsi('gift.intro', [pledge.title]) }}</p>
          <p class="shm-gift-final">{{ rsi('gift.noRegifting') }}</p>

          <div class="shm-action-fields">
            <span class="shm-gift-legend">{{ rsi('gift.recipient') }}</span>
            <label class="shm-action-field">
              <span>{{ rsi('gift.name') }}</span>
              <input v-model="name" type="text" name="name" autocomplete="off" />
            </label>
            <label class="shm-action-field">
              <span>{{ rsi('gift.email') }}</span>
              <input
                v-model="email"
                type="email"
                name="email"
                autocomplete="off"
                :aria-invalid="emailInvalid || undefined"
              />
              <small v-if="emailInvalid" class="shm-action-error">
                {{ i18n.t('gift.emailInvalid') }}
              </small>
            </label>
            <label class="shm-action-field">
              <span>{{ i18n.t('gift.emailRepeat') }}</span>
              <input
                v-model="emailRepeated"
                type="email"
                autocomplete="off"
                :aria-invalid="emailMismatch || undefined"
                @paste.prevent
              />
              <small v-if="emailMismatch" class="shm-action-error">
                {{ i18n.t('gift.emailMismatch') }}
              </small>
            </label>
            <label class="shm-action-field">
              <span>{{ i18n.t('gift.password') }}</span>
              <input
                v-model="password"
                type="password"
                name="current_password"
                autocomplete="current-password"
              />
            </label>
          </div>

          <p v-if="error" class="shm-action-error" role="alert">{{ error }}</p>

          <div class="shm-action-buttons">
            <button type="button" class="shm-button" :disabled="submitting" @click="close">
              {{ i18n.t('gift.cancel') }}
            </button>
            <button
              v-tooltip="demo ? i18n.t('gift.demo') : undefined"
              type="submit"
              class="shm-button shm-action-submit"
              :disabled="!ready || !!demo"
            >
              {{ submitting ? i18n.t('gift.submitting') : i18n.t('gift.submit') }}
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
.shm-gift-final {
  color: var(--shm-danger);
}

.shm-gift-legend {
  color: var(--shm-text);
}

/* Note on the gifting rules, with the link to RSI's FAQ. */
.shm-gift-rules {
  color: var(--shm-text-secondary);
}

.shm-gift-rules a {
  color: var(--shm-accent);
}
</style>
