<script setup lang="ts">
import { i18n } from '@/i18n';
import { computed, ref, useTemplateRef } from 'vue';
import { FONT_SIZES, type FontSize } from './settings';

/*
 * The font size setting as a slider: a stop per size on a track, each with an "A" in its size
 * above it. The thumb can be dragged: it follows the pointer and the letter of the nearest stop
 * lights up, but the size only changes on release, when the thumb snaps to that stop (changing it
 * while dragging would resize the whole manager under the pointer). Radio buttons underneath:
 * clicking a stop or its letter selects it, arrow keys move between the stops, screen readers name
 * each size.
 */

const props = defineProps<{ modelValue: FontSize; labelledby: string }>();
const emit = defineEmits<{ 'update:modelValue': [size: FontSize] }>();

/** Width of a stop; the dots sit in their middle (also in the styles below). */
const STOP_WIDTH = 56;
const FIRST = STOP_WIDTH / 2;
const LAST = FIRST + (FONT_SIZES.length - 1) * STOP_WIDTH;

const slider = useTemplateRef<HTMLElement>('slider');
/** Position of the thumb while it is dragged, from the slider's left edge; otherwise unset. */
const dragX = ref<number>();
/** The stop nearest to the dragged thumb, selected on release. */
const dragSize = ref<FontSize>();
/** The size the letters show as selected: the one dragged to, otherwise the setting. */
const shownSize = computed(() => dragSize.value ?? props.modelValue);

const thumbX = computed(
  () => dragX.value ?? FIRST + FONT_SIZES.indexOf(shownSize.value) * STOP_WIDTH,
);

function select(size: FontSize) {
  if (size !== props.modelValue) emit('update:modelValue', size);
}

/** Follows the pointer along the track and notes the stop nearest to it. */
function follow(event: PointerEvent) {
  const left = slider.value?.getBoundingClientRect().left ?? 0;
  const x = Math.min(LAST, Math.max(FIRST, event.clientX - left));
  dragX.value = x;
  dragSize.value = FONT_SIZES[Math.round((x - FIRST) / STOP_WIDTH)]!;
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  // No text selection while dragging.
  event.preventDefault();
  slider.value?.setPointerCapture(event.pointerId);
  follow(event);
}

function drag(event: PointerEvent) {
  if (dragX.value !== undefined) follow(event);
}

/** Released: selects the stop the thumb is nearest to; the thumb snaps to it. */
function endDrag() {
  const size = dragSize.value;
  stopDrag();
  if (!size) return;
  select(size);
  // Arrow keys go on from there.
  slider.value?.querySelector<HTMLInputElement>(`input[value="${size}"]`)?.focus();
}

/** Cancelled (e.g. by the system): the thumb goes back, the size stays. */
function stopDrag() {
  dragX.value = undefined;
  dragSize.value = undefined;
}
</script>

<template>
  <div
    ref="slider"
    class="shm-font-size"
    :class="{ 'is-dragging': dragX !== undefined }"
    role="radiogroup"
    :aria-labelledby="labelledby"
    @pointerdown="startDrag"
    @pointermove="drag"
    @pointerup="endDrag"
    @pointercancel="stopDrag"
  >
    <label
      v-for="size in FONT_SIZES"
      :key="size"
      class="shm-font-size-stop"
      :class="{ 'is-selected': shownSize === size }"
      :title="i18n.t(`settings.fontSizeOptions.${size}`)"
    >
      <span class="shm-font-size-letter" :class="`is-${size}`" aria-hidden="true">A</span>
      <input
        type="radio"
        name="shm-font-size"
        class="shm-font-size-input"
        :value="size"
        :checked="modelValue === size"
        :aria-label="i18n.t(`settings.fontSizeOptions.${size}`)"
        @change="select(size)"
      />
      <span class="shm-font-size-dot" aria-hidden="true"></span>
    </label>
    <span class="shm-font-size-thumb" :style="{ left: `${thumbX}px` }" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
/* The letters have fixed symbolic sizes (not scaled by the setting), so they show the difference. */
.shm-font-size {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 56px);
  width: max-content;
  /* Dragging on touch screens moves the thumb instead of scrolling the page. */
  touch-action: none;
  user-select: none;
}

/* The track from the first to the last dot, at the dots' height. */
.shm-font-size::before {
  position: absolute;
  right: 28px;
  bottom: 7px;
  left: 28px;
  height: 2px;
  background: rgb(var(--shm-accent-rgb) / 0.3);
  border-radius: 1px;
  content: '';
}

.shm-font-size-stop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  cursor: pointer;
}

.shm-font-size.is-dragging,
.shm-font-size.is-dragging .shm-font-size-stop {
  cursor: grabbing;
}

.shm-font-size-letter {
  color: var(--shm-text-muted);
  font-weight: 600;
  line-height: 1;
}

.shm-font-size-letter.is-small {
  font-size: 12px;
}

.shm-font-size-letter.is-medium {
  font-size: 16px;
}

.shm-font-size-letter.is-large {
  font-size: 21px;
}

.shm-font-size-stop.is-selected .shm-font-size-letter,
.shm-font-size-stop:hover .shm-font-size-letter {
  color: var(--shm-text-strong);
}

/* The radio button itself stays reachable by keyboard and screen readers, but invisible. */
.shm-font-size-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

/* A stop on the track; the thumb covers the selected one. */
.shm-font-size-dot {
  width: 16px;
  height: 16px;
  padding: 4px;
  box-sizing: border-box;
  border-radius: 999px;
}

.shm-font-size-dot::after {
  display: block;
  width: 8px;
  height: 8px;
  background: rgb(var(--shm-accent-rgb) / 0.6);
  border-radius: 999px;
  content: '';
}

.shm-font-size-input:focus-visible + .shm-font-size-dot {
  outline: 2px solid var(--shm-accent);
  outline-offset: 3px;
}

/* The thumb: snaps to the selected stop, follows the pointer while dragged. */
.shm-font-size-thumb {
  position: absolute;
  bottom: 0;
  width: 16px;
  height: 16px;
  background: var(--shm-accent);
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgb(var(--shm-accent-rgb) / 0.25);
  transform: translateX(-50%);
  transition: left 0.15s ease;
  cursor: grab;
  pointer-events: none;
}

.shm-font-size-thumb::after {
  display: block;
  width: 6px;
  height: 6px;
  margin: 5px;
  background: var(--shm-text-on-accent);
  border-radius: 999px;
  content: '';
}

.shm-font-size.is-dragging .shm-font-size-thumb {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .shm-font-size-thumb {
    transition: none;
  }
}
</style>
