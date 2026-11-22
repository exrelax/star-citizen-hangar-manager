<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/hangar/components/row.css';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, ref } from 'vue';
import { watchlistsByItem, type NewWatchItem } from '../use-watchlists';
import { itemKey } from '../watchlists';
import StoreWatchDialog from './StoreWatchDialog.vue';

/*
 * The button on RSI's own pages that puts a Pledge Store item on watchlists (#471): a paint on its
 * page, a CCU in RSI's ship upgrade dialog. It opens the same choice as in the Hangar Manager – the
 * watchlists and a new one –, in the theme of the settings, and is tinted while the item is on one.
 */

const props = defineProps<{ item: NewWatchItem; title: string }>();

const { settings } = useSettings();
const open = ref(false);
const on = computed(() => watchlistsByItem.value.has(itemKey(props.item)));
</script>

<template>
  <span class="shm-rsi-watch" :class="themeClasses(settings)" :style="fontScaleStyle(settings)">
    <button
      v-tooltip="title"
      type="button"
      class="shm-button shm-rsi-watch-button"
      :class="{ 'is-on': on }"
      aria-haspopup="dialog"
      @click.stop.prevent="open = true"
    >
      <SvgIcon name="clipboard-list" />
      {{ i18n.t(on ? 'watchlists.rsiOn' : 'watchlists.rsiPut') }}
    </button>
    <StoreWatchDialog v-if="open" :title="title" :item="item" @close="open = false" />
  </span>
</template>

<style>
.shm-rsi-watch {
  display: inline-flex;
  font-family: inherit;
}

/* On RSI's own backgrounds, light and dark: a surface of its own, as the manager's dialogs. */
.shm-rsi-watch .shm-rsi-watch-button,
.shm-rsi-watch .shm-rsi-watch-button:not(:disabled):hover,
.shm-rsi-watch .shm-rsi-watch-button:not(:disabled):focus-visible {
  color: var(--shm-text-strong);
  background: var(--shm-surface-elevated);
}

.shm-rsi-watch .shm-rsi-watch-button:not(:disabled):hover {
  filter: brightness(1.2);
}

.shm-rsi-watch .shm-rsi-watch-button {
  min-height: 40px;
  padding: 8px 14px;
  font-size: calc(13px * var(--shm-font-scale));
  white-space: nowrap;
  cursor: pointer;
}

.shm-rsi-watch .shm-rsi-watch-button.is-on,
.shm-rsi-watch .shm-rsi-watch-button.is-on:not(:disabled):hover {
  color: var(--shm-text-on-accent);
  background: var(--shm-accent);
}
</style>
