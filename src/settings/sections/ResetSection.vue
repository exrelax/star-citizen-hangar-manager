<script setup lang="ts">
import { syncState } from '@/hangar/sync-state';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { clearLocalCache } from '@/shared/local-cache';
import { ref } from 'vue';
import { resetSettings } from '../settings';

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
  <div class="shm-reset" role="group" aria-labelledby="shm-reset-label">
    <span id="shm-reset-label" class="shm-field-label">{{ i18n.t('settings.reset') }}</span>
    <ul class="shm-reset-actions">
      <li>
        <!-- Not during a refresh: it would store the pledges again right after. -->
        <button
          type="button"
          class="shm-button is-danger"
          :disabled="syncState.running"
          @click="clearCache"
        >
          <SvgIcon name="trash" />
          {{ i18n.t('settings.clearCache') }}
        </button>
        <p class="shm-hint">{{ i18n.t('settings.clearCacheHint') }}</p>
        <!-- With nothing stored, the lists offer the initial load again. -->
        <p v-if="resetDone === 'cache'" class="shm-hint is-done" role="status">
          {{ i18n.t('settings.clearCacheDone', [i18n.t('manager.initialLoad')]) }}
        </p>
      </li>
      <li>
        <button type="button" class="shm-button is-danger" @click="resetAllSettings">
          <SvgIcon name="rotate-left" />
          {{ i18n.t('settings.resetSettings') }}
        </button>
        <p class="shm-hint">{{ i18n.t('settings.resetSettingsHint') }}</p>
        <p v-if="resetDone === 'settings'" class="shm-hint is-done" role="status">
          {{ i18n.t('settings.resetSettingsDone') }}
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.shm-reset {
  margin-top: 18px;
  padding-top: 4px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-reset-actions {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-hint.is-done {
  color: var(--shm-success);
}
</style>
