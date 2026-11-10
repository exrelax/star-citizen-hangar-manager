<script setup lang="ts">
import { REFUND_DAYS } from '@/config';
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import SettingsGroup from '../SettingsGroup.vue';
import { currentCategory } from '../categories';
import type { Settings } from '../settings';

/** What to hide for screenshots, streams and videos; a whole made-up hangar is the demo mode. */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
</script>

<template>
  <p class="shm-settings-intro">{{ i18n.t('settings.privacy') }}</p>
  <SettingsGroup>
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
    <template #after>
      <p class="shm-settings-group-foot">
        {{ i18n.t('settings.privacyDemo') }}
        <button type="button" class="shm-link-button" @click="currentCategory = 'demo'">
          {{ i18n.t('settings.demo.title') }}
        </button>
      </p>
    </template>
  </SettingsGroup>
</template>
