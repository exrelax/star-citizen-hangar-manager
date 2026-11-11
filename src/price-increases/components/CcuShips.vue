<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Ship } from '@/ships/ships';

/**
 * The two ships of a CCU as small images, base on the left, an arrow, target on the right (#252).
 * Decorative: the text next to it names the ships. A ship without image keeps its place.
 */
defineProps<{ from?: Ship; to?: Ship }>();
</script>

<template>
  <span class="shm-ccu-ships" aria-hidden="true">
    <img v-if="from?.image" class="shm-ccu-ship" :src="from.image" alt="" loading="lazy" />
    <span v-else class="shm-ccu-ship"></span>
    <SvgIcon name="arrow-right" class="shm-ccu-ships-arrow" />
    <img v-if="to?.image" class="shm-ccu-ship" :src="to.image" alt="" loading="lazy" />
    <span v-else class="shm-ccu-ship"></span>
  </span>
</template>

<style>
.shm-ccu-ships {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.shm-ccu-ship {
  display: block;
  width: 56px;
  height: 32px;
  object-fit: cover;
  background: rgb(var(--shm-accent-rgb) / 0.08);
  border-radius: var(--shm-radius-small);
}

.shm-ccu-ships-arrow {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}
</style>
