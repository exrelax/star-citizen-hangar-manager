<script setup lang="ts">
/**
 * A setting as a checkbox: its label (the slot) and, below it, an optional hint. `disabled` while
 * the setting it depends on is off.
 */
defineProps<{ checked: boolean; hint?: string; disabled?: boolean }>();
const emit = defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
  <div class="shm-check-setting" :class="{ 'is-disabled': disabled }">
    <label class="shm-check">
      <input
        type="checkbox"
        :checked="checked"
        :disabled="disabled"
        @change="emit('change', ($event.target as HTMLInputElement).checked)"
      />
      <slot />
    </label>
    <p v-if="hint" class="shm-hint is-indented">{{ hint }}</p>
  </div>
</template>
