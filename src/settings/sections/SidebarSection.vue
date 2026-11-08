<script setup lang="ts">
import { isDefaultSidebarOrder, SIDEBAR_BOXES, type SidebarBox } from '@/hangar/sidebar';
import { i18n, type MessageKey } from '@/i18n';
import { vTooltip } from '@/shared/tooltip/tooltip';
import SettingCheck from '../SettingCheck.vue';
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
      <div class="shm-sidebar-boxes-head">
        <p class="shm-field-label">{{ i18n.t('settings.sidebarBoxes') }}</p>
        <button
          v-if="!isDefaultSidebarOrder(settings.sidebarOrder)"
          v-tooltip="i18n.t('settings.sidebarOrderResetHint')"
          type="button"
          class="shm-link-button"
          :disabled="!settings.sidebar"
          @click="resetOrder"
        >
          {{ i18n.t('settings.sidebarOrderReset') }}
        </button>
      </div>
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

<style scoped>
/* The label of the boxes, with the reset of their order at the right edge. */
.shm-sidebar-boxes-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.shm-settings .shm-sidebar-boxes-head .shm-field-label {
  margin: 0 0 6px;
}

/* As the reset of the filter layout (FilterLayoutSetting.vue). */
.shm-link-button {
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  font-size: calc(12px * var(--shm-font-scale));
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-link-button:hover:not(:disabled),
.shm-link-button:focus-visible {
  text-decoration: underline;
  outline: none;
}

.shm-link-button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
