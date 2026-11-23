<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/hangar/components/row.css';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref, useTemplateRef } from 'vue';
import { watchlistsByItem, type NewWatchItem } from '../use-watchlists';
import { itemKey } from '../watchlists';
import type { RsiWatchPlace } from '../rsi-pages';
import RsiWatchPopover from './RsiWatchPopover.vue';

/*
 * The button on RSI's own pages that puts a Pledge Store item on watchlists (#471): a paint on its
 * page and on its card in the store's lists (#632), a CCU in RSI's ship upgrade dialog. The button
 * follows RSI's design where it sits (#632), outlined next to RSI's filled "Add to cart", so it is
 * clearly a button but less prominent; tinted while the item is on a watchlist. It opens the same
 * choice as in the Hangar Manager – the watchlists and a new one –, in the theme of the settings,
 * as a small window growing out of the button (#632).
 */

const props = defineProps<{ item: NewWatchItem; title: string; place: RsiWatchPlace }>();

const open = ref(false);
const on = computed(() => watchlistsByItem.value.has(itemKey(props.item)));
const label = computed(() => i18n.t(on.value ? 'watchlists.rsiOn' : 'watchlists.rsiPut'));
// A card has room for its icon only: the tooltip and the label name the item.
const iconOnly = computed(() => props.place === 'card');
const button = useTemplateRef<HTMLButtonElement>('button');
const popover = useTemplateRef<InstanceType<typeof RsiWatchPopover>>('popover');
// The upgrade dialog's bar sits at the bottom of the window: there it opens upwards.
const side = computed(() => (props.place === 'dialog' ? 'above' : 'below'));
const toggle = () => (open.value ? popover.value?.close() : (open.value = true));
</script>

<template>
  <!-- No theme classes here: the theme's resets would win over RSI's look (#632); the dialog sets
       its own. -->
  <span class="shm-rsi-watch">
    <button
      ref="button"
      v-tooltip="open ? '' : title"
      type="button"
      class="shm-rsi-watch-button"
      :class="[`is-${place}`, { 'is-on': on, 'is-open': open }]"
      :aria-label="iconOnly ? `${title} – ${label}` : undefined"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click.stop.prevent="toggle"
    >
      <SvgIcon :name="on ? 'clipboard-check' : 'clipboard-list'" />
      <span v-if="!iconOnly" class="shm-rsi-watch-label">{{ label }}</span>
    </button>
    <RsiWatchPopover
      v-if="open && button"
      ref="popover"
      :title="title"
      :item="item"
      :anchor="button"
      :side="side"
      :slate="place === 'dialog'"
      @close="open = false"
    />
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
 * RSI's ship upgrade dialog: docked to the top of its slate bar next to the orange "Add To Cart",
 * as high as it and in its Quantico, on a darker slate with a rounded outer corner, so both read as
 * one bar of actions with "Add To Cart" the prominent one.
 */
:root .shm-rsi-watch .shm-rsi-watch-button.is-dialog {
  --shm-rsi-ink: #fff;
  --shm-rsi-hover: #48515a;
  --shm-rsi-on: #4f5963;

  height: 100%;
  min-height: 48px;
  /* Its right end tucked under "Add To Cart", so both join without a seam. */
  margin-right: -12px;
  padding: 0 40px 0 28px;
  font-family: Quantico, sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0;
  background: #3d454c;
  border: 0;
  border-radius: 0 0 0 12px;
}

:root .shm-rsi-watch .shm-rsi-watch-button.is-dialog svg {
  width: 18px;
  height: 18px;
}

@media (hover: hover) {
  :root .shm-rsi-watch .shm-rsi-watch-button.is-dialog:hover {
    background: var(--shm-rsi-hover);
  }
}

:root .shm-rsi-watch .shm-rsi-watch-button.is-dialog.is-on {
  background: var(--shm-rsi-on);
}

:root .shm-rsi-watch .shm-rsi-watch-button.is-dialog:focus-visible {
  outline-color: #fff;
  outline-offset: -4px;
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
