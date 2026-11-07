<script setup lang="ts" generic="T extends string">
import { FEATURES } from '@/config';
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

/*
 * The manager's tabs, also used for other choices of a few options (the styleguide's theme). Each
 * theme styles it its own way: RSI's underlined tabs (below) or a segmented control (modern.css).
 *
 * With `FEATURES.tabSlideAnimation` the highlight of the active tab is an element of its own that
 * slides over to the tab clicked – the underline in "Classic RSI", the raised segment in "Modern
 * Hangar". It is placed without a transition at first and whenever the size changes.
 */

const props = defineProps<{
  /** `iconSet`: the sprite of `icon`, Font Awesome unless set. */
  items: readonly { id: T; label: string; icon?: IconName; iconSet?: IconSet }[];
  selected: T;
  /** Accessible name of the group. */
  label: string;
  /**
   * Set for real tabs: the id prefix of the tabs and their panels (`<prefix>-tab-<id>`,
   * `<prefix>-panel-<id>`). Without it the items are toggle buttons.
   */
  panels?: string;
}>();
const emit = defineEmits<{ select: [id: T] }>();

const slide = FEATURES.tabSlideAnimation;
const bar = useTemplateRef('bar');
/** Where the highlight is: the active tab's box within the bar. */
const indicator = ref<{ left: number; top: number; width: number; height: number }>();
/** Off while placing the highlight without a slide (first render, resizing). */
const animate = ref(false);

function place(withSlide: boolean) {
  const active = bar.value?.querySelector<HTMLElement>('.shm-tab.is-active');
  if (!active) return;
  animate.value = withSlide;
  const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = active;
  indicator.value = { left, top, width, height };
}

let observer: ResizeObserver | undefined;
if (slide) {
  watch(
    () => props.selected,
    async () => {
      await nextTick();
      place(true);
    },
  );
  onMounted(() => {
    place(false);
    observer = new ResizeObserver(() => place(false));
    if (bar.value) observer.observe(bar.value);
  });
  onUnmounted(() => observer?.disconnect());
}
</script>

<template>
  <div
    ref="bar"
    class="shm-tabs"
    :class="{ 'has-indicator': slide && indicator }"
    :role="panels ? 'tablist' : 'group'"
    :aria-label="label"
  >
    <span
      v-if="slide && indicator"
      class="shm-tab-indicator"
      :class="{ 'is-sliding': animate }"
      aria-hidden="true"
      :style="{
        width: `${indicator.width}px`,
        height: `${indicator.height}px`,
        transform: `translate(${indicator.left}px, ${indicator.top}px)`,
      }"
    ></span>
    <button
      v-for="item in items"
      :id="panels && `${panels}-tab-${item.id}`"
      :key="item.id"
      type="button"
      :role="panels ? 'tab' : undefined"
      class="shm-tab"
      :class="{ 'is-active': selected === item.id }"
      :aria-selected="panels ? selected === item.id : undefined"
      :aria-pressed="panels ? undefined : selected === item.id"
      :aria-controls="panels && `${panels}-panel-${item.id}`"
      @click="emit('select', item.id)"
    >
      <SvgIcon v-if="item.icon" :name="item.icon" :set="item.iconSet" />
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.shm-tabs {
  position: relative;
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.25);
}

.shm-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  color: var(--shm-text-muted);
  font: inherit;
  font-size: calc(13px * var(--shm-font-scale));
  text-transform: uppercase;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
}

.shm-tab:hover,
.shm-tab:focus-visible {
  color: var(--shm-text);
  outline: none;
}

.shm-tab.is-active {
  color: var(--shm-accent);
  border-bottom-color: var(--shm-accent);
}

/* The sliding highlight: here the underline, under the tabs' own (transparent) border. */
.shm-tab-indicator {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border-bottom: 2px solid var(--shm-accent);
  pointer-events: none;
}

.shm-tab-indicator.is-sliding {
  transition:
    transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1),
    width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .shm-tab-indicator.is-sliding {
    transition: none;
  }
}

.shm-tabs.has-indicator .shm-tab {
  position: relative;
  z-index: 1;
}

.shm-tabs.has-indicator .shm-tab.is-active {
  border-bottom-color: transparent;
}
</style>
