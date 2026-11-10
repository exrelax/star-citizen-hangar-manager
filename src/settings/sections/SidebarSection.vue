<script setup lang="ts">
import { isDefaultSidebarOrder, SIDEBAR_BOXES, type SidebarBox } from '@/hangar/sidebar';
import { i18n, type MessageKey } from '@/i18n';
import { vTooltip } from '@/shared/tooltip/tooltip';
import SettingCheck from '../SettingCheck.vue';
import SettingsGroup from '../SettingsGroup.vue';
import type { Settings } from '../settings';

/*
 * The sidebar below RSI's navigation (see `hangar/components/HangarSidebar.vue`): whether it is
 * shown, and which of its boxes. The boxes only count while the sidebar is shown. Their order is
 * changed in the sidebar itself; here it can only be reset (shown while it isn't the default).
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const LABELS: Record<SidebarBox, MessageKey> = {
  notifications: 'notifications.title',
  summary: 'summary.title',
  selection: 'summary.selected',
  paintConsultant: 'consultant.boxTitle',
};
const HINTS: Partial<Record<SidebarBox, MessageKey>> = {
  notifications: 'settings.sidebarNotificationsHint',
  selection: 'settings.sidebarSelectionHint',
  paintConsultant: 'settings.sidebarPaintConsultantHint',
};
const hint = (box: SidebarBox) => {
  const key = HINTS[box];
  return key && i18n.t(key);
};

/** Back to the default order; shown and collapsed boxes stay as they are. */
const resetOrder = () => emit('update', { sidebarOrder: [...SIDEBAR_BOXES] });

function setBox(box: SidebarBox, shown: boolean) {
  const hidden = props.settings.sidebarHidden.filter((other) => other !== box);
  emit('update', { sidebarHidden: shown ? hidden : [...hidden, box] });
}
</script>

<template>
  <SettingsGroup>
    <SettingCheck
      :checked="settings.sidebar"
      :hint="i18n.t('settings.sidebarShowHint')"
      @change="(sidebar) => emit('update', { sidebar })"
    >
      {{ i18n.t('settings.sidebarShow') }}
    </SettingCheck>
  </SettingsGroup>

  <!-- The boxes, below the switch they depend on. -->
  <SettingsGroup :title="i18n.t('settings.sidebarBoxes')" :disabled="!settings.sidebar">
    <template v-if="!isDefaultSidebarOrder(settings.sidebarOrder)" #action>
      <button
        v-tooltip="i18n.t('settings.sidebarOrderResetHint')"
        type="button"
        class="shm-link-button"
        :disabled="!settings.sidebar"
        @click="resetOrder"
      >
        {{ i18n.t('settings.sidebarOrderReset') }}
      </button>
    </template>
    <template v-for="box in SIDEBAR_BOXES" :key="box">
      <SettingCheck
        :checked="!settings.sidebarHidden.includes(box)"
        :disabled="!settings.sidebar"
        :hint="hint(box)"
        @change="(shown) => setBox(box, shown)"
      >
        {{ i18n.t(LABELS[box]) }}
      </SettingCheck>
      <!-- Only for the "Summary" box: right below it. -->
      <SettingCheck
        v-if="box === 'summary'"
        indented
        :checked="settings.summaryTypes"
        :disabled="!settings.sidebar || settings.sidebarHidden.includes('summary')"
        :hint="i18n.t('settings.summaryTypesHint')"
        @change="(summaryTypes) => emit('update', { summaryTypes })"
      >
        {{ i18n.t('settings.summaryTypes') }}
      </SettingCheck>
    </template>
  </SettingsGroup>
</template>
