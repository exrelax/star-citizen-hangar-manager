<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import { computed, useId } from 'vue';

/*
 * "Select all" above a list (#620): the round checkbox of the rows with its label, and its three
 * states – none, some, all of the items the list shows selected. Its label tells screen readers how
 * many are selected ("3 of 12 selected"); Space toggles it as any button.
 */

const props = defineProps<{
  state: 'false' | 'mixed' | 'true';
  selected: number;
  total: number;
}>();
const emit = defineEmits<{ toggle: [] }>();

const id = useId();
const count = computed(() => {
  const format = new Intl.NumberFormat(locale.value);
  return i18n.t('manager.selectedOf', [format.format(props.selected), format.format(props.total)]);
});
</script>

<template>
  <span class="shm-select-all">
    <button
      type="button"
      role="checkbox"
      class="shm-select-toggle is-inline"
      :aria-checked="state"
      :aria-labelledby="`${id}-label`"
      :aria-describedby="`${id}-count`"
      :disabled="!total"
      @click="emit('toggle')"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path v-if="state === 'mixed'" d="M4.5 8h7" />
        <path v-else d="M4.5 8.2l2.3 2.3 4.7-4.9" />
      </svg>
    </button>
    <!-- The label toggles it too, like a checkbox's label; the button stays the one to focus. -->
    <span :id="`${id}-label`" class="shm-select-all-label" @click="total && emit('toggle')">
      {{ i18n.t('manager.selectAll') }}
    </span>
    <span :id="`${id}-count`" class="shm-select-all-count">{{ count }}</span>
  </span>
</template>

<style>
.shm-select-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.shm-select-all-label {
  color: var(--shm-text-secondary);
  cursor: pointer;
  user-select: none;
}

.shm-select-all .shm-select-toggle:disabled,
.shm-select-all .shm-select-toggle:disabled + .shm-select-all-label {
  opacity: 0.5;
  cursor: default;
}

/* Only while some are selected; screen readers always hear it with the checkbox. */
.shm-select-all-count {
  color: var(--shm-text-muted);
}

.shm-select-all .shm-select-toggle[aria-checked='false'] ~ .shm-select-all-count {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
