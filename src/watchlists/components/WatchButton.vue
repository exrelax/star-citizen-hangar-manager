<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';

/*
 * The notepad button that opens the choice of watchlists for an item of a table (#470), e.g. a ship
 * of the table of all ships or a paint of the Paint Discount Consultant: tinted while the item is
 * on a watchlist.
 */

defineProps<{
  /** Its tooltip, e.g. "Put the Carrack on a watchlist". */
  hint: string;
  /** The item is on a watchlist. */
  on: boolean;
}>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button
    v-tooltip="hint"
    type="button"
    class="shm-watch-button"
    :class="{ 'is-on': on }"
    :aria-label="hint"
    aria-haspopup="dialog"
    @click.stop="emit('open')"
  >
    <SvgIcon name="clipboard-list" />
  </button>
</template>

<style>
.shm-watch-button {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--shm-text-faint);
  font-size: calc(13px * var(--shm-font-scale));
  vertical-align: middle;
  background: none;
  border: 0;
  border-radius: var(--shm-radius-small);
  cursor: pointer;
}

/* A hit area of 44 × 44 px (Apple Human Interface Guidelines). */
.shm-watch-button::before {
  position: absolute;
  inset: -10px;
  content: '';
}

.shm-watch-button:hover,
.shm-watch-button:focus-visible {
  color: var(--shm-accent);
  background: rgb(var(--shm-accent-rgb) / 0.14);
  outline: none;
}

.shm-watch-button.is-on {
  color: var(--shm-accent);
}
</style>
