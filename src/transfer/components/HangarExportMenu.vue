<script setup lang="ts">
import { i18n } from '@/i18n';
import type { Settings } from '@/settings/settings';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import { computed, ref } from 'vue';
import { exportHangar, HANGAR_FORMATS, type HangarFormat } from '../transfer-actions';

/*
 * The export button of My Hangar (#232): the pledges search, filters and a List Shortcut leave
 * visible, in a format chosen from its menu, with the ids and amounts left out as the settings'
 * "Privacy" section hides them. Not in the demo mode, which would export the account (#233).
 */

const props = defineProps<{ pledgeIds: readonly number[]; settings: Settings }>();

const options = computed(() =>
  HANGAR_FORMATS.map((value) => ({ value, label: i18n.t(`transfer.formats.${value}`) })),
);
/** Nothing chosen: each choice is an export, not a setting. */
const chosen = ref<HangarFormat | ''>('');

async function choose(format: HangarFormat | '') {
  if (!format) return;
  chosen.value = format;
  try {
    await exportHangar(format, {
      pledgeIds: new Set(props.pledgeIds),
      hideIds: props.settings.hidePledgeIds,
      hideAmounts: props.settings.hideMeltValue,
    });
  } finally {
    chosen.value = '';
  }
}
</script>

<template>
  <SelectMenu
    v-if="!settings.demoMode && pledgeIds.length"
    :model-value="chosen"
    :options="options"
    :label="i18n.t('transfer.exportShown')"
    icon="file-export"
    icon-only
    @update:model-value="choose"
  />
</template>
