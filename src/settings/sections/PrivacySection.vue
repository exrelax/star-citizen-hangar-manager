<script setup lang="ts">
import { REFUND_DAYS } from '@/config';
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import type { Settings } from '../settings';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.privacy') }}</legend>
    <SettingCheck
      :checked="settings.hideMeltValue"
      :hint="i18n.t('settings.hideMeltValueHint')"
      @change="(hideMeltValue) => emit('update', { hideMeltValue })"
    >
      {{ i18n.t('settings.hideMeltValue') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.hidePledgeIds"
      :hint="i18n.t('settings.hidePledgeIdsHint')"
      @change="(hidePledgeIds) => emit('update', { hidePledgeIds })"
    >
      {{ i18n.t('settings.hidePledgeIds') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.hideRefund"
      :hint="i18n.t('settings.hideRefundHint', [REFUND_DAYS])"
      @change="(hideRefund) => emit('update', { hideRefund })"
    >
      {{ i18n.t('settings.hideRefund') }}
    </SettingCheck>
    <!-- Not just hiding: a whole made-up hangar instead (#129), set apart from the rest. -->
    <SettingCheck
      class="is-spaced"
      :checked="settings.demoMode"
      :hint="i18n.t('settings.demoModeHint')"
      @change="(demoMode) => emit('update', { demoMode })"
    >
      {{ i18n.t('settings.demoMode') }}
    </SettingCheck>
  </fieldset>
</template>
