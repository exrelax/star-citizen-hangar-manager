<script setup lang="ts" generic="T extends string">
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useId } from 'vue';

/**
 * A choice of a few short options side by side (e.g. the theme, the view of the CCU Consultant), as
 * a segmented control, each option with an icon if given. Radio buttons underneath: arrow keys move
 * between the options, screen readers name each one.
 */
defineProps<{
  modelValue: T;
  options: { value: T; label: string; icon?: IconName }[];
  labelledby?: string;
  /** Accessible name of the group, without a visible label to point to. */
  label?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

const name = useId();
</script>

<template>
  <span class="shm-segmented" role="radiogroup" :aria-labelledby="labelledby" :aria-label="label">
    <label
      v-for="option in options"
      :key="option.value"
      class="shm-segment"
      :class="{ 'is-selected': option.value === modelValue }"
    >
      <input
        type="radio"
        :name="name"
        :value="option.value"
        :checked="option.value === modelValue"
        @change="emit('update:modelValue', option.value)"
      />
      <SvgIcon v-if="option.icon" :name="option.icon" />
      {{ option.label }}
    </label>
  </span>
</template>

<style>
/* Not scoped: "Modern Hangar" adjusts it in modern.css. */
.shm-segmented {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.35);
  border-radius: var(--shm-radius-control);
}

.shm-segment {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  color: var(--shm-text-secondary);
  border-radius: var(--shm-radius-control);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.16s,
    color 0.16s;
}

.shm-segment.is-selected {
  color: var(--shm-text-strong);
  background: rgb(var(--shm-accent-rgb) / 0.25);
}

.shm-segment:has(input:focus-visible) {
  outline: 2px solid var(--shm-accent);
  outline-offset: 1px;
}

/* The radio button stays for keyboard and screen readers, not for the eye. */
.shm-segment input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  opacity: 0;
}
</style>
