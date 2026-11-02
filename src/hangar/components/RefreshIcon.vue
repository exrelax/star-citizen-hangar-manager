<script setup lang="ts">
defineProps<{ spinning?: boolean }>();
</script>

<!--
  Two equal arrows, point-symmetric around the centre of the box: unlike the 🔁 emoji (whose
  glyph isn't centred), it spins without wobbling. Takes the text colour.
-->
<template>
  <svg
    class="shm-refresh-icon"
    :class="{ 'is-spinning': spinning }"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M19.05 14.57A7.5 7.5 0 0 1 5.5 15.75M4.95 9.43A7.5 7.5 0 0 1 18.5 8.25"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M3.25 17.05L4.57 13.04L7.76 14.45ZM20.75 6.95L19.43 10.96L16.24 9.55Z"
      fill="currentColor"
    />
  </svg>
</template>

<style scoped>
.shm-refresh-icon {
  display: inline-block;
  width: 1.3em;
  height: 1.3em;
  flex: none;
  vertical-align: -0.3em;
}

.is-spinning {
  animation: shm-spin 1s linear infinite;
}

@keyframes shm-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning {
    animation: none;
  }
}
</style>
