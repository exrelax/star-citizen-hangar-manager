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
import {
  canReadAgain,
  deleteKindOf,
  groupSums,
  refreshOrder,
  STORAGE_GROUPS,
  storagesOf,
  type StorageGroupId,
} from '@/storage/storage-groups';
import { useSettings } from '@/settings/use-settings';
import { nearLimits, type SyncedId, type SyncedUsage } from '@/storage/synced-usage';
import { useSyncedUsage } from '@/storage/use-synced-usage';
import { clearWatchlists, SYNC_QUOTA } from '@/watchlists/watchlists-storage';
import { demoMeltMarksItem, meltMarksItem } from '@/hangar/melt-marks';
import { useStored } from '@/storage/use-stored';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useDemoContext } from '@/demo/use-demo';

/*
 * What the extension keeps in this browser, one row per storage (see `storage/registry.ts`):
 * entries, size, last full sync and last check – and, for each on its own, a refresh and a reset –,
 * and what the user keeps in the synced storage (#560), with its use against the limits. The rows
 * in groups by where their data comes from (#624), each with its sums, collapsed by default.
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
      entries: definition.count?.(stored as never) ?? 0,
      bytes: bytes(stored) + bytes(meta.value),
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
      const demoBytes = demoCount * (DEMO_BYTES[id] ?? 200);
      return {
        definition,
        empty: demoCount === 0,
        entries: demoCount,
        bytes: demoBytes,
        count: numbers.value.format(demoCount),
        size: formatSize(demoBytes),
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
      entries: amount?.entries,
      bytes: amount?.bytes,
      count: amount ? numbers.value.format(amount.entries) : '–',
      size: amount ? formatSize(amount.bytes) : '–',
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
      entries: row?.entries,
      bytes: row?.bytes,
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
  await removeSynced(id);
  syncedDone.value = id;
}
async function removeSynced(id: StorageId) {
  const isDemo = !!demo.value;
  if (id === 'watchlists') await clearWatchlists(isDemo);
  else await (isDemo ? demoMeltMarksItem : meltMarksItem).removeValue();
}

/*
 * The groups (#624): each with its rows, the sum of their entries and sizes and the oldest last
 * check; open as remembered in the display settings.
 */
const { settings, update } = useSettings();
const isOpen = (group: StorageGroupId) => settings.value.storageGroupsOpen.includes(group);
function toggleGroup(group: StorageGroupId) {
  const open = settings.value.storageGroupsOpen;
  void update({
    storageGroupsOpen: open.includes(group)
      ? open.filter((other) => other !== group)
      : STORAGE_GROUPS.filter((other) => other === group || open.includes(other)),
  });
}

const groups = computed(() =>
  STORAGE_GROUPS.map((id) => {
    const ids = storagesOf(id).map((storage) => storage.id);
    const local = view.value.filter((row) => ids.includes(row.definition.id));
    const synced = syncedView.value.filter((row) => ids.includes(row.id));
    const sums = groupSums([
      ...local.map((row) => ({
        id: row.definition.id,
        entries: row.entries,
        bytes: row.bytes,
        checkedAt: row.checkedAt,
      })),
      ...synced.map((row) => ({ id: row.id, entries: row.entries, bytes: row.bytes })),
    ]);
    return {
      id,
      ids,
      local,
      synced,
      sums,
      size: sums.bytes ? (id === 'synced' ? formatSyncedSize : formatSize)(sums.bytes) : '–',
      readable: canReadAgain(id),
    };
  }),
);
const groupName = (group: StorageGroupId) =>
  group === 'synced' ? i18n.t('storage.synced.title') : i18n.t(`storage.groups.${group}`);

/*
 * In the demo mode a group refreshes and deletes only what isn't the account's: the public data,
 * and the demo's own synced data – never what can't be read again from this browser.
 */
const demoSafe = (id: StorageId) =>
  !masked(id) &&
  (!demo.value ||
    SYNCED.some((storage) => storage.id === id) ||
    storagesOf('browser').every((storage) => storage.id !== id));
const refreshable = (group: StorageGroupId) =>
  refreshOrder(
    storagesOf(group)
      .filter((storage) => storage.readAgain !== 'never' && demoSafe(storage.id))
      .map((storage) => storage.id),
  );
const deletable = (group: StorageGroupId) =>
  storagesOf(group).filter((storage) => demoSafe(storage.id));

/** The group read again right now, one storage after the other with the progress of each. */
const refreshingGroup = ref<StorageGroupId>();
async function refreshGroup(group: StorageGroupId) {
  refreshingGroup.value = group;
  try {
    for (const id of refreshable(group)) await startStorageSync(id);
  } finally {
    refreshingGroup.value = undefined;
  }
}

/** Deletes every storage of the group, after a question that names them and what it means. */
async function deleteGroup(group: StorageGroupId) {
  const storages = deletable(group);
  if (!storages.length) return;
  const names = new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
    storages.map((storage) => name(storage.id)),
  );
  const consequence = i18n.t(
    (
      {
        synced: 'storage.group.deleteSynced',
        readAgain: 'storage.group.deleteReadAgain',
        never: 'storage.group.deleteNever',
      } as const
    )[deleteKindOf(group)],
  );
  if (!confirm(i18n.t('storage.group.deleteConfirm', [groupName(group), names, consequence]))) {
    return;
  }
  for (const storage of storages) {
    if (storage.kind === 'synced') await removeSynced(storage.id);
    else await clearStorage(storage);
  }
  groupDone.value = group;
}
/** The group deleted last, shown below the table until the next delete. */
const groupDone = ref<StorageGroupId>();
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
        <!-- A group (#624): its sums in one row, its storages' rows below it when open. -->
        <tbody
          v-for="group in groups"
          :key="group.id"
          class="shm-storage-group"
          :class="{ 'is-open': isOpen(group.id) }"
        >
          <tr class="shm-storage-group-row">
            <th scope="rowgroup">
              <button
                type="button"
                class="shm-storage-disclosure"
                :aria-expanded="isOpen(group.id)"
                @click="toggleGroup(group.id)"
              >
                <SvgIcon name="chevron-right" class="shm-storage-chevron" />
                <span class="shm-storage-name">{{ groupName(group.id) }}</span>
              </button>
              <span class="shm-storage-content">
                {{ i18n.n('storage.group.count', group.sums.storages, [group.sums.storages]) }}
                <span
                  v-if="group.id === 'synced' && syncedQuota?.warnings.length"
                  v-tooltip="syncedQuota.warnings.join(' ')"
                  class="shm-storage-group-warning"
                  :aria-label="syncedQuota.warnings.join(' ')"
                >
                  <SvgIcon name="triangle-exclamation" />
                </span>
              </span>
              <span v-if="group.sums.oldestCheck" class="shm-storage-times">
                <span
                  >{{ i18n.t('storage.colChecked') }}:
                  <span class="shm-storage-time">{{ when(group.sums.oldestCheck) }}</span></span
                >
              </span>
            </th>
            <td class="is-number">
              {{ group.sums.empty ? '–' : numbers.format(group.sums.entries) }}
            </td>
            <td class="is-number">{{ group.size }}</td>
            <td class="is-time"></td>
            <td class="is-time">
              <span
                v-if="group.sums.oldestCheck"
                v-tooltip="
                  i18n.t('storage.group.oldestCheck', [exactly(group.sums.oldestCheck) ?? ''])
                "
                >{{ when(group.sums.oldestCheck) }}</span
              >
            </td>
            <td class="is-action">
              <span class="shm-storage-actions">
                <button
                  v-if="group.readable"
                  v-tooltip="
                    refreshable(group.id).length
                      ? i18n.t('storage.group.refresh', [groupName(group.id)])
                      : i18n.t('storage.demoDisabled')
                  "
                  type="button"
                  class="shm-button is-icon"
                  :disabled="
                    syncState.running || upgradeToolState.loading || !refreshable(group.id).length
                  "
                  :aria-busy="refreshingGroup === group.id"
                  @click="refreshGroup(group.id)"
                >
                  <RefreshIcon :spinning="refreshingGroup === group.id" />
                </button>
                <button
                  v-tooltip="
                    deletable(group.id).length
                      ? i18n.t('storage.group.delete', [groupName(group.id)])
                      : i18n.t('storage.demoDisabled')
                  "
                  type="button"
                  class="shm-button is-danger is-icon"
                  :disabled="group.sums.empty || syncState.running || !deletable(group.id).length"
                  @click="deleteGroup(group.id)"
                >
                  <SvgIcon name="trash" />
                </button>
              </span>
            </td>
          </tr>
          <template v-if="isOpen(group.id)">
            <tr v-for="row in group.local" :key="row.definition.id" class="shm-storage-row">
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
            <!-- What follows the browser profile (#560): no refresh, no times. -->
            <tr v-for="row in group.synced" :key="row.id" class="shm-storage-row">
              <th scope="row">
                <span class="shm-storage-name">{{ name(row.id) }}</span>
                <span class="shm-storage-content">{{ i18n.t(`storage.${row.id}.content`) }}</span>
              </th>
              <td class="is-number">{{ row.count }}</td>
              <td class="is-number">{{ row.size }}</td>
              <td class="is-time">–</td>
              <td class="is-time">–</td>
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
            <!-- Its use against the limits of the synced storage, like the storage of a device. -->
            <tr v-if="group.id === 'synced' && syncedQuota" class="shm-storage-row">
              <td colspan="6" class="shm-storage-quota-cell">
                <div class="shm-storage-quota">
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
                  <p
                    v-for="warning in syncedQuota.warnings"
                    :key="warning"
                    class="shm-storage-warning"
                  >
                    <SvgIcon name="triangle-exclamation" />
                    <span>{{ warning }}</span>
                  </p>
                  <p class="shm-storage-quota-note">{{ i18n.t('storage.synced.footer') }}</p>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <template #after>
      <p v-if="groupDone" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t('storage.resetDone', [groupName(groupDone)]) }}
      </p>
      <p v-else-if="resetDone" class="shm-settings-group-foot is-done" role="status">
        {{ i18n.t('storage.resetDone', [name(resetDone)]) }}
      </p>
      <p v-else-if="syncedDone" class="shm-settings-group-foot is-done" role="status">
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

.shm-storage-table tbody tr + tr > *,
.shm-storage-table tbody + tbody > tr:first-child > * {
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.1);
}

/* A group's row (#624): its name as a disclosure, the rows of its storages indented below it. */
.shm-storage-disclosure {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-storage-disclosure:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: 2px;
}

.shm-storage-group-row .shm-storage-name {
  font-weight: 600;
}

.shm-storage-chevron {
  flex: none;
  width: 10px;
  height: 10px;
  color: var(--shm-text-muted);
  transition: transform 0.15s;
}

.shm-storage-disclosure[aria-expanded='true'] .shm-storage-chevron {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .shm-storage-chevron {
    transition: none;
  }
}

.shm-storage-group-row .shm-storage-content,
.shm-storage-group-row .shm-storage-times {
  padding-left: 16px;
}

.shm-storage-table .shm-storage-row > :first-child {
  padding-left: 32px;
}

.shm-storage-group.is-open .shm-storage-row > * {
  background: rgb(var(--shm-accent-rgb) / 0.03);
}

.shm-storage-group-warning {
  display: inline-flex;
  margin-left: 4px;
  color: var(--shm-warning);
  vertical-align: -1px;
}

.shm-storage-group-warning .shm-icon {
  width: 11px;
  height: 11px;
}

.shm-storage-table .shm-storage-quota-cell {
  padding: 0;
  white-space: normal;
}

.shm-storage-quota-note {
  flex-basis: 100%;
  margin: 0;
  font-size: calc(11px * var(--shm-font-scale));
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
  padding: 10px 12px 12px 32px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
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
