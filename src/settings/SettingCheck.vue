<script setup lang="ts">
import { useId } from 'vue';
import '@/shared/styles/switch.css';

/**
 * A setting that is on or off, as a row of a group (see SettingsGroup.vue): its label (the slot)
 * and an optional hint on the left, a switch on the right; the whole row toggles it. `disabled`
 * while the setting it depends on is off; `indented` below the setting it belongs to.
 */
defineProps<{ checked: boolean; hint?: string; disabled?: boolean; indented?: boolean }>();
const emit = defineEmits<{ change: [checked: boolean] }>();

const id = useId();
</script>

<template>
  <div
    class="shm-setting-row shm-check-setting"
    :class="{ 'is-disabled': disabled, 'is-indented': indented }"
  >
    <label class="shm-setting-row-main">
      <span class="shm-setting-row-text">
        <span :id="`${id}-label`" class="shm-setting-row-label"><slot /></span>
        <span v-if="hint" :id="`${id}-hint`" class="shm-hint">{{ hint }}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        class="shm-switch"
        :checked="checked"
        :disabled="disabled"
        :aria-labelledby="`${id}-label`"
        :aria-describedby="hint ? `${id}-hint` : undefined"
        @change="emit('change', ($event.target as HTMLInputElement).checked)"
      />
    </label>
  </div>
</template>
