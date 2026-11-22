<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import { rebuySummary } from '../rebuy-summary';
import { rebuyVolumeNote } from '../rebuy-text';
import { useProvidedRebuyables, useRebuyDisplay } from '../use-rebuyables';
import RebuyWatchlistAction from './RebuyWatchlistAction.vue';

/*
 * The bar of the List Shortcut "Melt and rebuy" (#530, `rebuy-shortcut.ts`) after its count: the
 * store credit its pledges left by search and filters free, unless values are hidden, a note on
 * paints bought at a volume discount (#593) and the button to put them on a watchlist (#531).
 */

const props = defineProps<{
  /** The pledges of the shortcut that search and filters leave visible. */
  entries: readonly PledgeView[];
}>();

const rebuys = useProvidedRebuyables();
const display = useRebuyDisplay();
const ids = computed(() => props.entries.map((entry) => entry.id));
const freed = computed(() =>
  formatUsd(rebuySummary(rebuys.value, ids.value).freedCredit, locale.value),
);
/** Paints bought at a volume discount get it again only with enough paints (#593). */
const volumeNote = computed(() =>
  rebuyVolumeNote(props.entries.map((entry) => rebuys.value.get(entry.id))),
);
</script>

<template>
  <span v-if="!display.hideValues">{{ i18n.t('meltRebuy.shortcutFreed', [freed]) }}</span>
  <span
    v-if="volumeNote"
    v-tooltip="volumeNote"
    class="shm-shortcut-note"
    tabindex="0"
    :aria-label="volumeNote"
  >
    <SvgIcon name="circle-info" />
  </span>
  <RebuyWatchlistAction :pledge-ids="ids" button-class="shm-origin-button" inline />
</template>

<style scoped>
/* An info icon with its note as tooltip (#593). */
.shm-shortcut-note {
  display: inline-flex;
  align-items: center;
  color: var(--shm-text-muted);
  cursor: help;
}

.shm-shortcut-note .shm-icon {
  width: 13px;
  height: 13px;
}
</style>
