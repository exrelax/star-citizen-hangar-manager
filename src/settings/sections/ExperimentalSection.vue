<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n } from '@/i18n';
import { BULK_MELTING_SETTING_ID } from '../anchors';
import SettingCheck from '../SettingCheck.vue';
import SettingsGroup from '../SettingsGroup.vue';
import type { Settings } from '../settings';

/*
 * Features that may not always work as intended, off by default, with a clear warning: using
 * them is at the user's own risk.
 */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
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
      @change="(bulkMelting) => emit('update', { bulkMelting })"
    >
      {{ i18n.t('settings.bulkMelting') }}
    </SettingCheck>
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

.shm-experimental-warning svg {
  flex: none;
  margin-top: 2px;
  color: var(--shm-warning);
}
</style>
