<script setup lang="ts">
import { useId } from 'vue';

/**
 * Settings that belong together, as one grouped surface of rows (SettingCheck.vue,
 * SettingRow.vue), like a group of the system settings: an optional title above it with an action
 * at its right (slot `action`, e.g. "Reset order"), an optional footer below it. `disabled` dims
 * the whole group while the switch it depends on (in the group above) is off.
 */
defineProps<{ title?: string; footer?: string; disabled?: boolean; danger?: boolean }>();

const id = useId();
</script>

<template>
  <div
    class="shm-settings-group"
    :class="{ 'is-disabled': disabled }"
    role="group"
    :aria-labelledby="title ? `${id}-title` : undefined"
    :aria-disabled="disabled || undefined"
  >
    <div v-if="title || $slots.action" class="shm-settings-group-head">
      <span v-if="title" :id="`${id}-title`" class="shm-settings-group-title">{{ title }}</span>
      <slot name="action" />
    </div>
    <div class="shm-settings-rows" :class="{ 'is-danger': danger }"><slot /></div>
    <p v-if="footer" class="shm-settings-group-foot">{{ footer }}</p>
    <slot name="after" />
  </div>
</template>
