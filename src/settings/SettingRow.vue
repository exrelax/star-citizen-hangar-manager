<script setup lang="ts">
import { useId } from 'vue';

/**
 * A setting with its own control, as a row of a group (see SettingsGroup.vue): label and an
 * optional hint on the left, the control (the default slot, e.g. a select or a number field) on
 * the right, and content that needs the whole width below (slot `below`). `for` ties the label
 * to the control's id; without it the label names the row's controls as a group. `disabled` dims
 * the row while the setting it depends on is off; the control disables itself.
 */
const props = defineProps<{
  label?: string;
  hint?: string;
  for?: string;
  hintId?: string;
  disabled?: boolean;
  indented?: boolean;
}>();

const id = useId();
const hintId = () => props.hintId ?? `${id}-hint`;
</script>

<template>
  <div
    class="shm-setting-row"
    :class="{ 'is-disabled': disabled, 'is-indented': indented }"
    :role="props.for ? undefined : 'group'"
    :aria-labelledby="props.for || !label ? undefined : `${id}-label`"
  >
    <div class="shm-setting-row-main">
      <div v-if="label || hint || $slots.label" class="shm-setting-row-text">
        <label v-if="props.for" class="shm-setting-row-label" :for="props.for">
          <slot name="label">{{ label }}</slot>
        </label>
        <span v-else :id="`${id}-label`" class="shm-setting-row-label">
          <slot name="label">{{ label }}</slot>
        </span>
        <p v-if="hint" :id="hintId()" class="shm-hint">{{ hint }}</p>
      </div>
      <div v-if="$slots.default" class="shm-setting-row-control"><slot /></div>
    </div>
    <slot name="below" />
  </div>
</template>
