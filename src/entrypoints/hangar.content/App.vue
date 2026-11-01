<script setup lang="ts">
import { i18n } from '#i18n';
import { startSync, syncState } from '@/hangar/sync-state';
</script>

<!-- Reuses the markup classes of the original hangar page so the view inherits the site's look. -->
<template>
  <div class="top">
    <h2 class="title">{{ i18n.t('manager.title') }}</h2>
    <button
      type="button"
      class="shadow-button trans-02s trans-color shm-refresh"
      :disabled="syncState.running"
      :title="i18n.t('manager.refresh')"
      :aria-label="i18n.t('manager.refresh')"
      :aria-busy="syncState.running"
      @click="startSync"
    >
      <span class="label js-label trans-02s">
        <span class="shm-refresh-icon" :class="{ 'is-spinning': syncState.running }">🔁</span>
        <span v-if="syncState.progress" class="shm-refresh-progress">
          {{ syncState.progress.done }} / {{ syncState.progress.total }}
        </span>
      </span>
      <span class="left-section"></span>
      <span class="right-section"></span>
    </button>
    <p>{{ i18n.t('manager.intro') }}</p>
    <div class="separator"></div>
    <div class="cboth"></div>
  </div>
</template>

<style scoped>
/*
 * RSI styles the header buttons as `a.shadow-button`; mirror their layout for a real <button>.
 * More specific RSI rules (from stylesheets on their CDN) override layout and font otherwise,
 * hence `!important` on those properties.
 */
.shm-refresh {
  float: right !important;
  display: block !important;
  padding: 0 12px !important;
  font-family: Electrolize, sans-serif !important;
  font-size: 11px !important;
  line-height: 30px !important;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-refresh:disabled {
  cursor: progress;
}

.shm-refresh-icon {
  display: inline-block;
}

.shm-refresh-icon.is-spinning {
  animation: shm-spin 1s linear infinite;
}

.shm-refresh-progress {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
}

@keyframes shm-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shm-refresh-icon.is-spinning {
    animation: none;
  }
}
</style>
