<script setup lang="ts">
import { INITIAL_LOAD_EXAMPLES } from '@/config';
import { i18n, locale } from '@/i18n';
import { computed } from 'vue';
import { startSync } from '../sync-state';

/*
 * In place of the lists while nothing is stored yet: the extension doesn't read the hangar on its
 * own, the user starts the first load here. It then runs like a refresh (progress on the refresh
 * button at the top right) and the lists appear when it is done.
 */

/** A duration in the language's own words, e.g. "20 seconds", "1,5 Minuten" (half minutes). */
function duration(seconds: number) {
  const [value, unit] =
    seconds < 60 ? [seconds, 'second'] : [Math.round(seconds / 30) / 2, 'minute'];
  return new Intl.NumberFormat(locale.value, { style: 'unit', unit, unitDisplay: 'long' }).format(
    value,
  );
}

const durationText = computed(() =>
  i18n.t(
    'manager.initialLoadDuration',
    INITIAL_LOAD_EXAMPLES.flatMap((example) => [
      duration(example.seconds),
      new Intl.NumberFormat(locale.value).format(example.pledges),
    ]),
  ),
);
</script>

<template>
  <section class="shm-initial-load">
    <p class="shm-initial-load-title">{{ i18n.t('manager.initialLoadTitle') }}</p>
    <p class="shm-initial-load-text">{{ i18n.t('manager.initialLoadText') }}</p>
    <button type="button" class="shm-button shm-initial-load-button" @click="startSync">
      {{ i18n.t('manager.initialLoad') }}
    </button>
    <p class="shm-initial-load-duration">{{ durationText }}</p>
  </section>
</template>

<style scoped>
.shm-initial-load {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 36px 24px;
  text-align: center;
  background: rgb(var(--shm-surface-rgb) / 0.6);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-initial-load p {
  max-width: 460px;
  margin: 0;
}

.shm-initial-load-title {
  color: var(--shm-text-strong);
  font-size: calc(15px * var(--shm-font-scale));
}

.shm-initial-load-text,
.shm-initial-load-duration {
  color: var(--shm-text-muted);
  font-size: calc(13px * var(--shm-font-scale));
}

.shm-initial-load-button {
  margin: 6px 0;
  padding: 7px 18px;
  font-size: calc(13px * var(--shm-font-scale));
}
</style>
