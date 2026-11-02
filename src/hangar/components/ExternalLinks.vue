<script setup lang="ts">
import erkulIcon from '@/assets/erkul.png';
import fleetyardsIcon from '@/assets/fleetyards.png';
import { i18n } from '@/i18n';
import { computed } from 'vue';
import type { ShipRef } from '../pledge-view';
import { erkulUrl, fleetyardsUrl } from '../ship-links';

const props = defineProps<{ ships: readonly ShipRef[] }>();

/** Ships with links; the favicons are bundled (~2 KB each), so showing them sends no requests. */
const linked = computed(() => props.ships.filter((ship) => ship.link));
</script>

<!--
  Links of the pledge's ships to other platforms, at the bottom of the expanded details. Both
  links are always rendered; the lists hide them via classes per setting (see row.css).
-->
<template>
  <div v-if="linked.length" class="shm-external-links">
    <span class="shm-external-label">{{ i18n.t('pledge.externalLinks') }}</span>
    <span v-for="ship in linked" :key="ship.name" class="shm-external-ship">
      <!-- The ship's name only tells the links apart when there are several ships. -->
      <span v-if="linked.length > 1" class="shm-external-ship-name">{{ ship.name }}</span>
      <a
        v-if="ship.link!.erkul"
        class="shm-button shm-link-button is-erkul"
        :href="erkulUrl(ship.link!.erkul)"
        target="_blank"
        rel="noopener noreferrer"
        :title="i18n.t('pledge.openOn', [ship.name, 'erkul.games'])"
        @click.stop
      >
        <img :src="erkulIcon" alt="" width="14" height="14" />erkul.games
      </a>
      <a
        class="shm-button shm-link-button is-fleetyards"
        :href="fleetyardsUrl(ship.link!.fleetyards)"
        target="_blank"
        rel="noopener noreferrer"
        :title="i18n.t('pledge.openOn', [ship.name, 'FleetYards.net'])"
        @click.stop
      >
        <img :src="fleetyardsIcon" alt="" width="14" height="14" />FleetYards.net
      </a>
    </span>
  </div>
</template>

<style scoped>
.shm-external-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(98, 196, 235, 0.15);
}

.shm-external-label {
  color: #8a9ba8;
}

.shm-external-ship {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.shm-external-ship-name {
  color: #dbe7ee;
}

/* The look comes from `.shm-button` (row.css); the icon goes left, the arrow right. */
.shm-link-button {
  padding-left: 7px;
}

.shm-link-button::after {
  content: '↗';
  color: #62c4eb;
  font-size: 11px;
}

.shm-link-button img {
  display: block;
  flex: none;
  border-radius: 2px;
}
</style>
