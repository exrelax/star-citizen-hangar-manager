<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';

/*
 * A box of the sidebar (see `HangarSidebar.vue`): its title is the handle to move it within the
 * sidebar, by dragging or with the arrow keys up and down. The sidebar does the moving.
 */

defineProps<{ title: string; dragging?: boolean }>();
const emit = defineEmits<{
  /** The pointer went down on the handle; the sidebar follows it from there on. */
  grab: [];
  move: [step: -1 | 1];
}>();

function grab(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  emit('grab');
}

function key(event: KeyboardEvent) {
  const step = ({ ArrowUp: -1, ArrowDown: 1 } as const)[event.key as 'ArrowUp' | 'ArrowDown'];
  if (!step) return;
  event.preventDefault();
  emit('move', step);
}
</script>

<template>
  <section class="shm-sidebar-box" :class="{ 'is-dragging': dragging }" :aria-label="title">
    <header class="shm-sidebar-box-head">
      <span
        v-tooltip="i18n.t('sidebar.move')"
        class="shm-sidebar-handle"
        role="button"
        tabindex="0"
        :aria-label="`${title}: ${i18n.t('sidebar.move')}`"
        @pointerdown="grab"
        @keydown="key"
      >
        <SvgIcon name="grip-vertical" />
        <span class="shm-sidebar-title">{{ title }}</span>
      </span>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
