<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useId } from 'vue';

/*
 * A box of the sidebar (see `HangarSidebar.vue`): its title is the handle to move it within the
 * sidebar, by dragging or with the arrow keys up and down; the sidebar does the moving. A button
 * collapses it to its title.
 */

defineProps<{ title: string; dragging?: boolean; collapsed?: boolean }>();
const emit = defineEmits<{
  /** The pointer went down on the handle; the sidebar follows it from there on. */
  grab: [event: PointerEvent];
  move: [step: -1 | 1];
  toggle: [];
}>();

const bodyId = `shm-sidebar-box-${useId()}`;

function grab(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  emit('grab', event);
}

function key(event: KeyboardEvent) {
  const step = ({ ArrowUp: -1, ArrowDown: 1 } as const)[event.key as 'ArrowUp' | 'ArrowDown'];
  if (!step) return;
  event.preventDefault();
  emit('move', step);
}
</script>

<template>
  <section
    class="shm-sidebar-box"
    :class="{ 'is-dragging': dragging, 'is-collapsed': collapsed }"
    :aria-label="title"
  >
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
      <button
        v-tooltip="i18n.t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')"
        type="button"
        class="shm-sidebar-icon-button shm-sidebar-toggle"
        :aria-label="`${title}: ${i18n.t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}`"
        :aria-expanded="!collapsed"
        :aria-controls="bodyId"
        @click="emit('toggle')"
      >
        <SvgIcon name="chevron-up" />
      </button>
    </header>
    <!-- Collapses by its grid row, so the height animates (see the styles in HangarSidebar.vue). -->
    <div :id="bodyId" class="shm-sidebar-box-body" :inert="collapsed">
      <div class="shm-sidebar-box-content">
        <slot />
      </div>
    </div>
  </section>
</template>
