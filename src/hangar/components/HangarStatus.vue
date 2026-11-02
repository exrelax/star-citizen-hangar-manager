<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import { SMART_UPDATE } from '@/config';
import { formatRelativeTime } from '@/shared/lib/relative-time';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { startSync, syncState } from '../sync-state';
import { useCheckState } from '../use-check-state';

const props = defineProps<{
  syncedAt?: string;
  smartUpdates: boolean;
  /** Whose check state to show. */
  source?: 'hangar' | 'buyback';
}>();

const checkState = useCheckState(props.source);

// Keeps "2 minutes ago" current.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(
  () => (timer = setInterval(() => (now.value = Date.now()), SMART_UPDATE.statusRefreshMs)),
);
onUnmounted(() => clearInterval(timer));

const ago = (at: number) => formatRelativeTime(at, now.value, locale.value);

const fullSyncIsOld = computed(() => {
  if (!props.syncedAt) return false;
  const days = (now.value - Date.parse(props.syncedAt)) / (24 * 60 * 60 * 1000);
  return days >= SMART_UPDATE.suggestFullSyncAfterDays;
});

/** One line of status; `warn` adds the full refresh button. */
const status = computed((): { text: string; warn?: boolean } | null => {
  const outcome = checkState.value?.lastOutcome;
  if (syncState.checking) return { text: i18n.t('status.checking') };
  if (outcome?.status === 'needsFullSync')
    return { text: i18n.t('status.needsFullSync'), warn: true };
  if (fullSyncIsOld.value && props.syncedAt) {
    return { text: i18n.t('status.fullSyncOld', [ago(Date.parse(props.syncedAt))]), warn: true };
  }
  if (!props.smartUpdates || !outcome) {
    return props.syncedAt
      ? { text: i18n.t('status.lastFullSync', [ago(Date.parse(props.syncedAt))]) }
      : null;
  }
  switch (outcome.status) {
    case 'failed':
      return { text: i18n.t('status.failed', [ago(outcome.at)]) };
    case 'updated':
      return {
        text: i18n.t('status.updated', [
          ago(outcome.at),
          outcome.added,
          outcome.removed,
          outcome.changed,
        ]),
      };
    default:
      return { text: i18n.t('status.upToDate', [ago(outcome.at)]) };
  }
});
</script>

<template>
  <p v-if="status" class="shm-status" :class="{ 'is-warn': status.warn }" aria-live="polite">
    <span>{{ status.text }}</span>
    <button
      v-if="status.warn"
      type="button"
      class="shm-status-action"
      :disabled="syncState.running"
      @click="startSync"
    >
      🔁 {{ i18n.t('status.fullRefresh') }}
    </button>
  </p>
</template>

<style scoped>
.shm-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0 0;
  color: #8a9ba8;
  font-size: 12px;
}

.shm-status.is-warn {
  color: #f0b232;
}

.shm-status-action {
  padding: 3px 10px;
  color: #f0b232;
  font: inherit;
  background: none;
  border: 1px solid rgba(240, 178, 50, 0.7);
  cursor: pointer;
}

.shm-status-action:hover:not(:disabled),
.shm-status-action:focus-visible {
  color: #0b141c;
  background: #f0b232;
  outline: none;
}

.shm-status-action:disabled {
  cursor: progress;
  opacity: 0.5;
}
</style>
