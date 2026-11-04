<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { browserLocale, i18n, LOCALES, type Locale } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import type { LanguageSetting, Settings } from '../settings';

defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** Name of a language in that language, e.g. "Deutsch". */
function languageName(code: Locale) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}
</script>

<template>
  <section class="shm-setting">
    <label class="shm-label" for="shm-language">{{ i18n.t('settings.language') }}</label>
    <select
      id="shm-language"
      class="shm-select"
      :value="settings.language"
      @change="
        emit('update', { language: ($event.target as HTMLSelectElement).value as LanguageSetting })
      "
    >
      <option value="auto">
        {{ i18n.t('settings.languageAuto', [languageName(browserLocale())]) }}
      </option>
      <option v-for="code in LOCALES" :key="code" :value="code">{{ languageName(code) }}</option>
    </select>
    <p class="shm-hint">{{ i18n.t('settings.languageHint') }}</p>
    <SettingCheck
      class="is-spaced"
      :checked="settings.translateRsiTexts"
      :hint="i18n.t('settings.translateRsiTextsHint')"
      @change="(translateRsiTexts) => emit('update', { translateRsiTexts })"
    >
      {{ i18n.t('settings.translateRsiTexts') }}
      <span class="shm-experimental">
        <SvgIcon name="triangle-exclamation" />
        {{ i18n.t('settings.experimental') }}
      </span>
    </SettingCheck>
  </section>
</template>

<style scoped>
/* Marks a setting whose result may not always be right (here: translations that lag behind). */
.shm-experimental {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  color: var(--shm-warning);
  font-size: calc(11px * var(--shm-font-scale));
  border: 1px solid currentColor;
  border-radius: 999px;
}
</style>
