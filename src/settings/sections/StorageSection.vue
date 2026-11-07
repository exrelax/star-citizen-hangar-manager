<script setup lang="ts">
import { syncState } from '@/hangar/sync-state';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { clearStorage } from '@/shared/local-cache';
import { formatRelativeTime } from '@/shared/lib/relative-time';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { EMPTY_META } from '@/storage/meta';
import { LOCAL_COPY, type StorageDefinition, type StorageId } from '@/storage/registry';
import { useStored } from '@/storage/use-stored';
import { computed, onMounted, onUnmounted, ref } from 'vue';

/*
 * What the extension keeps in this browser, one row per storage (see `storage/registry.ts`):
 * entries, size, last full sync and last check – and a reset of each on its own.
 */

const rows = LOCAL_COPY.map((definition) => ({
  definition,
  value: useStored(definition.item),
  meta: definition.meta ? useStored(definition.meta) : ref(EMPTY_META),
}));

// Keeps "2 minutes ago" current.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 30_000)));
onUnmounted(() => clearInterval(timer));

const numbers = computed(() => new Intl.NumberFormat(locale.value));
const bytes = (value: unknown) =>
  value === undefined || value === null
    ? 0
    : new TextEncoder().encode(JSON.stringify(value)).length;

/** e.g. "1.2 MB", "38 kB". */
function formatSize(size: number) {
  const [value, unit] = size >= 1e6 ? [size / 1e6, 'megabyte'] : [size / 1e3, 'kilobyte'];
  return new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit,
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

const when = (at: number) => (at ? formatRelativeTime(at, now.value, locale.value) : '–');
const exactly = (at: number) =>
  at
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(at)
    : undefined;

// Entries and size only change with the data, not with the clock (the hangar is a few MB).
const amounts = rows.map(({ definition, value, meta }) =>
  computed(() => {
    const stored = value.value;
    if (stored === null || stored === undefined) return undefined;
    return {
      count: numbers.value.format(definition.count?.(stored as never) ?? 0),
      size: formatSize(bytes(stored) + bytes(meta.value)),
    };
  }),
);

const view = computed(() =>
  rows.map(({ definition, meta }, index) => {
    const amount = amounts[index]!.value;
    const metadata = meta.value ?? EMPTY_META;
    return {
      definition,
      empty: !amount,
      count: amount?.count ?? '–',
      size: amount?.size ?? '–',
      syncedAt: metadata.syncedAt,
      checkedAt: metadata.checkedAt,
      failed: metadata.lastOutcome?.status === 'failed',
    };
  }),
);

const name = (id: StorageId) => i18n.t(`storage.${id}.name`);

/** The storage reset last, shown below the table until the next reset. */
const resetDone = ref<StorageId>();

async function reset(definition: StorageDefinition) {
  const readAgain = i18n.t(
    definition.readAgain === 'auto' ? 'storage.readAgainAuto' : 'storage.readAgainRefresh',
  );
  const message = i18n.t('storage.resetConfirm', [
    name(definition.id),
    i18n.t(`storage.${definition.id}.missing`),
    readAgain,
  ]);
  if (!confirm(message)) return;
  await clearStorage(definition);
  resetDone.value = definition.id;
}
</script>

<template>
  <fieldset class="shm-setting">
    <legend class="shm-label">{{ i18n.t('storage.title') }}</legend>
    <p class="shm-hint is-first">{{ i18n.t('storage.intro') }}</p>
    <div class="shm-storage-scroll">
      <table class="shm-storage-table">
        <thead>
          <tr>
            <th scope="col">{{ i18n.t('storage.colData') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('storage.colEntries') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('storage.colSize') }}</th>
            <th scope="col">{{ i18n.t('storage.colSynced') }}</th>
            <th scope="col">{{ i18n.t('storage.colChecked') }}</th>
            <th scope="col">
              <span class="shm-visually-hidden">{{ i18n.t('storage.colReset') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in view" :key="row.definition.id">
            <th scope="row">
              <span class="shm-storage-name">{{ name(row.definition.id) }}</span>
              <span class="shm-storage-content">{{
                i18n.t(`storage.${row.definition.id}.content`)
              }}</span>
            </th>
            <td class="is-number">{{ row.count }}</td>
            <td class="is-number">{{ row.size }}</td>
            <td>
              <span v-tooltip="exactly(row.syncedAt)">{{ when(row.syncedAt) }}</span>
            </td>
            <td :class="{ 'is-failed': row.failed }">
              <span
                v-tooltip="row.failed ? i18n.t('storage.checkFailed') : exactly(row.checkedAt)"
                >{{ when(row.checkedAt) }}</span
              >
            </td>
            <td class="is-action">
              <!-- Not during a refresh: it would store the data again right after. -->
              <button
                v-tooltip="i18n.t('storage.resetOne', [name(row.definition.id)])"
                type="button"
                class="shm-button is-danger is-icon"
                :disabled="row.empty || syncState.running"
                @click="reset(row.definition)"
              >
                <SvgIcon name="trash" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="resetDone" class="shm-hint is-done" role="status">
      {{ i18n.t('storage.resetDone', [name(resetDone)]) }}
    </p>
  </fieldset>
</template>

<style scoped>
.shm-storage-scroll {
  overflow-x: auto;
}

.shm-storage-table {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-storage-table th,
.shm-storage-table td {
  padding: 6px 10px 6px 0;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

.shm-storage-table thead th {
  color: var(--shm-text-muted);
  font-weight: 400;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-storage-table tbody tr + tr > * {
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.1);
}

.shm-storage-table tbody th {
  font-weight: 400;
  white-space: normal;
}

.shm-storage-table .is-number {
  text-align: right;
}

.shm-storage-table .is-action {
  width: 1%;
  padding-right: 0;
  vertical-align: middle;
}

.shm-storage-table .is-failed {
  color: var(--shm-danger);
}

.shm-storage-name {
  display: block;
  color: var(--shm-text-strong);
}

.shm-storage-content {
  display: block;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-button.is-icon {
  padding: 0 8px;
}

.shm-hint.is-done {
  color: var(--shm-success);
}

.shm-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
