<script setup lang="ts" generic="F extends string">
import type { FilterLayout } from '@/hangar/filters';
import { i18n } from '@/i18n';
import { ref } from 'vue';

/*
 * Order and selection of one list's filter buttons: drag a filter (or use its arrows) to move
 * it, uncheck it to remove its button from the list.
 */

const props = defineProps<{
  /** Id prefix of the checkboxes, unique per list. */
  id: string;
  title: string;
  layout: FilterLayout<F>;
  /** The preset layout (`FILTERS` in config), restored by "Reset". */
  defaults: FilterLayout<F>;
  filterLabel: (filter: F) => string;
}>();
const emit = defineEmits<{ update: [layout: FilterLayout<F>] }>();

const isDefault = () =>
  props.layout.order.join() === props.defaults.order.join() &&
  props.layout.shown.join() ===
    props.defaults.order.filter((f) => props.defaults.shown.includes(f)).join();

function move(from: number, to: number) {
  if (from === to || to < 0 || to >= props.layout.order.length) return;
  const order = [...props.layout.order];
  const [filter] = order.splice(from, 1);
  order.splice(to, 0, filter!);
  emit('update', { order, shown: order.filter((f) => props.layout.shown.includes(f)) });
}

function setShown(filter: F, shown: boolean) {
  const selected = new Set(props.layout.shown);
  if (shown) selected.add(filter);
  else selected.delete(filter);
  emit('update', {
    order: props.layout.order,
    shown: props.layout.order.filter((f) => selected.has(f)),
  });
}

const reset = () =>
  emit('update', {
    order: [...props.defaults.order],
    shown: props.defaults.order.filter((f) => props.defaults.shown.includes(f)),
  });

// Dragging: the row being dragged and the one it is over (drawn with a drop line).
const dragged = ref<number>();
const over = ref<number>();

function onDragStart(event: DragEvent, index: number) {
  dragged.value = index;
  event.dataTransfer?.setData('text/plain', props.layout.order[index]!);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onDrop(index: number) {
  if (dragged.value !== undefined) move(dragged.value, index);
  dragged.value = over.value = undefined;
}
</script>

<template>
  <div class="shm-filter-layout">
    <div class="shm-filter-layout-head">
      <span class="shm-filter-layout-title">{{ title }}</span>
      <button v-if="!isDefault()" type="button" class="shm-link-button" @click="reset">
        {{ i18n.t('settings.filtersReset') }}
      </button>
    </div>
    <ol class="shm-filter-layout-list">
      <li
        v-for="(filter, index) in layout.order"
        :key="filter"
        class="shm-filter-layout-item"
        :class="{
          'is-dragged': dragged === index,
          'is-over': over === index && dragged !== index,
          'is-hidden': !layout.shown.includes(filter),
        }"
        draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent="over = index"
        @dragleave="over === index && (over = undefined)"
        @drop.prevent="onDrop(index)"
        @dragend="dragged = over = undefined"
      >
        <span class="shm-drag-handle" aria-hidden="true">⠿</span>
        <label class="shm-check">
          <input
            :id="`${id}-${filter}`"
            type="checkbox"
            :checked="layout.shown.includes(filter)"
            @change="setShown(filter, ($event.target as HTMLInputElement).checked)"
          />
          {{ filterLabel(filter) }}
        </label>
        <span class="shm-move">
          <button
            type="button"
            :disabled="index === 0"
            :aria-label="i18n.t('settings.filterUp', [filterLabel(filter)])"
            :title="i18n.t('settings.filterUp', [filterLabel(filter)])"
            @click="move(index, index - 1)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="index === layout.order.length - 1"
            :aria-label="i18n.t('settings.filterDown', [filterLabel(filter)])"
            :title="i18n.t('settings.filterDown', [filterLabel(filter)])"
            @click="move(index, index + 1)"
          >
            ↓
          </button>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.shm-filter-layout {
  min-width: 220px;
}

.shm-filter-layout-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-height: 20px;
  margin-bottom: 6px;
}

.shm-filter-layout-title {
  color: var(--shm-text-muted);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-link-button {
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  font-size: 12px;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-link-button:hover,
.shm-link-button:focus-visible {
  text-decoration: underline;
  outline: none;
}

.shm-filter-layout-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-filter-layout-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.12);
  border-top-width: 0;
  background: rgb(var(--shm-surface-rgb) / 0.5);
  cursor: grab;
}

.shm-filter-layout-item:first-child {
  border-top-width: 1px;
}

.shm-filter-layout-item.is-dragged {
  opacity: 0.4;
}

/* Where the dragged filter will go. */
.shm-filter-layout-item.is-over {
  box-shadow: inset 0 2px 0 var(--shm-accent);
}

.shm-filter-layout-item.is-hidden .shm-check {
  color: var(--shm-text-muted);
}

.shm-drag-handle {
  color: var(--shm-text-muted);
  font-size: 14px;
}

.shm-check {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  margin: 0;
  cursor: pointer;
}

.shm-check input {
  accent-color: var(--shm-accent);
}

.shm-move {
  display: flex;
  gap: 2px;
}

.shm-move button {
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  font-size: 12px;
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}

.shm-move button:not(:disabled):hover,
.shm-move button:not(:disabled):focus-visible {
  border-color: rgb(var(--shm-accent-rgb) / 0.5);
  outline: none;
}

.shm-move button:disabled {
  opacity: 0.25;
  cursor: default;
}
</style>
