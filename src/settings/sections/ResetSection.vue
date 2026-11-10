<script setup lang="ts">
import { syncState } from '@/hangar/sync-state';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { clearLocalCache } from '@/shared/local-cache';
import { ref } from 'vue';
import { resetSettings } from '../settings';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';

/** What the last reset did, shown below its button until the next one. */
const resetDone = ref<'cache' | 'settings'>();

async function clearCache() {
  if (!confirm(i18n.t('settings.clearCacheConfirm'))) return;
  await clearLocalCache();
  resetDone.value = 'cache';
}

async function resetAllSettings() {
  if (!confirm(i18n.t('settings.resetSettingsConfirm'))) return;
  await resetSettings();
  resetDone.value = 'settings';
}
</script>

<template>
  <!-- A part of "Stored data" (StorageSection.vue), below its table. -->
  <SettingsGroup :title="i18n.t('settings.reset')" danger>
    <SettingRow :label="i18n.t('settings.clearCache')" :hint="i18n.t('settings.clearCacheHint')">
      <!-- Not during a refresh: it would store the pledges again right after. -->
      <button
        type="button"
        class="shm-button is-danger"
        :disabled="syncState.running"
        @click="clearCache"
      >
        <SvgIcon name="trash" />
        {{ i18n.t('settings.clearCacheButton') }}
      </button>
    </SettingRow>
    <SettingRow
      :label="i18n.t('settings.resetSettings')"
      :hint="i18n.t('settings.resetSettingsHint')"
    >
      <button type="button" class="shm-button is-danger" @click="resetAllSettings">
        <SvgIcon name="rotate-left" />
        {{ i18n.t('settings.resetSettingsButton') }}
      </button>
    </SettingRow>
    <template #after>
      <!-- With nothing stored, the lists offer the initial load again. -->
      <p v-if="resetDone === 'cache'" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t('settings.clearCacheDone', [i18n.t('manager.initialLoad')]) }}
      </p>
      <p v-if="resetDone === 'settings'" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t('settings.resetSettingsDone') }}
      </p>
    </template>
  </SettingsGroup>
</template>
