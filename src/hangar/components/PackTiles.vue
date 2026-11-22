<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { PackShip } from '../ship-pack';

/*
 * The ships of a pack (#515) in its expanded row, above the table of its items: a tile per ship
 * with its image and name, in the order RSI lists them.
 */

defineProps<{ ships: readonly PackShip[] }>();
</script>

<template>
  <ul class="shm-pack-tiles" :aria-label="i18n.t('pack.tiles')">
    <li v-for="(ship, index) in ships" :key="index" class="shm-pack-tile">
      <span class="shm-pack-tile-image">
        <img
          v-if="ship.image"
          :src="ship.image"
          alt=""
          loading="lazy"
          decoding="async"
          width="160"
          height="90"
        />
        <SvgIcon v-else name="shuttle-space" />
      </span>
      <span class="shm-pack-tile-name">{{ ship.name }}</span>
    </li>
  </ul>
</template>

<style>
/* Not scoped: in the rows' details (row.css). */
.shm-pack-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.shm-pack-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.shm-pack-tile-image {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  color: var(--shm-accent);
  background: rgb(var(--shm-accent-rgb) / 0.08);
  border-radius: var(--shm-radius-small);
}

.shm-pack-tile-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shm-pack-tile-name {
  overflow: hidden;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
