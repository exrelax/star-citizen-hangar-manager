<script setup lang="ts" generic="T extends string">
import { useId } from 'vue';

/**
 * A choice of a few short options side by side (e.g. the theme), as a segmented control. Radio
 * buttons underneath: arrow keys move between the options, screen readers name each one.
 */
defineProps<{ modelValue: T; options: { value: T; label: string }[]; labelledby?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

const name = useId();
</script>

<template>
  <span class="shm-segmented" role="radiogroup" :aria-labelledby="labelledby">
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
      {{ option.label }}
    </label>
  </span>
</template>
