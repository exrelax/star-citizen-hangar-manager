<script setup lang="ts">
import { PLEDGE_STORE, SMART_UPDATE } from '@/config';
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import { isRefreshMinutes, type Settings } from '../settings';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const checkIntervalMinutes = SMART_UPDATE.checkIntervalMs / 60_000;
const { min, max } = PLEDGE_STORE.refreshMinutes;

/** Stores whole minutes in range; anything else snaps back to the stored value. */
function changeMinutes(event: Event, current: number) {
  const input = event.target as HTMLInputElement;
  const minutes = Number(input.value);
  if (isRefreshMinutes(minutes)) emit('update', { storeRefreshMinutes: minutes });
  else input.value = String(current);
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.smartUpdates') }}</legend>
    <SettingCheck
      :checked="settings.smartUpdates"
      :hint="i18n.t('settings.smartUpdatesHint', [checkIntervalMinutes])"
      @change="(smartUpdates) => emit('update', { smartUpdates })"
    >
      {{ i18n.t('settings.smartUpdatesLists') }}
    </SettingCheck>

    <label class="shm-field-label" for="shm-store-refresh">
      {{ i18n.t('settings.storeRefresh') }}
    </label>
    <span class="shm-number-field">
      <input
        id="shm-store-refresh"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="min"
        :max="max"
        step="1"
        :value="settings.storeRefreshMinutes"
        :disabled="!settings.smartUpdates"
        aria-describedby="shm-store-refresh-hint"
        @change="changeMinutes($event, settings.storeRefreshMinutes)"
      />
      {{ i18n.t('settings.minutes') }}
    </span>
    <p id="shm-store-refresh-hint" class="shm-hint">
      {{ i18n.t('settings.storeRefreshHint', [min, max]) }}
    </p>
  </fieldset>
</template>
