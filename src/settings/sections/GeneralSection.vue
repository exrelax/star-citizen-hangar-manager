<script setup lang="ts">
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import { PRICE_INCREASES } from '@/config';
import {
  BUYBACK_LINK_MODES,
  isPriceIncreaseDays,
  type BuybackLinkMode,
  type Settings,
} from '../settings';

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const daysRange = PRICE_INCREASES.periodDays;

/** Stores whole days in range; anything else snaps back to the stored value (#192). */
function changeDays(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (isPriceIncreaseDays(value)) emit('update', { priceIncreaseDays: value });
  else input.value = String(props.settings.priceIncreaseDays);
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('settings.general') }}</legend>
    <SettingCheck
      :checked="settings.hideSupersededInsurances"
      :hint="i18n.t('settings.hideSupersededInsurancesHint')"
      @change="(hideSupersededInsurances) => emit('update', { hideSupersededInsurances })"
    >
      {{ i18n.t('settings.hideSupersededInsurances') }}
    </SettingCheck>

    <label class="shm-field-label" for="shm-buyback-link">
      {{ i18n.t('settings.buybackLink') }}
    </label>
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

    <!-- The period of the buy back filter "Price increase expected" and its notification. -->
    <label class="shm-field-label" for="shm-price-increase-days">
      {{ i18n.t('settings.priceIncreaseDays') }}
    </label>
    <span class="shm-number-field">
      <input
        id="shm-price-increase-days"
        class="shm-input shm-number"
        type="number"
        inputmode="numeric"
        :min="daysRange.min"
        :max="daysRange.max"
        step="1"
        :value="settings.priceIncreaseDays"
        aria-describedby="shm-price-increase-days-hint"
        @change="changeDays"
      />
      {{ i18n.t('settings.priceIncreaseDaysUnit') }}
    </span>
    <p id="shm-price-increase-days-hint" class="shm-hint">
      {{ i18n.t('settings.priceIncreaseDaysHint') }}
    </p>
  </fieldset>
</template>
