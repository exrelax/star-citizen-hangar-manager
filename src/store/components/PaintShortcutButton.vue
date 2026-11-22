<script setup lang="ts">
import { PAINT_REBUY_SHORTCUT } from '@/hangar/hangar-shortcuts';
import { isListShortcutOpen, toggleListShortcut } from '@/hangar/list-shortcut';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';

/*
 * "Show these paints" of a new plan of the Paint Discount Consultant (#430): the List Shortcut of
 * the paints it would optimize in "My Hangar" – the very shortcut of its sidebar box (#146,
 * `PAINT_REBUY_SHORTCUT`), so both always show the same paints. While it is open, it closes it.
 */

const open = computed(() => isListShortcutOpen('hangar', PAINT_REBUY_SHORTCUT.id));
const toggle = () => toggleListShortcut(PAINT_REBUY_SHORTCUT);
</script>

<template>
  <div class="shm-paint-shortcut">
    <button
      v-tooltip="i18n.t(open ? 'consultant.boxUnfilterHint' : 'consultant.boxFilterHint')"
      type="button"
      class="shm-button"
      :aria-pressed="open"
      @click="toggle"
    >
      <SvgIcon :name="open ? 'filter-circle-xmark' : 'filter'" />
      {{ i18n.t(open ? 'consultant.boxUnfilter' : 'consultant.boxFilter') }}
    </button>
  </div>
</template>

<style scoped>
/* Below the paints it shows, at their trailing end. */
.shm-paint-shortcut {
  display: flex;
  justify-content: flex-end;
}
</style>
