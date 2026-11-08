<script setup lang="ts">
import { browserLocale, i18n, LOCALES, type Locale } from '@/i18n';
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
  </section>
</template>
