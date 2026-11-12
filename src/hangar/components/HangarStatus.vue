<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import { SMART_UPDATE } from '@/config';
import { formatRelativeTime } from '@/shared/lib/relative-time';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { startSync, syncState } from '../sync-state';
import { useCheckState } from '../use-check-state';
import { buybackMeta } from '@/buyback/buyback-storage';
import { ordersMeta } from '@/orders/orders-storage';
import { vTooltip } from '@/shared/tooltip/tooltip';
import type { CheckOutcome } from '@/storage/meta';
import { useStored } from '@/storage/use-stored';
import { hangarMeta } from '../hangar-storage';
import RefreshIcon from './RefreshIcon.vue';

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
  // Until the refresh is done, the last update and its outcome are about to change.
  if (syncState.running) {
    const section = syncState.progress?.section;
    return {
      text: section
        ? i18n.t('status.refreshingSection', [
            i18n.t(`storage.${section.id}.name`),
            section.done,
            section.total,
          ])
        : i18n.t('status.refreshing'),
    };
  }
  // Also while another tab checks: its findings arrive here through the storage.
  if (syncState.checking || syncState.checkingElsewhere) return { text: i18n.t('status.checking') };
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

// What the last smart update did, step by step (see `maybeRunSmartUpdate`), for the tooltip.
const steps = [
  { id: 'orders', meta: useStored(ordersMeta) },
  { id: 'buyback', meta: useStored(buybackMeta) },
  { id: 'hangar', meta: useStored(hangarMeta) },
] as const;

function stepResult(id: (typeof steps)[number]['id'], outcome: CheckOutcome) {
  switch (outcome.status) {
    case 'failed':
      return i18n.t('status.stepFailed');
    case 'needsFullSync':
      return i18n.t('status.stepNeedsFullSync');
    case 'updated':
      return id === 'orders'
        ? i18n.n('status.stepNewLogEntries', outcome.added)
        : i18n.t('status.stepUpdated', [outcome.added, outcome.removed, outcome.changed]);
    default:
      return i18n.t('status.stepUnchanged');
  }
}

const details = computed(() => {
  if (syncState.running || !props.smartUpdates) return undefined;
  const lines = steps.flatMap(({ id, meta }) => {
    const outcome = meta.value?.lastOutcome;
    if (!outcome) return [];
    const pages =
      outcome.pages === undefined ? '' : ` · ${i18n.n('status.stepPages', outcome.pages)}`;
    return [
      `${i18n.t(`storage.${id}.name`)}: ${stepResult(id, outcome)}${pages} (${ago(outcome.at)})`,
    ];
  });
  return lines.length ? { title: i18n.t('status.stepsTitle'), text: lines.join('\n') } : undefined;
});
</script>

<template>
  <p v-if="status" class="shm-status" :class="{ 'is-warn': status.warn }" aria-live="polite">
    <span v-tooltip="details" :tabindex="details ? 0 : undefined">{{ status.text }}</span>
    <button
      v-if="status.warn"
      type="button"
      class="shm-status-action"
      :disabled="syncState.running"
      @click="startSync"
    >
      <RefreshIcon /> {{ i18n.t('status.fullRefresh') }}
    </button>
  </p>
</template>

<style scoped>
.shm-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-status.is-warn {
  color: var(--shm-upgraded);
}

.shm-status-action {
  padding: 3px 10px;
  color: var(--shm-upgraded);
  font: inherit;
  background: none;
  border: 1px solid rgb(var(--shm-upgraded-rgb) / 0.7);
  cursor: pointer;
}

.shm-status-action:hover:not(:disabled),
.shm-status-action:focus-visible {
  color: var(--shm-text-on-accent);
  background: var(--shm-upgraded);
  outline: none;
}

.shm-status-action:disabled {
  cursor: progress;
  opacity: 0.5;
}
</style>
