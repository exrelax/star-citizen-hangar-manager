<script setup lang="ts">
import { browserLocale, i18n, LOCALES, type Locale } from '@/i18n';
import FontSizeSlider from '../FontSizeSlider.vue';
import SegmentedControl from '../SegmentedControl.vue';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';
import { THEMES, type LanguageSetting, type Settings, type Theme } from '../settings';

/*
 * How the manager talks and looks: its language, the theme and the font size, then the layout of
 * the lists and the look of the exchange and gift dialogs.
 */

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** Name of a language in that language, e.g. "Deutsch". */
function languageName(code: Locale) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

const themes = () =>
  THEMES.map((theme) => ({ value: theme, label: i18n.t(`settings.themeOptions.${theme}`) }));
</script>

<template>
  <SettingsGroup>
    <SettingRow
      :label="i18n.t('settings.language')"
      :hint="i18n.t('settings.languageHint')"
      for="shm-language"
      hint-id="shm-language-hint"
    >
      <select
        id="shm-language"
        class="shm-select"
        :value="settings.language"
        aria-describedby="shm-language-hint"
        @change="
          emit('update', {
            language: ($event.target as HTMLSelectElement).value as LanguageSetting,
          })
        "
      >
        <option value="auto">
          {{ i18n.t('settings.languageAuto', [languageName(browserLocale())]) }}
        </option>
        <option v-for="code in LOCALES" :key="code" :value="code">
          {{ languageName(code) }}
        </option>
      </select>
    </SettingRow>
    <SettingRow :hint="i18n.t('settings.themeHint')">
      <template #label
        ><span id="shm-theme-label">{{ i18n.t('settings.theme') }}</span></template
      >
      <SegmentedControl
        :model-value="settings.theme"
        :options="themes()"
        labelledby="shm-theme-label"
        @update:model-value="(theme: Theme) => emit('update', { theme })"
      />
    </SettingRow>
    <SettingRow>
      <template #label>
        <span id="shm-font-size-label">{{ i18n.t('settings.fontSize') }}</span>
      </template>
      <FontSizeSlider
        :model-value="settings.fontSize"
        labelledby="shm-font-size-label"
        @update:model-value="(fontSize) => emit('update', { fontSize })"
      />
    </SettingRow>
  </SettingsGroup>

  <SettingsGroup :title="i18n.t('settings.layout')">
    <!-- One setting for both themes; each theme shows it in its own way (see its hint). -->
    <SettingCheck
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
  </SettingsGroup>
</template>
