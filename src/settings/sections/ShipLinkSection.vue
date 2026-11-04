<script setup lang="ts">
import erkulIcon from '@/assets/erkul.png';
import fleetyardsIcon from '@/assets/fleetyards.png';
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import type { Settings } from '../settings';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

function setShipLink(platform: keyof Settings['shipLinks'], enabled: boolean) {
  emit('update', { shipLinks: { ...props.settings.shipLinks, [platform]: enabled } });
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.shipLinks') }}</legend>
    <SettingCheck
      :checked="settings.shipLinks.erkul"
      @change="(enabled) => setShipLink('erkul', enabled)"
    >
      <img class="shm-check-icon" :src="erkulIcon" alt="" width="14" height="14" />
      {{ i18n.t('settings.shipLinkErkul') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.shipLinks.fleetyards"
      @change="(enabled) => setShipLink('fleetyards', enabled)"
    >
      <img class="shm-check-icon" :src="fleetyardsIcon" alt="" width="14" height="14" />
      {{ i18n.t('settings.shipLinkFleetyards') }}
    </SettingCheck>
  </fieldset>
</template>

<style scoped>
/* Favicon of the platform a checkbox stands for, as on its link buttons. */
.shm-check-icon {
  flex: none;
  margin-right: -2px;
}
</style>
