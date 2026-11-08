<script setup lang="ts">
import { SIDEBAR_BOXES, type SidebarBox } from '@/hangar/sidebar';
import { i18n, type MessageKey } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import type { Settings } from '../settings';

/*
 * The sidebar below RSI's navigation (see `hangar/components/HangarSidebar.vue`): whether it is
 * shown, and which of its boxes. The boxes only count while the sidebar is shown.
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

function setBox(box: SidebarBox, shown: boolean) {
  const hidden = props.settings.sidebarHidden.filter((other) => other !== box);
  emit('update', { sidebarHidden: shown ? hidden : [...hidden, box] });
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.sidebar') }}</legend>
    <SettingCheck
      :checked="settings.sidebar"
      :hint="i18n.t('settings.sidebarShowHint')"
      @change="(sidebar) => emit('update', { sidebar })"
    >
      {{ i18n.t('settings.sidebarShow') }}
    </SettingCheck>

    <!-- The boxes, below the switch they depend on. -->
    <div
      class="shm-setting-subgroup"
      role="group"
      :aria-label="i18n.t('settings.sidebarBoxes')"
      :aria-disabled="!settings.sidebar"
    >
      <p class="shm-field-label">{{ i18n.t('settings.sidebarBoxes') }}</p>
      <SettingCheck
        v-for="box in SIDEBAR_BOXES"
        :key="box"
        :checked="!settings.sidebarHidden.includes(box)"
        :disabled="!settings.sidebar"
        :hint="hint(box)"
        @change="(shown) => setBox(box, shown)"
      >
        {{ i18n.t(LABELS[box]) }}
      </SettingCheck>
      <SettingCheck
        class="is-spaced"
        :checked="settings.summaryTypes"
        :disabled="!settings.sidebar"
        :hint="i18n.t('settings.summaryTypesHint')"
        @change="(summaryTypes) => emit('update', { summaryTypes })"
      >
        {{ i18n.t('settings.summaryTypes') }}
      </SettingCheck>
    </div>
  </fieldset>
</template>
