<script setup lang="ts">
import { browserLocale, i18n, LOCALES, type Locale } from '@/i18n';
import {
  BUYBACK_LINK_MODES,
  REWARD_VISIBILITIES,
  type BuybackLinkMode,
  type LanguageSetting,
  type RewardVisibility,
  type Settings,
} from './settings';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

/** Name of a language in that language, e.g. "Deutsch". */
function languageName(code: Locale) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
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
      <label class="shm-label" for="shm-reward-visibility">{{ i18n.t('settings.rewards') }}</label>
      <select
        id="shm-reward-visibility"
        class="shm-select"
        :value="settings.rewardVisibility"
        @change="
          emit('update', {
            rewardVisibility: ($event.target as HTMLSelectElement).value as RewardVisibility,
          })
        "
      >
        <option v-for="option in REWARD_VISIBILITIES" :key="option" :value="option">
          {{ i18n.t(`settings.rewardOptions.${option}`) }}
        </option>
      </select>
      <p class="shm-hint">{{ i18n.t('settings.rewardsHint') }}</p>
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
  color: #dbe7ee;
  font-size: 13px;
}

.shm-setting {
  margin: 0;
  padding: 14px 16px;
  background: rgba(10, 20, 30, 0.6);
  border: 1px solid rgba(98, 196, 235, 0.15);
}

.shm-label {
  display: block;
  margin-bottom: 8px;
  padding: 0;
  color: #62c4eb;
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
  accent-color: #62c4eb;
}

.shm-select {
  min-width: 280px;
  height: 32px;
  padding: 0 8px;
  color: #dbe7ee;
  font: inherit;
  background: rgba(10, 20, 30, 0.9);
  border: 1px solid rgba(98, 196, 235, 0.35);
}

.shm-hint {
  margin: 6px 0 0;
  color: #8a9ba8;
  font-size: 12px;
}

/* Hint of a checkbox in a group: under its label text, before the next checkbox. */
.shm-hint.is-indented {
  margin: 0 0 8px 21px;
}
</style>
