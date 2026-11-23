<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n } from '@/i18n';
import { BULK_MELTING_MAX } from '@/config';
import { BULK_MELTING_MAX_SETTING_ID, BULK_MELTING_SETTING_ID } from '../anchors';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';
import { isBulkMeltingMax, type Settings } from '../settings';
import { nextTick, ref, useTemplateRef } from 'vue';

/*
 * Features that may not always work as intended, off by default, with a clear warning: using
 * them is at the user's own risk.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/*
 * Bulk melting asks before it is turned on (#331): several exchanges in a row with one click may
 * count as a macro under RSI's Terms of Service, and melting can't be undone. Only "Turn on" turns
 * it on; turning it off needs no question.
 */
const askingBulk = ref(false);
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton');

async function changeBulkMelting(on: boolean) {
  if (!on) {
    askingBulk.value = false;
    emit('update', { bulkMelting: false });
    return;
  }
  askingBulk.value = true;
  // "Cancel" has the focus, so Return never turns it on by accident.
  await nextTick();
  cancelButton.value?.focus();
}

function turnOnBulkMelting() {
  askingBulk.value = false;
  emit('update', { bulkMelting: true });
}

/** The limit of bulk melting (#622): whole numbers in range; anything else snaps back. */
function changeBulkMeltingMax(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (isBulkMeltingMax(value)) emit('update', { bulkMeltingMax: value });
  else input.value = String(props.settings.bulkMeltingMax);
}
</script>

<template>
  <p class="shm-experimental-warning" role="note">
    <SvgIcon name="triangle-exclamation" />
    <span>{{ i18n.t('settings.experimentalWarning') }}</span>
  </p>
  <SettingsGroup>
    <!-- Linked from the sidebar's "Selected" box while it is off. -->
    <SettingCheck
      :id="BULK_MELTING_SETTING_ID"
      class="shm-setting-anchor"
      :checked="settings.bulkMelting"
      :hint="i18n.t('settings.bulkMeltingHint')"
      @change="changeBulkMelting"
    >
      {{ i18n.t('settings.bulkMelting') }}
    </SettingCheck>
    <div v-if="askingBulk" class="shm-setting-row shm-experimental-confirm" role="alert">
      <p>{{ i18n.t('settings.bulkMeltingConfirm') }}</p>
      <div class="shm-experimental-confirm-actions">
        <button ref="cancelButton" type="button" class="shm-button" @click="askingBulk = false">
          {{ i18n.t('settings.bulkMeltingCancel') }}
        </button>
        <button type="button" class="shm-button is-danger" @click="turnOnBulkMelting">
          {{ i18n.t('settings.bulkMeltingTurnOn') }}
        </button>
      </div>
    </div>
    <!-- How many pledges at most (#622), while it is on; linked from the "Selected" box. -->
    <SettingRow
      v-if="settings.bulkMelting"
      :id="BULK_MELTING_MAX_SETTING_ID"
      class="shm-setting-anchor"
      :label="i18n.t('settings.bulkMeltingMax')"
      for="shm-bulk-melting-max"
      hint-id="shm-bulk-melting-max-hint"
      :hint="i18n.t('settings.bulkMeltingMaxHint', [BULK_MELTING_MAX.min, BULK_MELTING_MAX.max])"
    >
      <span class="shm-number-field">
        <input
          id="shm-bulk-melting-max"
          class="shm-input shm-number"
          type="number"
          inputmode="numeric"
          :min="BULK_MELTING_MAX.min"
          :max="BULK_MELTING_MAX.max"
          step="1"
          :value="settings.bulkMeltingMax"
          aria-describedby="shm-bulk-melting-max-hint"
          @change="changeBulkMeltingMax"
        />
        {{ i18n.t('settings.pledges') }}
      </span>
    </SettingRow>
    <SettingCheck
      :checked="settings.translateRsiTexts"
      :hint="i18n.t('settings.translateRsiTextsHint')"
      @change="(translateRsiTexts) => emit('update', { translateRsiTexts })"
    >
      {{ i18n.t('settings.translateRsiTexts') }}
    </SettingCheck>
  </SettingsGroup>
</template>

<style scoped>
/* The warning of the whole section: clearly visible, above its settings. */
.shm-experimental-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  color: var(--shm-text);
  border: 1px solid var(--shm-warning);
  border-radius: var(--shm-radius-control);
  background: color-mix(in srgb, var(--shm-warning) 12%, transparent);
}

.shm-experimental-confirm {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.shm-experimental-confirm p {
  margin: 0;
  color: var(--shm-text);
}

/* As in an alert: the button that goes ahead on the right, "Cancel" left of it. */
.shm-experimental-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.shm-experimental-warning svg {
  flex: none;
  margin-top: 2px;
  color: var(--shm-warning);
}
</style>
