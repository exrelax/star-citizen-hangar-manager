<script setup lang="ts">
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import type { Settings } from '../settings';

/*
 * The Paint Discount Consultant (see `store/paint-consultant`): what it may use to reach a
 * higher volume discount for paints. It always buys with store credit, never with new money.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

function set(key: keyof Settings['paintConsultant'], value: boolean) {
  emit('update', { paintConsultant: { ...props.settings.paintConsultant, [key]: value } });
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.paintConsultant') }}</legend>
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
  </fieldset>
</template>
