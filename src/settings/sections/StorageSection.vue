<script setup lang="ts">
import RefreshIcon from '@/hangar/components/RefreshIcon.vue';
import ResetSection from './ResetSection.vue';
import SettingsGroup from '../SettingsGroup.vue';
import { startStorageSync, syncState } from '@/hangar/sync-state';
import { upgradeToolState } from '@/ships/sync-upgrade-tool';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { clearStorage } from '@/shared/local-cache';
import { formatRelativeTime } from '@/shared/lib/relative-time';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { EMPTY_META } from '@/storage/meta';
import { LOCAL_COPY, SYNCED, type StorageDefinition, type StorageId } from '@/storage/registry';
import { nearLimits, type SyncedId, type SyncedUsage } from '@/storage/synced-usage';
import { useSyncedUsage } from '@/storage/use-synced-usage';
import { clearWatchlists, SYNC_QUOTA } from '@/watchlists/watchlists-storage';
import { demoMeltMarksItem, meltMarksItem } from '@/hangar/melt-marks';
import { useStored } from '@/storage/use-stored';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useDemoContext } from '@/demo/use-demo';

/*
 * What the extension keeps in this browser, one row per storage (see `storage/registry.ts`):
 * entries, size, last full sync and last check – and, for each on its own, a refresh and a reset.
 * Below it, what the user keeps in the synced storage (#560), with its use against the limits.
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

/*
 * The demo mode (#132): the storages of the account show the demo's numbers instead – its entries,
 * a size for them and made-up times –, and can't be read again or deleted meanwhile, so nothing
 * real changes. The public data (ships, Pledge Store items) shows as it is.
 */
const demo = useDemoContext();
/** Typical bytes per entry, for a plausible size of the demo's data. */
const DEMO_BYTES: Partial<Record<StorageId, number>> = {
  hangar: 1400,
  buyback: 600,
  orders: 250,
  storeCredit: 120,
  paintPlan: 900,
  paintHistory: 700,
  events: 900,
  priceIncreases: 160,
};
/** How long ago the demo's data was read in full, in minutes. */
const DEMO_SYNCED_AGO: Partial<Record<StorageId, number>> = {
  storeCredit: 12,
  paintPlan: 1440,
  paintHistory: 1440,
};
const masked = (id: StorageId) => demo.value?.storage.counts[id] !== undefined;

const view = computed(() =>
  rows.map(({ definition, meta }, index) => {
    const id = definition.id;
    const demoCount = demo.value?.storage.counts[id];
    if (demoCount !== undefined) {
      return {
        definition,
        empty: demoCount === 0,
        count: numbers.value.format(demoCount),
        size: formatSize(demoCount * (DEMO_BYTES[id] ?? 200)),
        syncedAt: now.value - (DEMO_SYNCED_AGO[id] ?? 180) * 60_000,
        checkedAt: now.value - 4 * 60_000,
        failed: false,
      };
    }
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

/** The three storages of the upgrade tool are read together. */
const isUpgradeTool = (id: string) => id.startsWith('ships');
const isReading = (id: StorageId) =>
  syncState.storage === id ||
  (isUpgradeTool(id) && (upgradeToolState.loading || isUpgradeTool(syncState.storage ?? '')));

/** The events (#69), the expected price increases (#195), … come from the project website. */
const fromWebsite = (id: StorageId) =>
  id === 'events' ||
  id === 'priceIncreases' ||
  id === 'shipRemovals' ||
  id === 'buybackTokenRenewals' ||
  id === 'shipFacts' ||
  id === 'warbondHistorySite';

/** The storage reset last, shown below the table until the next reset. */
const resetDone = ref<StorageId>();

async function reset(definition: StorageDefinition) {
  const readAgain = i18n.t(
    definition.readAgain === 'auto'
      ? fromWebsite(definition.id)
        ? 'storage.readAgainAutoWebsite'
        : 'storage.readAgainAuto'
      : definition.readAgain === 'never'
        ? 'storage.readAgainNever'
        : 'storage.readAgainRefresh',
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

/*
 * The synced storage (#560): the watchlists and the marks to melt follow the browser profile, so
 * they are neither read again nor reset with the local copy. In the demo mode the demo's own
 * (never the account's), with a made-up use near the limit by the demo settings.
 */
const syncedUsage = useSyncedUsage(computed(() => !!demo.value));
const syncedShown = computed<SyncedUsage | undefined>(() => {
  const usage = syncedUsage.value;
  if (!usage || !demo.value?.storage.syncedNearLimit) return usage;
  return { ...usage, bytes: Math.max(usage.bytes, Math.round(SYNC_QUOTA.total * 0.92)) };
});

/** The browsers count the synced storage in KiB ("100 KB", "8 KB"), so it is shown that way. */
function formatSyncedSize(size: number) {
  const value = size / 1024;
  return new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

const syncedView = computed(() =>
  SYNCED.map(({ id }) => {
    const row = syncedShown.value?.rows[id as SyncedId];
    return {
      id,
      empty: !row?.entries,
      count: row ? numbers.value.format(row.entries) : '–',
      size: row?.bytes ? formatSyncedSize(row.bytes) : '–',
    };
  }),
);

const syncedQuota = computed(() => {
  const usage = syncedShown.value;
  if (!usage) return undefined;
  const near = nearLimits(usage);
  const warnings = [
    ...(near.total ? [i18n.t('storage.synced.nearTotal')] : []),
    ...(near.keys ? [i18n.t('storage.synced.nearItems')] : []),
    ...near.perKey.map((id) =>
      i18n.t(
        id === 'watchlists'
          ? 'storage.synced.nearKeyWatchlists'
          : 'storage.synced.nearKeyMeltMarks',
        [formatSyncedSize(SYNC_QUOTA.perItem)],
      ),
    ),
  ];
  return {
    bytes: usage.bytes,
    fraction: Math.min(1, usage.bytes / SYNC_QUOTA.total),
    near: near.total,
    used: i18n.t('storage.synced.usage', [
      formatSyncedSize(usage.bytes),
      formatSyncedSize(SYNC_QUOTA.total),
    ]),
    items: i18n.t('storage.synced.items', [
      numbers.value.format(usage.keys),
      numbers.value.format(SYNC_QUOTA.maxItems),
    ]),
    warnings,
  };
});

/** The synced storage deleted last, shown below its table. */
const syncedDone = ref<StorageId>();

/** Deletes it on every device of the profile, after a question; the demo's own in the demo. */
async function deleteSynced(id: StorageId) {
  const message = i18n.t('storage.synced.deleteConfirm', [
    name(id),
    i18n.t(`storage.${id}.missing`),
  ]);
  if (!confirm(message)) return;
  const isDemo = !!demo.value;
  if (id === 'watchlists') await clearWatchlists(isDemo);
  else await (isDemo ? demoMeltMarksItem : meltMarksItem).removeValue();
  syncedDone.value = id;
}
</script>

<template>
  <p class="shm-settings-intro">{{ i18n.t('storage.intro') }}</p>
  <SettingsGroup>
    <div class="shm-storage-scroll">
      <table class="shm-storage-table">
        <thead>
          <tr>
            <th scope="col">{{ i18n.t('storage.colData') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('storage.colEntries') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('storage.colSize') }}</th>
            <th scope="col" class="is-time">{{ i18n.t('storage.colSynced') }}</th>
            <th scope="col" class="is-time">{{ i18n.t('storage.colChecked') }}</th>
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
              <!-- The two times below the name when the panel is too narrow for their columns. -->
              <span class="shm-storage-times">
                <span
                  >{{ i18n.t('storage.colSynced') }}:
                  <span class="shm-storage-time">{{ when(row.syncedAt) }}</span></span
                >
                <span :class="{ 'is-failed': row.failed }"
                  >{{ i18n.t('storage.colChecked') }}:
                  <span class="shm-storage-time">{{ when(row.checkedAt) }}</span></span
                >
              </span>
            </th>
            <td class="is-number">{{ row.count }}</td>
            <td class="is-number">{{ row.size }}</td>
            <td class="is-time">
              <span v-tooltip="exactly(row.syncedAt)">{{ when(row.syncedAt) }}</span>
            </td>
            <td class="is-time" :class="{ 'is-failed': row.failed }">
              <span
                v-tooltip="row.failed ? i18n.t('storage.checkFailed') : exactly(row.checkedAt)"
                >{{ when(row.checkedAt) }}</span
              >
            </td>
            <td class="is-action">
              <span class="shm-storage-actions">
                <!-- Not for what can't be read from RSI, e.g. the consultant's plan. -->
                <button
                  v-if="row.definition.readAgain !== 'never'"
                  v-tooltip="
                    masked(row.definition.id)
                      ? i18n.t('storage.demoDisabled')
                      : i18n.t(
                          fromWebsite(row.definition.id)
                            ? 'storage.refreshOneWebsite'
                            : 'storage.refreshOne',
                          [name(row.definition.id)],
                        )
                  "
                  type="button"
                  class="shm-button is-icon"
                  :disabled="
                    syncState.running || upgradeToolState.loading || masked(row.definition.id)
                  "
                  :aria-busy="isReading(row.definition.id)"
                  @click="startStorageSync(row.definition.id)"
                >
                  <RefreshIcon :spinning="isReading(row.definition.id)" />
                </button>
                <!-- Not during a refresh: it would store the data again right after. -->
                <button
                  v-tooltip="
                    masked(row.definition.id)
                      ? i18n.t('storage.demoDisabled')
                      : i18n.t('storage.resetOne', [name(row.definition.id)])
                  "
                  type="button"
                  class="shm-button is-danger is-icon"
                  :disabled="row.empty || syncState.running || masked(row.definition.id)"
                  @click="reset(row.definition)"
                >
                  <SvgIcon name="trash" />
                </button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #after>
      <p v-if="resetDone" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t('storage.resetDone', [name(resetDone)]) }}
      </p>
    </template>
  </SettingsGroup>
  <!-- What follows the browser profile (#560): no refresh, never reset with the local copy. -->
  <SettingsGroup :title="i18n.t('storage.synced.title')" :footer="i18n.t('storage.synced.footer')">
    <div class="shm-storage-scroll">
      <table class="shm-storage-table">
        <thead>
          <tr>
            <th scope="col">{{ i18n.t('storage.colData') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('storage.colEntries') }}</th>
            <th scope="col" class="is-number">{{ i18n.t('storage.colSize') }}</th>
            <th scope="col">
              <span class="shm-visually-hidden">{{ i18n.t('storage.colReset') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in syncedView" :key="row.id">
            <th scope="row">
              <span class="shm-storage-name">{{ name(row.id) }}</span>
              <span class="shm-storage-content">{{ i18n.t(`storage.${row.id}.content`) }}</span>
            </th>
            <td class="is-number">{{ row.count }}</td>
            <td class="is-number">{{ row.size }}</td>
            <td class="is-action">
              <span class="shm-storage-actions">
                <button
                  v-tooltip="i18n.t('storage.synced.deleteOne', [name(row.id)])"
                  type="button"
                  class="shm-button is-danger is-icon"
                  :disabled="row.empty"
                  @click="deleteSynced(row.id)"
                >
                  <SvgIcon name="trash" />
                </button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Its use against the limits of the synced storage, like the storage of a device. -->
    <div v-if="syncedQuota" class="shm-storage-quota">
      <span
        class="shm-storage-meter"
        :class="{ 'is-near': syncedQuota.near }"
        role="meter"
        :aria-label="i18n.t('storage.synced.meterLabel')"
        aria-valuemin="0"
        :aria-valuemax="SYNC_QUOTA.total"
        :aria-valuenow="syncedQuota.bytes"
        :aria-valuetext="syncedQuota.used"
      >
        <span
          class="shm-storage-meter-fill"
          :style="{ transform: `scaleX(${syncedQuota.fraction})` }"
        ></span>
      </span>
      <span class="shm-storage-quota-text">
        <span>{{ syncedQuota.used }}</span>
        <span>{{ syncedQuota.items }}</span>
      </span>
      <p v-for="warning in syncedQuota.warnings" :key="warning" class="shm-storage-warning">
        <SvgIcon name="triangle-exclamation" />
        <span>{{ warning }}</span>
      </p>
    </div>
    <template #after>
      <p v-if="syncedDone" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t('storage.synced.deleted', [name(syncedDone)]) }}
      </p>
    </template>
  </SettingsGroup>
  <ResetSection />
</template>

<style scoped>
/*
 * The table follows its texts (#371): column heads wrap, numbers, sizes and times stay on one line.
 * In a narrow panel (a small window, long German or French heads) the two times move below the
 * name, so the table fits without scrolling sideways; it only scrolls if even that doesn't fit.
 */
.shm-storage-scroll {
  overflow-x: auto;
  container-type: inline-size;
}

.shm-storage-table {
  width: 100%;
  border-collapse: collapse;
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-storage-table th,
.shm-storage-table td {
  padding: 8px 10px 8px 0;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

.shm-storage-table thead th {
  color: var(--shm-text-muted);
  font-weight: 400;
  vertical-align: bottom;
  white-space: normal;
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

.shm-storage-table :is(th, td):first-child {
  padding-left: 16px;
}

.shm-storage-table .is-action {
  width: 1%;
  padding-right: 12px;
  vertical-align: middle;
}

.shm-storage-actions {
  display: inline-flex;
  gap: 6px;
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

.shm-storage-times {
  display: none;
  margin-top: 4px;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-storage-times > span {
  display: block;
}

/* "il y a 4 jours", "cette minute-ci": a time stays on one line, like in its column. */
.shm-storage-time {
  white-space: nowrap;
}

@container (width < 540px) {
  .shm-storage-table .is-time {
    display: none;
  }

  .shm-storage-times {
    display: block;
  }
}

/* The use of the synced storage (#560): a bar like a device's storage, its numbers beside it. */
.shm-storage-quota {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 10px 12px 12px 16px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.1);
}

.shm-storage-meter {
  position: relative;
  flex: 1 1 160px;
  height: 6px;
  overflow: hidden;
  background: rgb(var(--shm-accent-rgb) / 0.15);
}

/* Square in "Classic RSI", rounded in "Modern Hangar" like the planner's countdown bar. */
html .shm-theme-modern .shm-storage-meter {
  border-radius: 3px;
}

.shm-storage-meter-fill {
  position: absolute;
  inset: 0;
  background: var(--shm-accent);
  transform-origin: left;
}

.shm-storage-meter.is-near .shm-storage-meter-fill {
  background: var(--shm-warning);
}

.shm-storage-quota-text {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 12px;
}

.shm-storage-quota-text > span {
  white-space: nowrap;
}

.shm-storage-warning {
  display: flex;
  flex-basis: 100%;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  color: var(--shm-warning);
}

.shm-storage-warning .shm-icon {
  flex: none;
  width: 12px;
  height: 12px;
  transform: translateY(1px);
}

.shm-button.is-icon {
  padding: 0 8px;
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
