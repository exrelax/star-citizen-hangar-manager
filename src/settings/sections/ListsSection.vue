<script setup lang="ts">
import erkulIcon from '@/assets/erkul.png';
import fleetyardsIcon from '@/assets/fleetyards.png';
import { i18n } from '@/i18n';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';
import { PRICE_INCREASES } from '@/config';
import {
  BUYBACK_LINK_MODES,
  isPriceIncreaseDays,
  type BuybackLinkMode,
  type Settings,
} from '../settings';

/*
 * What the lists of My Hangar and the buy back show: the insurance of upgraded ships, the links
 * for ships, where "Show in Buy Back" leads and the period of the expected price increases.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

const daysRange = PRICE_INCREASES.periodDays;

function setShipLink(platform: keyof Settings['shipLinks'], enabled: boolean) {
  emit('update', { shipLinks: { ...props.settings.shipLinks, [platform]: enabled } });
}

/** Stores whole days in range; anything else snaps back to the stored value (#192). */
function changeDays(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (isPriceIncreaseDays(value)) emit('update', { priceIncreaseDays: value });
  else input.value = String(props.settings.priceIncreaseDays);
}
</script>

<template>
  <SettingsGroup :title="i18n.t('settings.filtersLists.hangar')">
    <SettingCheck
      :checked="settings.hideSupersededInsurances"
      :hint="i18n.t('settings.hideSupersededInsurancesHint')"
      @change="(hideSupersededInsurances) => emit('update', { hideSupersededInsurances })"
    >
      {{ i18n.t('settings.hideSupersededInsurances') }}
    </SettingCheck>
  </SettingsGroup>

  <SettingsGroup :title="i18n.t('settings.shipLinks')">
    <SettingCheck
      :checked="settings.shipLinks.erkul"
      @change="(enabled) => setShipLink('erkul', enabled)"
    >
      <img class="shm-check-icon" :src="erkulIcon" alt="" width="14" height="14" />
      {{ i18n.t('settings.shipLinkErkul') }}
    </SettingCheck>
    <SettingCheck
      :checked="settings.shipLinks.fleetyards"
      @change="(enabled) => setShipLink('fleetyards', enabled)"
    >
      <img class="shm-check-icon" :src="fleetyardsIcon" alt="" width="14" height="14" />
      {{ i18n.t('settings.shipLinkFleetyards') }}
    </SettingCheck>
  </SettingsGroup>

  <SettingsGroup :title="i18n.t('settings.filtersLists.buyback')">
    <SettingRow :label="i18n.t('settings.buybackLink')" for="shm-buyback-link">
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
    </SettingRow>
    <!-- The period of the buy back filter "Price increase expected" and its notification. -->
    <SettingRow
      :label="i18n.t('settings.priceIncreaseDays')"
      :hint="i18n.t('settings.priceIncreaseDaysHint')"
      for="shm-price-increase-days"
      hint-id="shm-price-increase-days-hint"
    >
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
    </SettingRow>
  </SettingsGroup>
</template>

<style scoped>
/* Favicon of the platform a switch stands for, as on its link buttons. */
.shm-check-icon {
  flex: none;
  margin-right: 6px;
  vertical-align: -2px;
}
</style>
