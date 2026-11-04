<script setup lang="ts">
import erkulIcon from '@/assets/erkul.png';
import fleetyardsIcon from '@/assets/fleetyards.png';
import { DEMO, FILTERS, REFUND_DAYS, REPOSITORY_URL } from '@/config';
import SvgIcon from '@/icons/SvgIcon.vue';
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
import FontSizeSlider from './FontSizeSlider.vue';
import { OPEN_STYLEGUIDE } from '@/shared/messages';
import { FILTER_CATEGORIES, type FilterCategory, type FilterLayout } from '@/hangar/filters';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** Name of a language in that language, e.g. "Deutsch". */
function languageName(code: Locale) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

const filterLabel = (filter: string) => i18n.t(`filter.${filter}` as MessageKey);

const FILTER_LISTS = ['hangar', 'buyback'] as const;

function setFilters(
  list: keyof Settings['filters'],
  category: FilterCategory,
  layout: FilterLayout<string>,
) {
  const groups = { ...props.settings.filters[list], [category]: layout };
  emit('update', { filters: { ...props.settings.filters, [list]: groups } });
}

function setShipLink(platform: keyof Settings['shipLinks'], enabled: boolean) {
  emit('update', { shipLinks: { ...props.settings.shipLinks, [platform]: enabled } });
}

const showStyleguideLink = import.meta.env.DEV && !location.pathname.endsWith('/styleguide.html');
const openStyleguide = () => void browser.runtime.sendMessage(OPEN_STYLEGUIDE);
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
      <label class="shm-check shm-language-option">
        <input
          type="checkbox"
          :checked="settings.translateRsiTexts"
          @change="
            emit('update', { translateRsiTexts: ($event.target as HTMLInputElement).checked })
          "
        />
        {{ i18n.t('settings.translateRsiTexts') }}
        <span class="shm-experimental">
          <SvgIcon name="triangle-exclamation" />
          {{ i18n.t('settings.experimental') }}
        </span>
      </label>
      <p class="shm-hint is-indented">{{ i18n.t('settings.translateRsiTextsHint') }}</p>
    </section>

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
      <div class="shm-theme-options">
        <label class="shm-check shm-language-option">
          <input
            type="checkbox"
            :checked="settings.compactView"
            @change="emit('update', { compactView: ($event.target as HTMLInputElement).checked })"
          />
          {{ i18n.t('settings.compactView') }}
        </label>
        <p class="shm-hint is-indented">
          {{ i18n.t(`settings.compactViewHint.${settings.theme}`) }}
        </p>
      </div>

      <label class="shm-check shm-language-option">
        <input
          type="checkbox"
          :checked="settings.themedActionDialogs"
          @change="
            emit('update', { themedActionDialogs: ($event.target as HTMLInputElement).checked })
          "
        />
        {{ i18n.t('settings.themedActionDialogs') }}
      </label>
      <p class="shm-hint is-indented">{{ i18n.t('settings.themedActionDialogsHint') }}</p>
    </section>

    <section class="shm-setting">
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.hideSupersededInsurances"
          @change="
            emit('update', {
              hideSupersededInsurances: ($event.target as HTMLInputElement).checked,
            })
          "
        />
        {{ i18n.t('settings.hideSupersededInsurances') }}
      </label>
      <p class="shm-hint">{{ i18n.t('settings.hideSupersededInsurancesHint') }}</p>
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
        <div v-for="list in FILTER_LISTS" :key="list" class="shm-filter-list">
          <span class="shm-filter-list-title">{{ i18n.t(`settings.filtersLists.${list}`) }}</span>
          <FilterLayoutSetting
            v-for="category in FILTER_CATEGORIES"
            :id="`shm-filters-${list}-${category}`"
            :key="category"
            :title="i18n.t(`filter.categories.${category}`)"
            :layout="settings.filters[list][category]"
            :defaults="FILTERS[list][category]"
            :filter-label="filterLabel"
            @update="setFilters(list, category, $event)"
          />
        </div>
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
        <img class="shm-check-icon" :src="erkulIcon" alt="" width="14" height="14" />
        {{ i18n.t('settings.shipLinkErkul') }}
      </label>
      <label class="shm-check">
        <input
          type="checkbox"
          :checked="settings.shipLinks.fleetyards"
          @change="setShipLink('fleetyards', ($event.target as HTMLInputElement).checked)"
        />
        <img class="shm-check-icon" :src="fleetyardsIcon" alt="" width="14" height="14" />
        {{ i18n.t('settings.shipLinkFleetyards') }}
      </label>
    </fieldset>

    <section class="shm-setting">
      <span class="shm-label">{{ i18n.t('settings.development') }}</span>
      <ul class="shm-dev-links">
        <!-- Development builds only, and not on the styleguide itself (see wxt.config.ts). -->
        <li v-if="showStyleguideLink">
          <a class="shm-dev-link" href="#" @click.prevent="openStyleguide">
            <SvgIcon name="paintbrush" />
            Styleguide
          </a>
          <p class="shm-hint">
            All building blocks of the manager with made-up pledges, in a new tab.
          </p>
        </li>
        <li>
          <a class="shm-dev-link" :href="REPOSITORY_URL" target="_blank" rel="noopener noreferrer">
            <SvgIcon name="github" />
            {{ i18n.t('popup.repository') }}
          </a>
          <p class="shm-hint">{{ i18n.t('settings.repositoryHint') }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.shm-settings {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 20px;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
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
  font-size: calc(13px * var(--shm-font-scale));
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

/* Favicon of the platform a checkbox stands for, as on its link buttons. */
.shm-check-icon {
  flex: none;
  margin-right: -2px;
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

.shm-dev-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-dev-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-dev-link:hover,
.shm-dev-link:focus-visible {
  text-decoration: underline;
  outline: none;
}

.shm-language-option {
  margin-top: 14px;
}

/* Options of the selected theme, below the theme and its font size. */
.shm-theme-options {
  margin-top: 14px;
}

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

.shm-hint {
  margin: 6px 0 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

/* Hint right under the legend, before the controls. */
.shm-hint.is-first {
  margin: 0 0 12px;
}

.shm-filter-layouts {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 28px;
}

/* One list (My Hangar, Buy Back): its title, then a block per category. */
.shm-filter-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: 220px;
}

.shm-filter-list-title {
  color: var(--shm-text-strong);
  font-size: calc(13px * var(--shm-font-scale));
}

/* Hint of a checkbox in a group: under its label text, before the next checkbox. */
.shm-hint.is-indented {
  margin: 0 0 8px 21px;
}
</style>
