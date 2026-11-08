<script setup lang="ts">
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { nextTick, ref, useTemplateRef, watch } from 'vue';
import { tooltipState } from './tooltip';

/*
 * The one overlay of all tooltips (see tooltip.ts), mounted to the page's body on first use. It
 * carries the theme classes itself, like the dialogs.
 */
const { settings } = useSettings();
const overlay = useTemplateRef('overlay');
const position = ref<{ top: number; left: number }>();

const MARGIN = 8;
const GAP = 6;

/** Below the element, centered on it; above it if there's no room below. */
async function place() {
  position.value = undefined;
  const anchor = tooltipState.anchor;
  if (!anchor) return;
  await nextTick();
  const tooltip = overlay.value;
  if (!tooltip || tooltipState.anchor !== anchor) return;
  const target = anchor.getBoundingClientRect();
  const { width, height } = tooltip.getBoundingClientRect();
  const center = target.left + target.width / 2;
  const left = Math.max(MARGIN, Math.min(center - width / 2, innerWidth - width - MARGIN));
  const below = target.bottom + GAP;
  const top =
    below + height + MARGIN > innerHeight && target.top - GAP - height >= MARGIN
      ? target.top - GAP - height
      : below;
  position.value = { top, left };
}

watch(() => [tooltipState.anchor, tooltipState.content], place);
</script>

<template>
  <div
    v-if="tooltipState.content"
    ref="overlay"
    role="tooltip"
    class="shm-tooltip"
    :class="themeClasses(settings)"
    :style="[
      fontScaleStyle(settings),
      position
        ? { top: `${position.top}px`, left: `${position.left}px` }
        : { top: '0', left: '0', visibility: 'hidden' },
    ]"
  >
    <strong v-if="tooltipState.content.title">{{ tooltipState.content.title }}</strong>
    <span v-if="tooltipState.content.text" class="shm-tooltip-text">{{
      tooltipState.content.text
    }}</span>
  </div>
</template>

<style>
.shm-tooltip {
  position: fixed;
  z-index: 2147483000;
  box-sizing: border-box;
  display: block;
  width: max-content;
  max-width: min(320px, calc(100vw - 16px));
  padding: 6px 10px;
  color: var(--shm-text-secondary);
  font-family: inherit;
  font-size: calc(12px * var(--shm-font-scale, 1));
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  white-space: pre-line;
  overflow-wrap: break-word;
  background: var(--shm-surface-elevated);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.5);
  pointer-events: none;
}

.shm-tooltip strong {
  display: block;
  margin-bottom: 2px;
  color: var(--shm-text-strong);
  font-weight: 600;
}

/* A tooltip with a heading is an explanation: a bit more room. */
.shm-tooltip:has(strong) {
  padding: 10px 12px;
}

html .shm-tooltip.shm-theme-modern {
  border-radius: var(--shm-radius-control);
}
</style>
