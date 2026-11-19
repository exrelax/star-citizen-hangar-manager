<script setup lang="ts">
import {
  alwaysAvailableSources,
  chosenAlwaysAvailableSource,
  listDate as dateOfList,
} from '@/ccu-consultant/always-available';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import { useShipFacts } from '@/ships/use-ship-facts';
import { computed } from 'vue';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';
import type { Settings } from '../settings';

/*
 * The CCU Consultant (#106, #110): whether ships always available in the Pledge Store count as a
 * base ship of their CCUs, and the list that tells which ones are – its source, date and license.
 * With several sources a menu picks one.
 */

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ update: [patch: Partial<Settings>] }>();

function set<K extends keyof Settings['ccuConsultant']>(
  key: K,
  value: Settings['ccuConsultant'][K],
) {
  emit('update', { ccuConsultant: { ...props.settings.ccuConsultant, [key]: value } });
}

const facts = useShipFacts();
const sources = computed(() => alwaysAvailableSources(facts.value));
const source = computed(() => chosenAlwaysAvailableSource(props.settings, facts.value));
const off = computed(() => !props.settings.ccuConsultant.considerAlwaysAvailable);

/** The date of the list, e.g. "Nov 18, 2026"; none while it isn't known. */
const listDate = computed(() => dateOfList(facts.value?.changedAt, locale.value));
const sourceOptions = computed(() =>
  sources.value.map((entry) => ({ value: entry.id, label: entry.name })),
);
</script>

<template>
  <SettingsGroup>
    <SettingCheck
      :checked="settings.ccuConsultant.considerAlwaysAvailable"
      :hint="i18n.t('settings.ccuAlwaysAvailableHint')"
      @change="(value) => set('considerAlwaysAvailable', value)"
    >
      {{ i18n.t('settings.ccuAlwaysAvailable') }}
    </SettingCheck>
    <SettingRow
      :label="i18n.t('settings.ccuSource')"
      :hint="listDate ? i18n.t('settings.ccuSourceDate', [listDate]) : undefined"
      :disabled="off"
      indented
    >
      <SelectMenu
        v-if="sources.length > 1 && source"
        :options="sourceOptions"
        :model-value="source.id"
        :label="i18n.t('settings.ccuSource')"
        @update:model-value="(id) => set('alwaysAvailableSource', id)"
      />
      <a
        v-else-if="source"
        class="shm-ccu-source"
        :href="source.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ source.name }}
        <SvgIcon name="square-up-right" />
      </a>
      <span v-else class="shm-hint">{{ i18n.t('settings.ccuSourceNone') }}</span>
    </SettingRow>
    <template v-if="source?.license" #after>
      <!-- The source's license asks for the attribution. -->
      <p class="shm-settings-group-foot">
        {{ i18n.t('settings.ccuAttribution', [source.name]) }}
        <a
          v-if="source.licenseUrl"
          :href="source.licenseUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ source.license }}</a
        >
        <template v-else>{{ source.license }}</template>
      </p>
    </template>
  </SettingsGroup>
</template>

<style scoped>
.shm-ccu-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--shm-accent);
  text-decoration: none;
  white-space: nowrap;
}

.shm-ccu-source:hover,
.shm-ccu-source:focus-visible {
  text-decoration: underline;
}

.shm-ccu-source svg {
  width: 0.85em;
  height: 0.85em;
}

.shm-settings-group-foot a {
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-settings-group-foot a:hover,
.shm-settings-group-foot a:focus-visible {
  text-decoration: underline;
}
</style>
