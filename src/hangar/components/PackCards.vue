<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { computed } from 'vue';
import { packCards, type PackShip } from '../ship-pack';

/*
 * The image of a ship pack (#515) in a row's `.shm-thumb`: its first ship in front and up to two
 * more behind it, fanned out like playing cards, so a pack shows at once. Unlike a group's stack
 * (#445), each card is its own ship with a good part of it in sight. A ship without a known image is
 * a tinted card with the ship icon.
 */

const props = defineProps<{ ships: readonly PackShip[] }>();

/** Back cards first, so the front one is painted last. */
const cards = computed(() => [...packCards(props.ships)].reverse());
const front = computed(() => cards.value.at(-1)?.name);
</script>

<template>
  <span class="shm-pack-cards" aria-hidden="true">
    <span
      v-for="card in cards"
      :key="card.name"
      class="shm-pack-card"
      :class="{ 'is-front': card.name === front }"
      :style="{ '--shm-pack-fan': card.fan }"
    >
      <img
        v-if="card.image"
        :src="card.image"
        alt=""
        loading="lazy"
        decoding="async"
        width="96"
        height="54"
      />
      <SvgIcon v-else name="shuttle-space" />
    </span>
  </span>
</template>

<style>
/* Not scoped: inside the rows' thumb (row.css). */
.shm-pack-cards {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.shm-pack-card {
  position: absolute;
  bottom: 4px;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  color: var(--shm-accent);
  background: rgb(var(--shm-accent-rgb) / 0.16);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.4);
  border-radius: var(--shm-radius-small);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
  transform: translateX(calc(-50% + var(--shm-pack-fan) * 22%))
    rotate(calc(var(--shm-pack-fan) * 7deg));
  transform-origin: 50% 100%;
}

/* The cards behind are dimmer, so the front ship reads first. */
.shm-pack-card:not(.is-front) img {
  filter: brightness(0.7);
}

.shm-pack-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* The kind badge stays on top of the cards. */
.shm-thumb .shm-pack-cards ~ .shm-row-kind {
  z-index: 1;
}
</style>
