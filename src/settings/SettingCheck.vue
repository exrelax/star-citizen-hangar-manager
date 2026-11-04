<script setup lang="ts">
/** A setting as a checkbox: its label (the slot) and, below it, an optional hint. */
defineProps<{ checked: boolean; hint?: string }>();
const emit = defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
  <div class="shm-check-setting">
    <label class="shm-check">
      <input
        type="checkbox"
        :checked="checked"
        @change="emit('change', ($event.target as HTMLInputElement).checked)"
      />
      <slot />
    </label>
    <p v-if="hint" class="shm-hint is-indented">{{ hint }}</p>
  </div>
</template>
