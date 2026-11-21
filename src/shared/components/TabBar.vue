<script setup lang="ts" generic="T extends string">
import { FEATURES } from '@/config';
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';

/*
 * The manager's tabs, also used for other choices of a few options (the styleguide's theme). Each
 * theme styles it its own way: RSI's underlined tabs (below) or a segmented control (modern.css).
 *
 * With `FEATURES.tabSlideAnimation` the highlight of the active tab is an element of its own that
 * slides over to the tab clicked – the underline in "Classic RSI", the raised segment in "Modern
 * Hangar". It is placed without a transition at first and whenever the size changes.
 */

const props = defineProps<{
  /**
   * `iconSet`: the sprite of `icon`, Font Awesome unless set; `count`: shown after the label, with
   * `countTone` as a tinted pill (`underline` tabs); `iconOnly`: only the icon, the label as its
   * tooltip and accessible name (#513).
   */
  items: readonly {
    id: T;
    label: string;
    icon?: IconName;
    iconSet?: IconSet;
    count?: string;
    countTone?: 'danger' | 'warning' | 'neutral';
    iconOnly?: boolean;
  }[];
  selected: T;
  /** Accessible name of the group. */
  label: string;
  /**
   * Set for real tabs: the id prefix of the tabs and their panels (`<prefix>-tab-<id>`,
   * `<prefix>-panel-<id>`). Without it the items are toggle buttons.
   */
  panels?: string;
  /**
   * Segments as wide as their labels instead of equally wide ("Modern Hangar"), for labels of very
   * different lengths. Labels never wrap; one that doesn't fit is cut with an ellipsis.
   */
  fitContent?: boolean;
  /**
   * Text tabs over an underline in every theme, for the parts of one section (the consultants of the
   * tab "Consultants", #453) below the manager's own tabs.
   */
  underline?: boolean;
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

/*
 * Too narrow for the labels (#466): once a label would be cut, every tab shows only its icon, with
 * its label as tooltip and accessible name, as long as each tab has an icon. The bar's width at that
 * moment is remembered: only wider than it the labels come back, so the tabs never flip back and
 * forth.
 */
const compact = ref(false);
let compactBelow = 0;
const canCompact = computed(() => props.items.every((item) => item.icon));
const iconOnly = (item: { iconOnly?: boolean }) => item.iconOnly || compact.value;
function fit() {
  const width = bar.value?.clientWidth ?? 0;
  if (!canCompact.value) {
    compact.value = false;
    return;
  }
  if (compact.value) {
    if (width > compactBelow) {
      compact.value = false;
      void nextTick(fit);
    }
    return;
  }
  const cut = [...(bar.value?.querySelectorAll<HTMLElement>('.shm-tab-label') ?? [])].some(
    (label) => label.scrollWidth > label.clientWidth + 1,
  );
  if (cut) {
    compactBelow = width;
    compact.value = true;
  }
}
let fitObserver: ResizeObserver | undefined;
onMounted(() => {
  fitObserver = new ResizeObserver(() => fit());
  if (bar.value) fitObserver.observe(bar.value);
  fit();
});
onUnmounted(() => fitObserver?.disconnect());
// Other labels (another language): measured again with their labels shown.
watch(
  () => props.items.map((item) => `${item.label}|${item.count ?? ''}|${item.icon ?? ''}`).join(),
  async () => {
    compact.value = false;
    await nextTick();
    fit();
  },
);

let observer: ResizeObserver | undefined;
if (slide) {
  watch(
    () => props.selected,
    async () => {
      await nextTick();
      place(true);
    },
  );
  /*
   * The bar and each tab: a tab's width also changes on its own, e.g. its label in another language
   * once the language setting is read, and moves the active one with it (#513).
   */
  const observeAll = () => {
    observer?.disconnect();
    if (!bar.value || !observer) return;
    observer.observe(bar.value);
    for (const tab of bar.value.querySelectorAll('.shm-tab')) observer.observe(tab);
  };
  onMounted(() => {
    place(false);
    observer = new ResizeObserver(() => place(false));
    observeAll();
  });
  watch(
    () => props.items.map((item) => item.id).join(),
    async () => {
      await nextTick();
      observeAll();
      place(false);
    },
  );
  onUnmounted(() => observer?.disconnect());
}
</script>

<template>
  <div
    ref="bar"
    class="shm-tabs"
    :class="{
      'has-indicator': slide && indicator,
      'is-fit-content': fitContent,
      'is-underline': underline,
      'has-icon-only': items.some(iconOnly),
      'is-compact': compact,
    }"
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
      v-tooltip="iconOnly(item) ? item.label : undefined"
      type="button"
      :role="panels ? 'tab' : undefined"
      class="shm-tab"
      :class="{ 'is-active': selected === item.id, 'is-icon-only': iconOnly(item) }"
      :aria-label="iconOnly(item) ? item.label : undefined"
      :aria-selected="panels ? selected === item.id : undefined"
      :aria-pressed="panels ? undefined : selected === item.id"
      :aria-controls="panels && `${panels}-panel-${item.id}`"
      @click="emit('select', item.id)"
    >
      <SvgIcon v-if="item.icon" :name="item.icon" :set="item.iconSet" />
      <span v-if="!iconOnly(item)" class="shm-tab-label">{{ item.label }}</span>
      <!-- A space, so the tab's name reads "Label 3", not "Label3". -->
      <template v-if="item.count !== undefined">
        {{ ' '
        }}<span
          class="shm-tab-count"
          :class="item.countTone && ['is-pill', `is-${item.countTone}`]"
          >{{ item.count }}</span
        >
      </template>
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

.shm-tab {
  min-width: 0;
  white-space: nowrap;
}

/* A label that doesn't fit is cut, never wrapped: the tab keeps its height. */
.shm-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shm-tab-count {
  flex: none;
  color: var(--shm-text-muted);
  font-variant-numeric: tabular-nums;
}

/* A count as a tinted pill: red for something missing, orange for something to watch. */
.shm-tab-count.is-pill {
  padding: 0 6px;
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 700;
  line-height: 16px;
  border-radius: var(--shm-radius-pill);
  background: rgb(var(--shm-accent-rgb) / 0.16);
}

.shm-tab-count.is-danger {
  color: var(--shm-danger);
  background: color-mix(in srgb, var(--shm-danger) 18%, transparent);
}

.shm-tab-count.is-warning {
  color: var(--shm-warning);
  background: color-mix(in srgb, var(--shm-warning) 18%, transparent);
}

/*
 * A tab with only its icon (#513): as narrow as the icon allows, its hit area at least 44 × 44 px
 * (Apple Human Interface Guidelines) without changing the bar's height.
 */
.shm-tab.is-icon-only {
  position: relative;
  flex: none;
  justify-content: center;
  min-width: 44px;
}

.shm-tab.is-icon-only::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: max(100%, 44px);
  content: '';
  transform: translateY(-50%);
}

/* Too narrow for the labels: every tab its icon, sharing the bar's width. */
.shm-tabs.is-compact .shm-tab.is-icon-only {
  flex: 1 1 0;
}

/* Underline tabs (`underline`): the parts of one section, further apart. */
.shm-tabs.is-underline {
  gap: 24px;
}

.shm-tabs.is-underline .shm-tab {
  padding: 10px 0 9px;
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
