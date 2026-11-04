<script setup lang="ts">
import { SMART_UPDATE } from '@/config';
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import { BUYBACK_LINK_MODES, type BuybackLinkMode, type Settings } from '../settings';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const checkIntervalMinutes = SMART_UPDATE.checkIntervalMs / 60_000;
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.general') }}</legend>
    <SettingCheck
      :checked="settings.smartUpdates"
      :hint="i18n.t('settings.smartUpdatesHint', [checkIntervalMinutes])"
      @change="(smartUpdates) => emit('update', { smartUpdates })"
    >
      {{ i18n.t('settings.smartUpdates') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.hideSupersededInsurances"
      :hint="i18n.t('settings.hideSupersededInsurancesHint')"
      @change="(hideSupersededInsurances) => emit('update', { hideSupersededInsurances })"
    >
      {{ i18n.t('settings.hideSupersededInsurances') }}
    </SettingCheck>

    <label class="shm-field-label" for="shm-buyback-link">
      {{ i18n.t('settings.buybackLink') }}
    </label>
    <select
      id="shm-buyback-link"
      class="shm-select"
      :value="settings.buybackLinkMode"
      @change="
        emit('update', {
          buybackLinkMode: ($event.target as HTMLSelectElement).value as BuybackLinkMode,
        })
      "
    >
      <option v-for="mode in BUYBACK_LINK_MODES" :key="mode" :value="mode">
        {{ i18n.t(`settings.buybackLinkOptions.${mode}`) }}
      </option>
    </select>
  </fieldset>
</template>
