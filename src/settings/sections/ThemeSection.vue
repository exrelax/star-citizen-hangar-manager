<script setup lang="ts">
import { i18n } from '@/i18n';
import FontSizeSlider from '../FontSizeSlider.vue';
import SettingCheck from '../SettingCheck.vue';
import { THEMES, type Settings, type Theme } from '../settings';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();
</script>

<template>
  <section class="shm-setting">
    <!-- The theme and, to its right, the font size (the same for both themes). -->
    <div class="shm-theme-row">
      <div>
        <label class="shm-label" for="shm-theme">{{ i18n.t('settings.theme') }}</label>
        <select
          id="shm-theme"
          class="shm-select"
          :value="settings.theme"
          @change="emit('update', { theme: ($event.target as HTMLSelectElement).value as Theme })"
        >
          <option v-for="theme in THEMES" :key="theme" :value="theme">
            {{ i18n.t(`settings.themeOptions.${theme}`) }}
          </option>
        </select>
      </div>
      <div class="shm-font-size-setting">
        <span id="shm-font-size-label" class="shm-label">{{ i18n.t('settings.fontSize') }}</span>
        <FontSizeSlider
          :model-value="settings.fontSize"
          labelledby="shm-font-size-label"
          @update:model-value="(fontSize) => emit('update', { fontSize })"
        />
      </div>
    </div>
    <p class="shm-hint">{{ i18n.t('settings.themeHint') }}</p>

    <!-- One setting for both themes; each theme shows it in its own way (see its hint). -->
    <SettingCheck
      class="is-spaced"
      :checked="settings.compactView"
      :hint="i18n.t(`settings.compactViewHint.${settings.theme}`)"
      @change="(compactView) => emit('update', { compactView })"
    >
      {{ i18n.t('settings.compactView') }}
    </SettingCheck>
    <SettingCheck
      class="is-spaced"
      :checked="settings.themedActionDialogs"
      :hint="i18n.t('settings.themedActionDialogsHint')"
      @change="(themedActionDialogs) => emit('update', { themedActionDialogs })"
    >
      {{ i18n.t('settings.themedActionDialogs') }}
    </SettingCheck>
  </section>
</template>

<style scoped>
.shm-theme-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 32px;
}

/* The font size at the right edge of the section, also when it wraps below the theme. */
.shm-font-size-setting {
  margin-left: auto;
}
</style>
