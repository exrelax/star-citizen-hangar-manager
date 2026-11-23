<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/shared/overlay.css';
import '@/hangar/components/row.css';
import { i18n } from '@/i18n';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import type { NewWatchItem } from '../use-watchlists';
import { popoverPlacement, type PopoverSide } from '../rsi-popover';
import WatchlistPicker from './WatchlistPicker.vue';

/*
 * The choice of watchlists of a button on RSI's pages (#632), as a small window that grows out of
 * the button instead of a dialog over the page: it starts as the button's own box and opens to its
 * size from the button's corner (a clip-path, so only the compositor works), covering the button
 * and nothing next to it – in the ship upgrade dialog it opens upwards, left of "Add To Cart".
 * A click elsewhere or Escape closes it back into the button. It is teleported to the page's body,
 * out of RSI's links and clipped cards, and follows the button on scrolling.
 */

const props = defineProps<{
  title: string;
  item: NewWatchItem;
  /** The button it grows out of. */
  anchor: HTMLElement;
  /** Where it prefers to open; it flips when there is no room. */
  side: PopoverSide;
}>();
const emit = defineEmits<{ close: [] }>();

const { settings } = useSettings();
const id = useId();
const box = useTemplateRef<HTMLElement>('box');
const position = ref({ left: 0, top: 0 });
const placed = ref<PopoverSide>(props.side);

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const OPEN_MS = 240;
const CLOSE_MS = 160;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The button's box inside the window, as `inset()` of a clip-path. */
function anchorInset(): string {
  const popover = box.value!.getBoundingClientRect();
  const button = props.anchor.getBoundingClientRect();
  const radius = getComputedStyle(props.anchor).borderRadius || '0px';
  const inset = [
    button.top - popover.top,
    popover.right - button.right,
    popover.bottom - button.bottom,
    button.left - popover.left,
  ].map((value) => `${Math.max(0, value)}px`);
  return `inset(${inset.join(' ')} round ${radius})`;
}
const fullInset = () => `inset(0 round ${getComputedStyle(box.value!).borderRadius || '0px'})`;

/**
 * The button's visible box: its wrapper's, as the button may reach under what is next to it (in
 * the upgrade dialog under "Add To Cart"), which the window must not cover.
 */
const edgeOf = (anchor: HTMLElement) => (anchor.parentElement ?? anchor).getBoundingClientRect();

function place() {
  if (!box.value) return;
  if (!props.anchor.isConnected) {
    emit('close');
    return;
  }
  const result = popoverPlacement(
    edgeOf(props.anchor),
    { width: box.value.offsetWidth, height: box.value.offsetHeight },
    { width: innerWidth, height: innerHeight },
    props.side,
  );
  position.value = { left: result.left, top: result.top };
  placed.value = result.side;
}

let animation: Animation | undefined;
let closing = false;

async function open() {
  await nextTick();
  place();
  await nextTick();
  const element = box.value;
  if (!element) return;
  element.focus({ preventScroll: true });
  animation = reducedMotion()
    ? element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease' })
    : element.animate(
        [
          { clipPath: anchorInset(), opacity: 0.6 },
          { clipPath: fullInset(), opacity: 1 },
        ],
        { duration: OPEN_MS, easing: EASE_OUT },
      );
}

/** Closes back into the button, faster than it opened; `refocus` after Escape. */
function close(refocus = false) {
  if (closing) return;
  closing = true;
  const element = box.value;
  const done = () => {
    if (refocus) props.anchor.focus({ preventScroll: true });
    emit('close');
  };
  if (!element) return done();
  animation?.cancel();
  const frames = reducedMotion()
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        { clipPath: fullInset(), opacity: 1 },
        { clipPath: anchorInset(), opacity: 0 },
      ];
  animation = element.animate(frames, { duration: CLOSE_MS, easing: EASE_OUT, fill: 'forwards' });
  animation.onfinish = done;
}
defineExpose({ close });

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target || box.value?.contains(target) || props.anchor.contains(target)) return;
  close();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // A list of a menu inside closes first.
  if ((event.target as Element | null)?.closest?.('.shm-select-menu-list')) return;
  event.stopPropagation();
  close(true);
}
let frame = 0;
const follow = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(place);
};

onMounted(() => {
  void open();
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKeydown, true);
  addEventListener('scroll', follow, true);
  addEventListener('resize', follow);
});
onUnmounted(() => {
  cancelAnimationFrame(frame);
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('keydown', onKeydown, true);
  removeEventListener('scroll', follow, true);
  removeEventListener('resize', follow);
});
</script>

<template>
  <Teleport to="body">
    <!-- The theme on a wrapper of its own: the themes style the dialog inside it. -->
    <div
      class="shm-rsi-popover-theme"
      :class="themeClasses(settings)"
      :style="fontScaleStyle(settings)"
    >
      <section
        ref="box"
        class="shm-overlay-dialog shm-rsi-popover"
        :class="`is-${placed}`"
        :style="{ left: `${position.left}px`, top: `${position.top}px` }"
        role="dialog"
        :aria-labelledby="`${id}-title`"
        tabindex="-1"
      >
        <header class="shm-overlay-header">
          <h3 :id="`${id}-title`">{{ title }}</h3>
          <button
            v-tooltip="i18n.t('order.close')"
            type="button"
            class="shm-overlay-close"
            :aria-label="i18n.t('order.close')"
            @click="close(true)"
          >
            ×
          </button>
        </header>
        <WatchlistPicker :item="item" />
      </section>
    </div>
  </Teleport>
</template>

<style>
.shm-rsi-popover-theme {
  display: contents;
}

/* Above RSI's own dialogs, as the dialog of the table of all ships (#471). */
.shm-overlay-dialog.shm-rsi-popover {
  position: fixed;
  z-index: 2147483000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(calc(380px * var(--shm-font-scale)), calc(100vw - 16px));
  margin: 0;
  padding: 14px 16px 16px;
  text-align: left;
  text-transform: none;
}

/* RSI's small corners (#632), as the buttons on its pages; over the theme's larger ones. */
html .shm-rsi-popover-theme .shm-overlay-dialog.shm-rsi-popover {
  border-radius: 4px;
}

.shm-rsi-popover .shm-overlay-header {
  gap: 12px;
  margin-bottom: 0;
}

.shm-rsi-popover .shm-overlay-header h3 {
  min-width: 0;
  font-size: calc(14px * var(--shm-font-scale));
  line-height: 1.3;
}

.shm-rsi-popover .shm-watchlist-picker {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
</style>
