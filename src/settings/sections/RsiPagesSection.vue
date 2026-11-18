<script setup lang="ts">
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import SettingsGroup from '../SettingsGroup.vue';
import type { Settings } from '../settings';

/** Additions to RSI's own pages, e.g. labels in RSI's ship upgrade dialog (#401). */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
</script>

<template>
  <p class="shm-settings-intro">{{ i18n.t('settings.rsiPagesIntro') }}</p>
  <SettingsGroup>
    <SettingCheck
      :checked="settings.upgradeDialogAlwaysAvailable"
      :hint="i18n.t('settings.upgradeDialogAlwaysAvailableHint')"
      @change="(upgradeDialogAlwaysAvailable) => emit('update', { upgradeDialogAlwaysAvailable })"
    >
      {{ i18n.t('settings.upgradeDialogAlwaysAvailable') }}
    </SettingCheck>
  </SettingsGroup>
</template>
