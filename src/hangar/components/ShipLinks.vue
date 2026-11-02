<script setup lang="ts">
import { erkulUrl, fleetyardsUrl, type ShipLink } from '../ship-links';

defineProps<{ link?: ShipLink }>();
</script>

<!-- Both links are always rendered; the lists hide them via classes per setting (see row.css). -->
<template>
  <span v-if="link" class="shm-ship-links">
    <a
      v-if="link.erkul"
      class="shm-ship-link is-erkul"
      :href="erkulUrl(link.erkul)"
      target="_blank"
      rel="noopener noreferrer"
      title="erkul.games"
      @click.stop
    >
      erkul
    </a>
    <a
      class="shm-ship-link is-fleetyards"
      :href="fleetyardsUrl(link.fleetyards)"
      target="_blank"
      rel="noopener noreferrer"
      title="fleetyards.net"
      @click.stop
    >
      FY
    </a>
  </span>
</template>

<style scoped>
.shm-ship-links {
  display: inline-flex;
  gap: 4px;
  margin-left: 6px;
  vertical-align: 1px;
}

.shm-ship-link {
  padding: 0 4px;
  color: #62c4eb;
  font-size: 10px;
  line-height: 15px;
  text-decoration: none;
  text-transform: none;
  border: 1px solid rgba(98, 196, 235, 0.45);
}

.shm-ship-link:hover,
.shm-ship-link:focus-visible {
  color: #0b141c;
  background: #62c4eb;
  outline: none;
}
</style>
