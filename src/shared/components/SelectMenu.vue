<script setup lang="ts" generic="V extends string">
import SvgIcon from '@/icons/SvgIcon.vue';
import type { IconName } from '@/icons/icon-names';
import { computed, nextTick, onUnmounted, ref, useId, useTemplateRef } from 'vue';

/*
 * A dropdown in the manager's own look instead of the browser's `<select>`: a text button with an
 * icon that opens a list of options below it. Works like a select from the keyboard (arrows,
 * Home/End, Enter/Space, Escape, typing the first letter) and for screen readers (a button with
 * `aria-haspopup="listbox"` and a `listbox` of `option`s).
 */
const props = defineProps<{
  options: readonly { value: V; label: string }[];
  modelValue: V;
  /** Accessible name of the button, e.g. "Sort". */
  label: string;
  icon?: IconName<'fa'>;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: V] }>();

const id = `shm-select-${useId()}`;
const open = ref(false);
/** Index of the option the keyboard is on while the list is open. */
const active = ref(0);
const button = useTemplateRef('button');
const list = useTemplateRef('list');

const selectedIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex((option) => option.value === props.modelValue),
  ),
);
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? '');

function onOutside(event: PointerEvent) {
  const target = event.target as Node;
  if (!button.value?.contains(target) && !list.value?.contains(target)) close(false);
}

async function show() {
  open.value = true;
  active.value = selectedIndex.value;
  addEventListener('pointerdown', onOutside, true);
  await nextTick();
  list.value?.focus();
}

function close(focusButton = true) {
  if (!open.value) return;
  open.value = false;
  removeEventListener('pointerdown', onOutside, true);
  if (focusButton) button.value?.focus();
}

function choose(index: number) {
  const option = props.options[index];
  if (option && option.value !== props.modelValue) emit('update:modelValue', option.value);
  close();
}

function onButtonKey(event: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
    event.preventDefault();
    void show();
  }
}

function onListKey(event: KeyboardEvent) {
  const last = props.options.length - 1;
  const move = (index: number) => {
    event.preventDefault();
    active.value = Math.min(last, Math.max(0, index));
  };
  switch (event.key) {
    case 'ArrowDown':
      return move(active.value + 1);
    case 'ArrowUp':
      return move(active.value - 1);
    case 'Home':
      return move(0);
    case 'End':
      return move(last);
    case 'Enter':
    case ' ':
      event.preventDefault();
      return choose(active.value);
    case 'Escape':
      event.preventDefault();
      return close();
    case 'Tab':
      return close(false);
    default: {
      // The first letter jumps to the next option starting with it.
      if (event.key.length !== 1) return;
      const letter = event.key.toLowerCase();
      const next = props.options.findIndex(
        (option, index) => index > active.value && option.label.toLowerCase().startsWith(letter),
      );
      const first = props.options.findIndex((option) =>
        option.label.toLowerCase().startsWith(letter),
      );
      if (next >= 0 || first >= 0) move(next >= 0 ? next : first);
    }
  }
}

onUnmounted(() => removeEventListener('pointerdown', onOutside, true));
</script>

<template>
  <span class="shm-select-menu">
    <button
      ref="button"
      type="button"
      class="shm-select-menu-button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="id"
      :aria-label="`${label}: ${selectedLabel}`"
      @click="open ? close() : show()"
      @keydown="onButtonKey"
    >
      <span>{{ selectedLabel }}</span>
      <SvgIcon v-if="icon" :name="icon" />
    </button>
    <ul
      v-if="open"
      :id="id"
      ref="list"
      class="shm-select-menu-list"
      role="listbox"
      tabindex="-1"
      :aria-label="label"
      :aria-activedescendant="`${id}-${active}`"
      @keydown="onListKey"
    >
      <li
        v-for="(option, index) in options"
        :id="`${id}-${index}`"
        :key="option.value"
        role="option"
        class="shm-select-menu-option"
        :class="{ 'is-active': index === active }"
        :aria-selected="option.value === modelValue"
        @pointerenter="active = index"
        @click="choose(index)"
      >
        {{ option.label }}
      </li>
    </ul>
  </span>
</template>

<style>
.shm-select-menu {
  position: relative;
  display: inline-flex;
}

/* Only the text and its icon, in the color of the line it sits in. */
.shm-select-menu-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  color: inherit;
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-select-menu-button:hover,
.shm-select-menu-button:focus-visible,
.shm-select-menu-button[aria-expanded='true'] {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-select-menu-button:focus-visible span {
  text-decoration: underline;
}

.shm-select-menu-list {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: max-content;
  margin: 0;
  padding: 4px;
  color: var(--shm-text);
  list-style: none;
  background: var(--shm-surface-elevated);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.45);
  outline: none;
}

.shm-select-menu-option {
  padding: 6px 28px 6px 10px;
  white-space: nowrap;
  cursor: pointer;
}

.shm-select-menu-option.is-active {
  background: rgb(var(--shm-accent-rgb) / 0.16);
}

/* The selected option, marked by a check. */
.shm-select-menu-option[aria-selected='true'] {
  position: relative;
  color: var(--shm-accent);
}

.shm-select-menu-option[aria-selected='true']::after {
  position: absolute;
  top: 50%;
  right: 10px;
  width: 4px;
  height: 8px;
  border: solid currentColor;
  border-width: 0 2px 2px 0;
  transform: translateY(-65%) rotate(45deg);
  content: '';
}

html .shm-theme-modern .shm-select-menu-list {
  border: 0;
  border-radius: var(--shm-radius-group);
  box-shadow:
    0 0 0 1px var(--shm-separator),
    0 12px 30px rgb(0 0 0 / 0.45);
}

html .shm-theme-modern .shm-select-menu-option {
  border-radius: var(--shm-radius-item);
}
</style>
