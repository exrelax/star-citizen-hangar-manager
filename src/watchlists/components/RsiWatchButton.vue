<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/hangar/components/row.css';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import { watchlistsByItem, type NewWatchItem } from '../use-watchlists';
import { itemKey } from '../watchlists';
import type { RsiWatchPlace } from '../rsi-pages';
import StoreWatchDialog from './StoreWatchDialog.vue';

/*
 * The button on RSI's own pages that puts a Pledge Store item on watchlists (#471): a paint on its
 * page and on its card in the store's lists (#632), a CCU in RSI's ship upgrade dialog. The button
 * follows RSI's design where it sits (#632), outlined next to RSI's filled "Add to cart", so it is
 * clearly a button but less prominent; tinted while the item is on a watchlist. It opens the same
 * choice as in the Hangar Manager – the watchlists and a new one –, in the theme of the settings.
 */

const props = defineProps<{ item: NewWatchItem; title: string; place: RsiWatchPlace }>();

const open = ref(false);
const on = computed(() => watchlistsByItem.value.has(itemKey(props.item)));
const label = computed(() => i18n.t(on.value ? 'watchlists.rsiOn' : 'watchlists.rsiPut'));
// A card has room for its icon only: the tooltip and the label name the item.
const iconOnly = computed(() => props.place === 'card');
</script>

<template>
  <!-- No theme classes here: the theme's resets would win over RSI's look (#632); the dialog sets
       its own. -->
  <span class="shm-rsi-watch">
    <button
      v-tooltip="title"
      type="button"
      class="shm-rsi-watch-button"
      :class="[`is-${place}`, { 'is-on': on }]"
      :aria-label="iconOnly ? `${title} – ${label}` : undefined"
      aria-haspopup="dialog"
      @click.stop.prevent="open = true"
    >
      <SvgIcon :name="on ? 'clipboard-check' : 'clipboard-list'" />
      <span v-if="!iconOnly" class="shm-rsi-watch-label">{{ label }}</span>
    </button>
    <StoreWatchDialog v-if="open" :title="title" :item="item" @close="open = false" />
  </span>
</template>

<style>
.shm-rsi-watch {
  display: inline-flex;
  font-family: inherit;
}

/*
 * RSI's own outlined button (`.a-button.-default.-outlined`, November 2026): its light blue on the
 * store's dark blue, a thin line and small corners. Everything is set here, as RSI's pages style
 * buttons of their own; `:root` outweighs their reset in the store's dialogs
 * (`[data-orion-skin] .RSIStoreTheme button`).
 */
:root .shm-rsi-watch .shm-rsi-watch-button {
  --shm-rsi-line: #add3eb;
  --shm-rsi-ink: #add3eb;
  --shm-rsi-hover: rgb(173 211 235 / 12%);
  --shm-rsi-on: rgb(173 211 235 / 18%);

  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 0;
  height: 48px;
  margin: 0;
  padding: 0 20px;
  color: var(--shm-rsi-ink);
  font-family: univia-pro, Montserrat, arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  white-space: nowrap;
  background: transparent;
  border: 1px solid var(--shm-rsi-line);
  border-radius: 4px;
  box-shadow: none;
  cursor: pointer;
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out,
    transform 120ms ease-out;
  appearance: none;
}

:root .shm-rsi-watch .shm-rsi-watch-button svg {
  flex: none;
  width: 16px;
  height: 16px;
}

:root .shm-rsi-watch .shm-rsi-watch-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (hover: hover) {
  :root .shm-rsi-watch .shm-rsi-watch-button:hover {
    color: #fff;
    background: var(--shm-rsi-hover);
  }
}

:root .shm-rsi-watch .shm-rsi-watch-button:active {
  transform: scale(0.97);
}

:root .shm-rsi-watch .shm-rsi-watch-button:focus-visible {
  outline: 2px solid var(--shm-rsi-line);
  outline-offset: 2px;
}

:root .shm-rsi-watch .shm-rsi-watch-button.is-on {
  color: #fff;
  background: var(--shm-rsi-on);
}

/* A card of the store's lists: a square next to RSI's cart button, as high as it. */
:root .shm-rsi-watch .shm-rsi-watch-button.is-card {
  width: 52px;
  height: 52px;
  padding: 0;
}

:root .shm-rsi-watch .shm-rsi-watch-button.is-card svg {
  width: 20px;
  height: 20px;
}

/*
 * RSI's ship upgrade dialog: its slate bar with the orange "Add To Cart" in Quantico. White lines
 * there, as its other controls on the slate.
 */
:root .shm-rsi-watch .shm-rsi-watch-button.is-dialog {
  --shm-rsi-line: rgb(255 255 255 / 75%);
  --shm-rsi-ink: #fff;
  --shm-rsi-hover: rgb(255 255 255 / 12%);
  --shm-rsi-on: rgb(255 255 255 / 20%);

  font-family: Quantico, sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
  border-radius: 0;
}

@media (prefers-reduced-motion: reduce) {
  :root .shm-rsi-watch .shm-rsi-watch-button {
    transition: none;
  }

  :root .shm-rsi-watch .shm-rsi-watch-button:active {
    transform: none;
  }
}
</style>
