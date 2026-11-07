<script setup lang="ts">
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import { BUYBACK_LINK_MODES, type BuybackLinkMode, type Settings } from '../settings';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.general') }}</legend>
    <SettingCheck
      :checked="settings.hideSupersededInsurances"
      :hint="i18n.t('settings.hideSupersededInsurancesHint')"
      @change="(hideSupersededInsurances) => emit('update', { hideSupersededInsurances })"
    >
      {{ i18n.t('settings.hideSupersededInsurances') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.summaryTypes"
      :hint="i18n.t('settings.summaryTypesHint')"
      @change="(summaryTypes) => emit('update', { summaryTypes })"
    >
      {{ i18n.t('settings.summaryTypes') }}
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
