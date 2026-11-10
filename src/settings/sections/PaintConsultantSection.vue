<script setup lang="ts">
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';
import {
  CONSULTANT_LAYOUTS,
  REBOUGHT_DETECTIONS,
  type ConsultantLayout,
  type ReboughtDetection,
  type Settings,
} from '../settings';

/*
 * The Paint Discount Consultant (see `store/paint-consultant`): what it may use to reach a
 * higher volume discount for paints, how it finds paints bought again and how it shows its plan.
 * It always buys with store credit, never with new money.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

function set<K extends keyof Settings['paintConsultant']>(
  key: K,
  value: Settings['paintConsultant'][K],
) {
  emit('update', { paintConsultant: { ...props.settings.paintConsultant, [key]: value } });
}
</script>

<template>
  <SettingsGroup>
    <SettingCheck
      :checked="settings.paintConsultant.useStoreCredit"
      :hint="i18n.t('settings.paintConsultantStoreCreditHint')"
      @change="(value) => set('useStoreCredit', value)"
    >
      {{ i18n.t('settings.paintConsultantStoreCredit') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.paintConsultant.useFillers"
      :hint="i18n.t('settings.paintConsultantFillersHint')"
      @change="(value) => set('useFillers', value)"
    >
      {{ i18n.t('settings.paintConsultantFillers') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.paintConsultant.skipGiftable"
      :hint="i18n.t('settings.paintConsultantGiftableHint')"
      @change="(value) => set('skipGiftable', value)"
    >
      {{ i18n.t('settings.paintConsultantGiftable') }}
    </SettingCheck>
  </SettingsGroup>

  <SettingsGroup>
    <SettingRow
      :label="i18n.t('settings.reboughtDetection')"
      :hint="i18n.t('settings.reboughtDetectionHint')"
      for="shm-rebought-detection"
    >
      <select
        id="shm-rebought-detection"
        class="shm-select"
        :value="settings.paintConsultant.reboughtDetection"
        @change="
          set('reboughtDetection', ($event.target as HTMLSelectElement).value as ReboughtDetection)
        "
      >
        <option v-for="mode in REBOUGHT_DETECTIONS" :key="mode" :value="mode">
          {{ i18n.t(`settings.reboughtDetectionOptions.${mode}`) }}
        </option>
      </select>
    </SettingRow>
    <SettingRow
      :label="i18n.t('settings.consultantLayout')"
      :hint="i18n.t('settings.consultantLayoutHint')"
      for="shm-consultant-layout"
    >
      <select
        id="shm-consultant-layout"
        class="shm-select"
        :value="settings.paintConsultant.layout"
        @change="set('layout', ($event.target as HTMLSelectElement).value as ConsultantLayout)"
      >
        <option v-for="layout in CONSULTANT_LAYOUTS" :key="layout" :value="layout">
          {{ i18n.t(`settings.consultantLayoutOptions.${layout}`) }}
        </option>
      </select>
    </SettingRow>
  </SettingsGroup>
</template>
