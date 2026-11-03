<script setup lang="ts">
import { DEMO, FILTERS, REFUND_DAYS } from '@/config';
import { browserLocale, i18n, LOCALES, type Locale, type MessageKey } from '@/i18n';
import {
  BUYBACK_LINK_MODES,
  THEMES,
  type BuybackLinkMode,
  type LanguageSetting,
  type Settings,
  type Theme,
} from './settings';
import FilterLayoutSetting from './FilterLayoutSetting.vue';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** Name of a language in that language, e.g. "Deutsch". */
function languageName(code: Locale) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

const filterLabel = (filter: string) => i18n.t(`filter.${filter}` as MessageKey);

function setFilters<L extends keyof Settings['filters']>(list: L, layout: Settings['filters'][L]) {
  emit('update', { filters: { ...props.settings.filters, [list]: layout } });
}

function setShipLink(platform: keyof Settings['shipLinks'], enabled: boolean) {
  emit('update', { shipLinks: { ...props.settings.shipLinks, [platform]: enabled } });
}
</script>

<template>
  <div class="shm-settings">
    <section class="shm-setting">
      <label class="shm-label" for="shm-language">{{ i18n.t('settings.language') }}</label>
      <select
        id="shm-language"
        class="shm-select"
        :value="settings.language"
        @change="
          emit('update', {
            language: ($event.target as HTMLSelectElement).value as LanguageSetting,
          })
        "
      >
        <option value="auto">
          {{ i18n.t('settings.languageAuto', [languageName(browserLocale())]) }}
        </option>
        <option v-for="code in LOCALES" :key="code" :value="code">{{ languageName(code) }}</option>
      </select>
      <p class="shm-hint">{{ i18n.t('settings.languageHint') }}</p>
    </section>

    <section class="shm-setting">
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
      <p class="shm-hint">{{ i18n.t('settings.themeHint') }}</p>
    </section>

    <fieldset class="shm-setting">
      <legend class="shm-label">{{ i18n.t('settings.privacy') }}</legend>
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.hideMeltValue"
          @change="emit('update', { hideMeltValue: ($event.target as HTMLInputElement).checked })"
        />
        {{ i18n.t('settings.hideMeltValue') }}
      </label>
      <p class="shm-hint is-indented">{{ i18n.t('settings.hideMeltValueHint') }}</p>
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.hidePledgeIds"
          @change="emit('update', { hidePledgeIds: ($event.target as HTMLInputElement).checked })"
        />
        {{ i18n.t('settings.hidePledgeIds') }}
      </label>
      <p class="shm-hint is-indented">{{ i18n.t('settings.hidePledgeIdsHint') }}</p>
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.demoMode"
          @change="emit('update', { demoMode: ($event.target as HTMLInputElement).checked })"
        />
        {{ i18n.t('settings.demoMode') }}
      </label>
      <p class="shm-hint is-indented">
        {{ i18n.t('settings.demoModeHint', [DEMO.hangarPledges, DEMO.buybackPledges]) }}
      </p>
    </fieldset>

    <section class="shm-setting">
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.smartUpdates"
          @change="emit('update', { smartUpdates: ($event.target as HTMLInputElement).checked })"
        />
        {{ i18n.t('settings.smartUpdates') }}
      </label>
      <p class="shm-hint">{{ i18n.t('settings.smartUpdatesHint') }}</p>
    </section>

    <section class="shm-setting">
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.showRefund"
          @change="emit('update', { showRefund: ($event.target as HTMLInputElement).checked })"
        />
        {{ i18n.t('settings.showRefund') }}
      </label>
      <p class="shm-hint">{{ i18n.t('settings.showRefundHint', [REFUND_DAYS]) }}</p>
    </section>
    <section class="shm-setting">
      <label class="shm-label" for="shm-buyback-link">{{ i18n.t('settings.buybackLink') }}</label>
      <select
        id="shm-buyback-link"
        class="shm-select"
        :value="settings.buybackLinkMode"
        @change="
          emit('update', {
            buybackLinkMode: ($event.target as HTMLSelectElement).value as BuybackLinkMode,
          })
        "
      >
        <option v-for="mode in BUYBACK_LINK_MODES" :key="mode" :value="mode">
          {{ i18n.t(`settings.buybackLinkOptions.${mode}`) }}
        </option>
      </select>
    </section>

    <fieldset class="shm-setting">
      <legend class="shm-label">{{ i18n.t('settings.filters') }}</legend>
      <p class="shm-hint is-first">{{ i18n.t('settings.filtersHint') }}</p>
      <div class="shm-filter-layouts">
        <FilterLayoutSetting
          id="shm-filters-hangar"
          :title="i18n.t('settings.filtersHangar')"
          :layout="settings.filters.hangar"
          :defaults="FILTERS.hangar"
          :filter-label="filterLabel"
          @update="setFilters('hangar', $event)"
        />
        <FilterLayoutSetting
          id="shm-filters-buyback"
          :title="i18n.t('settings.filtersBuyback')"
          :layout="settings.filters.buyback"
          :defaults="FILTERS.buyback"
          :filter-label="filterLabel"
          @update="setFilters('buyback', $event)"
        />
      </div>
    </fieldset>

    <fieldset class="shm-setting">
      <legend class="shm-label">{{ i18n.t('settings.shipLinks') }}</legend>
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.shipLinks.erkul"
          @change="setShipLink('erkul', ($event.target as HTMLInputElement).checked)"
        />
        {{ i18n.t('settings.shipLinkErkul') }}
      </label>
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.shipLinks.fleetyards"
          @change="setShipLink('fleetyards', ($event.target as HTMLInputElement).checked)"
        />
        {{ i18n.t('settings.shipLinkFleetyards') }}
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.shm-settings {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 20px;
  color: var(--shm-text);
  font-size: 13px;
}

.shm-setting {
  margin: 0;
  padding: 14px 16px;
  background: rgb(var(--shm-surface-rgb) / 0.6);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-label {
  display: block;
  margin-bottom: 8px;
  padding: 0;
  color: var(--shm-accent);
  font-size: 13px;
  text-transform: uppercase;
}

.shm-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  cursor: pointer;
}

.shm-check input {
  accent-color: var(--shm-accent);
}

.shm-select {
  min-width: 280px;
  height: 32px;
  /* Room on the right for the arrow, which sits inside instead of at the edge. */
  padding: 0 34px 0 10px;
  color: var(--shm-text);
  font: inherit;
  /* Own arrow instead of the browser's (that one sits right at the edge). Its gray works on
   * the dark and light backgrounds of all themes. */
  appearance: none;
  background-color: rgb(var(--shm-surface-rgb) / 0.9);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%238a9ba8' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px 8px;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.35);
  cursor: pointer;
}

.shm-hint {
  margin: 6px 0 0;
  color: var(--shm-text-muted);
  font-size: 12px;
}

/* Hint right under the legend, before the controls. */
.shm-hint.is-first {
  margin: 0 0 12px;
}

.shm-filter-layouts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 28px;
}

/* Hint of a checkbox in a group: under its label text, before the next checkbox. */
.shm-hint.is-indented {
  margin: 0 0 8px 21px;
}
</style>
