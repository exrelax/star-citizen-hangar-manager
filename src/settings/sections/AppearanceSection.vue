<script setup lang="ts">
import { browserLocale, i18n, LOCALES, type Locale } from '@/i18n';
import FontSizeSlider from '../FontSizeSlider.vue';
import SettingCheck from '../SettingCheck.vue';
import { THEMES, type LanguageSetting, type Settings, type Theme } from '../settings';

/*
 * How the manager talks and looks: its language, the theme with the font size, the compact view
 * and the look of the exchange and gift dialogs (#117: language and theme in one section).
 */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** Name of a language in that language, e.g. "Deutsch". */
function languageName(code: Locale) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.appearance') }}</legend>
    <label class="shm-field-label" for="shm-language">{{ i18n.t('settings.language') }}</label>
    <select
      id="shm-language"
      class="shm-select"
      :value="settings.language"
      aria-describedby="shm-language-hint"
      @change="
        emit('update', { language: ($event.target as HTMLSelectElement).value as LanguageSetting })
      "
    >
      <option value="auto">
        {{ i18n.t('settings.languageAuto', [languageName(browserLocale())]) }}
      </option>
      <option v-for="code in LOCALES" :key="code" :value="code">{{ languageName(code) }}</option>
    </select>
    <p id="shm-language-hint" class="shm-hint">{{ i18n.t('settings.languageHint') }}</p>

    <!-- The theme and, to its right, the font size (the same for both themes). -->
    <div class="shm-theme-row">
      <div>
        <label class="shm-field-label" for="shm-theme">{{ i18n.t('settings.theme') }}</label>
        <select
          id="shm-theme"
          class="shm-select"
          :value="settings.theme"
          aria-describedby="shm-theme-hint"
          @change="emit('update', { theme: ($event.target as HTMLSelectElement).value as Theme })"
        >
          <option v-for="theme in THEMES" :key="theme" :value="theme">
            {{ i18n.t(`settings.themeOptions.${theme}`) }}
          </option>
        </select>
      </div>
      <div class="shm-font-size-setting">
        <span id="shm-font-size-label" class="shm-field-label">
          {{ i18n.t('settings.fontSize') }}
        </span>
        <FontSizeSlider
          :model-value="settings.fontSize"
          labelledby="shm-font-size-label"
          @update:model-value="(fontSize) => emit('update', { fontSize })"
        />
      </div>
    </div>
    <p id="shm-theme-hint" class="shm-hint">{{ i18n.t('settings.themeHint') }}</p>

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
      :checked="settings.themedActionDialogs"
      :hint="i18n.t('settings.themedActionDialogsHint')"
      @change="(themedActionDialogs) => emit('update', { themedActionDialogs })"
    >
      {{ i18n.t('settings.themedActionDialogs') }}
    </SettingCheck>
  </fieldset>
</template>

<style scoped>
.shm-theme-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0 32px;
}

/* The font size at the right edge of the section, also when it wraps below the theme. */
.shm-font-size-setting {
  margin-left: auto;
}
</style>
