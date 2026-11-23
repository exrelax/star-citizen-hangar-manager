<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import SegmentedControl from '@/shared/components/SegmentedControl.vue';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import type { StorageId } from '@/storage/registry';
import { useSyncedUsage } from '@/storage/use-synced-usage';
import { SYNC_QUOTA } from '@/watchlists/watchlists-storage';
import {
  exportHangar,
  exportSettings,
  HANGAR_FORMATS,
  readChosenFile,
  type HangarFormat,
} from '@/transfer/transfer-actions';
import { readExportFile } from '@/transfer/import-file';
import { importHangar } from '@/transfer/hangar-import';
import {
  currentValues,
  ImportQuotaError,
  settingsImportOf,
  writeSettingsImport,
  type ImportLimit,
  type Values,
} from '@/transfer/settings-import';
import {
  isMergeable,
  mergeStorage,
  plansCollide,
  replaceCounts,
  valuesToWrite,
  type ImportMode,
  type KeepPlan,
  type Mergeable,
  type MergeCounts,
} from '@/transfer/merge';
import { entriesOf } from '@/transfer/settings-import';
import { SETTINGS_PARTS, storagesOfPart, type SettingsPart } from '@/transfer/settings-export';
import { storagesToTransfer } from '@/storage/registry';
import { useDemoContext } from '@/demo/use-demo';
import { currentDemoValues, notImportedInDemo, writeDemoImport } from '@/transfer/demo-transfer';
import { computed, ref, shallowRef } from 'vue';
import type { Settings } from '../settings';
import SettingCheck from '../SettingCheck.vue';
import SettingRow from '../SettingRow.vue';
import SettingsGroup from '../SettingsGroup.vue';

/*
 * Export & Import in the settings (#232), next to "Stored data" (#624): the hangar export in each
 * format (#226–#228) and its restore (#231), the export and import of settings and your data
 * (#229, #230) with the choice of merge or replace per storage (#634). What each export holds is
 * named by the storages of "Stored data". Files are made in this browser only.
 */

const props = defineProps<{ settings: Settings }>();

const name = (id: StorageId) => i18n.t(`storage.${id}.name`);
const names = (ids: readonly StorageId[]) =>
  new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(ids.map(name));

/*
 * The demo mode (#233) never exports or imports the account's data: its exports hold the demo's
 * data only, its imports go into the demo's own data, and the hangar can't be restored.
 */
const demoContext = useDemoContext();
const demo = computed(() => props.settings.demoMode);
const restoreHint = computed(() => (demo.value ? i18n.t('transfer.demoRestore') : undefined));

// ---- The hangar ----

const hangarIds = storagesToTransfer('hangar').map((storage) => storage.id);
const hideIds = ref(props.settings.hidePledgeIds);
const hideAmounts = ref(props.settings.hideMeltValue);
const formatOptions = computed(() =>
  HANGAR_FORMATS.map((value) => ({ value, label: i18n.t(`transfer.formats.${value}`) })),
);
const format = ref<HangarFormat>('json');
const hangarMessage = ref<string>();

async function saveHangar() {
  if (demo.value && !demoContext.value) return;
  const { unmatched } = await exportHangar(
    format.value,
    { hideIds: hideIds.value, hideAmounts: hideAmounts.value },
    demo.value ? demoContext.value : null,
  );
  hangarMessage.value = unmatched.length
    ? i18n.t('transfer.unmatched', [unmatched.join(', ')])
    : i18n.t('transfer.exported');
}

const hangarInput = ref<HTMLInputElement>();
async function restoreHangar(event: Event) {
  const chosen = (event.target as HTMLInputElement).files?.[0];
  (event.target as HTMLInputElement).value = '';
  if (!chosen || demo.value) return;
  const read = readExportFile(await readChosenFile(chosen), 'hangar');
  if (!read.ok) {
    hangarMessage.value = i18n.t(`transfer.errors.${read.error}`);
    return;
  }
  const result = await importHangar(read.file);
  hangarMessage.value = result.ok
    ? i18n.t('transfer.restored', [names(Object.keys(result.writes) as StorageId[])])
    : i18n.t(`transfer.refusals.${result.refusal}`);
}

// ---- Settings and your data ----

const parts = ref<SettingsPart[]>([...SETTINGS_PARTS]);
const togglePart = (part: SettingsPart, on: boolean) =>
  (parts.value = SETTINGS_PARTS.filter((other) =>
    other === part ? on : parts.value.includes(other),
  ));
const partIds = (part: SettingsPart) => storagesOfPart(part).map((storage) => storage.id);
const settingsMessage = ref<string>();

async function saveSettings() {
  if (!parts.value.length) return;
  await exportSettings(parts.value, demo.value);
  settingsMessage.value = i18n.t('transfer.exported');
}

/** The import read from a file, waiting for the user to confirm it. */
interface Pending {
  fileValues: Values;
  here: Values;
  invalid: StorageId[];
  ignored: string[];
  /** In the demo: what it has no copy of, left out. */
  notInDemo: StorageId[];
}
const pending = shallowRef<Pending>();
const modes = ref<Partial<Record<Mergeable, ImportMode>>>({});
const keepPlan = ref<KeepPlan>('here');
const settingsInput = ref<HTMLInputElement>();

async function readSettings(event: Event) {
  const chosen = (event.target as HTMLInputElement).files?.[0];
  (event.target as HTMLInputElement).value = '';
  if (!chosen) return;
  const read = readExportFile(await readChosenFile(chosen), 'settings');
  if (!read.ok) {
    settingsMessage.value = i18n.t(`transfer.errors.${read.error}`);
    return;
  }
  const { values: all, invalid } = settingsImportOf(read.file);
  const notInDemo = demo.value ? notImportedInDemo(Object.keys(all) as StorageId[]) : [];
  const values = Object.fromEntries(
    Object.entries(all).filter(([id]) => !notInDemo.includes(id as StorageId)),
  ) as Values;
  const ids = Object.keys(values) as StorageId[];
  if (!ids.length) {
    settingsMessage.value = i18n.t('transfer.refusals.empty');
    return;
  }
  modes.value = {};
  keepPlan.value = 'here';
  settingsMessage.value = undefined;
  pending.value = {
    fileValues: values,
    here: demo.value ? await currentDemoValues(ids) : await currentValues(ids),
    invalid,
    ignored: read.ignored,
    notInDemo,
  };
}

const modeOptions = computed(() => [
  { value: 'merge' as const, label: i18n.t('transfer.merge') },
  { value: 'replace' as const, label: i18n.t('transfer.replace') },
]);
const planOptions = computed(() => [
  { value: 'here' as const, label: i18n.t('transfer.keepHere') },
  { value: 'file' as const, label: i18n.t('transfer.keepFile') },
]);

/** A row of the preview per storage: what the import does to it. */
const preview = computed(() => {
  const value = pending.value;
  if (!value) return [];
  return (Object.keys(value.fileValues) as StorageId[]).map((id) => {
    const here = value.here[id] ?? null;
    const file = value.fileValues[id];
    const mode = isMergeable(id) ? (modes.value[id] ?? 'merge') : 'replace';
    const counts: MergeCounts =
      mode === 'merge' && isMergeable(id)
        ? mergeStorage(id, here, file, keepPlan.value).counts
        : replaceCounts(entriesOf(id, here), entriesOf(id, file));
    return { id, mergeable: isMergeable(id), mode, counts };
  });
});
const collide = computed(
  () =>
    !!pending.value &&
    (modes.value.paintPlan ?? 'merge') === 'merge' &&
    plansCollide(pending.value.here, pending.value.fileValues),
);

const countsText = (counts: MergeCounts) =>
  (['added', 'changed', 'kept', 'leftOut'] as const)
    .filter((key) => counts[key])
    .map((key) => i18n.n(`transfer.counts.${key}`, counts[key]))
    .join(' · ') || i18n.t('transfer.counts.nothing');

const usage = useSyncedUsage(demo);
const kb = (bytes: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 1,
  }).format(bytes / 1000);
const usageText = computed(() =>
  usage.value ? i18n.t('storage.synced.usage', [kb(usage.value.bytes), kb(SYNC_QUOTA.total)]) : '',
);
const imported = ref(false);

function quotaText(where: ImportLimit) {
  return where.limit === 'perItem'
    ? i18n.t('transfer.quota.perItem', [name(where.storage), kb(SYNC_QUOTA.perItem)])
    : i18n.t(`transfer.quota.${where.limit}`);
}

async function confirmImport() {
  const value = pending.value;
  if (!value) return;
  try {
    const values = valuesToWrite(value.fileValues, value.here, modes.value, keepPlan.value);
    if (demo.value) {
      await writeDemoImport(values, demoContext.value?.storage.syncedNearLimit ?? false);
    } else {
      await writeSettingsImport(values);
    }
  } catch (error) {
    settingsMessage.value =
      error instanceof ImportQuotaError ? quotaText(error.where) : i18n.t('transfer.failed');
    return;
  }
  pending.value = undefined;
  imported.value = true;
  settingsMessage.value = i18n.t(demo.value ? 'transfer.importedDemo' : 'transfer.imported');
}

const notExported = computed(() =>
  new Intl.ListFormat(locale.value, { type: 'conjunction' }).format([
    i18n.t('storage.groups.store'),
    i18n.t('storage.groups.website'),
  ]),
);
</script>

<template>
  <p class="shm-settings-intro">{{ i18n.t('transfer.intro') }}</p>

  <SettingsGroup :title="i18n.t('transfer.hangar')" :footer="hangarMessage">
    <SettingRow
      :label="i18n.t('transfer.exportHangar')"
      :hint="i18n.t('transfer.holds', [names(hangarIds)])"
    >
      <span class="shm-transfer-actions">
        <SelectMenu v-model="format" :options="formatOptions" :label="i18n.t('transfer.format')" />
        <button type="button" class="shm-button" @click="saveHangar">
          <SvgIcon name="file-export" />
          {{ i18n.t('transfer.export') }}
        </button>
      </span>
    </SettingRow>
    <SettingCheck
      :checked="hideIds"
      :hint="i18n.t('transfer.hideIdsHint')"
      indented
      @change="hideIds = $event"
    >
      {{ i18n.t('transfer.hideIds') }}
    </SettingCheck>
    <SettingCheck
      :checked="hideAmounts"
      :hint="i18n.t('transfer.hideAmountsHint')"
      indented
      @change="hideAmounts = $event"
    >
      {{ i18n.t('transfer.hideAmounts') }}
    </SettingCheck>
    <SettingRow
      :label="i18n.t('transfer.restoreHangar')"
      :hint="i18n.t('transfer.restoreHangarHint')"
    >
      <button
        v-tooltip="restoreHint"
        type="button"
        class="shm-button"
        :disabled="demo"
        @click="hangarInput?.click()"
      >
        <SvgIcon name="file-import" />
        {{ i18n.t('transfer.chooseFile') }}
      </button>
      <input
        ref="hangarInput"
        type="file"
        accept=".json,application/json"
        hidden
        @change="restoreHangar"
      />
    </SettingRow>
  </SettingsGroup>

  <SettingsGroup :title="i18n.t('transfer.settings')" :footer="settingsMessage">
    <SettingRow :label="i18n.t('transfer.exportSettings')" :hint="i18n.t('transfer.syncedHint')">
      <button type="button" class="shm-button" :disabled="!parts.length" @click="saveSettings">
        <SvgIcon name="file-export" />
        {{ i18n.t('transfer.export') }}
      </button>
    </SettingRow>
    <SettingCheck
      v-for="part in SETTINGS_PARTS"
      :key="part"
      :checked="parts.includes(part)"
      :hint="names(partIds(part))"
      indented
      @change="togglePart(part, $event)"
    >
      {{ i18n.t(`transfer.parts.${part}`) }}
    </SettingCheck>
    <SettingRow
      :label="i18n.t('transfer.importSettings')"
      :hint="i18n.t('transfer.importSettingsHint')"
    >
      <button type="button" class="shm-button" @click="settingsInput?.click()">
        <SvgIcon name="file-import" />
        {{ i18n.t('transfer.chooseFile') }}
      </button>
      <input
        ref="settingsInput"
        type="file"
        accept=".json,application/json"
        hidden
        @change="readSettings"
      />
      <template v-if="pending" #below>
        <div class="shm-transfer-preview" role="region" :aria-label="i18n.t('transfer.preview')">
          <p class="shm-hint">
            {{ i18n.t(demo ? 'transfer.syncedNoteDemo' : 'transfer.syncedNote') }}
          </p>
          <ul class="shm-transfer-rows">
            <li v-for="row in preview" :key="row.id" class="shm-transfer-row">
              <span class="shm-transfer-name">{{ name(row.id) }}</span>
              <SegmentedControl
                v-if="row.mergeable"
                :model-value="row.mode"
                :options="modeOptions"
                :label="name(row.id)"
                @update:model-value="modes = { ...modes, [row.id]: $event }"
              />
              <span v-else class="shm-hint">{{ i18n.t('transfer.replaced') }}</span>
              <span class="shm-hint shm-transfer-counts">{{ countsText(row.counts) }}</span>
            </li>
          </ul>
          <SettingRow
            v-if="collide"
            :label="i18n.t('transfer.planToKeep')"
            :hint="i18n.t('transfer.planToKeepHint')"
          >
            <SegmentedControl
              v-model="keepPlan"
              :options="planOptions"
              :label="i18n.t('transfer.planToKeep')"
            />
          </SettingRow>
          <p v-if="pending.invalid.length" class="shm-hint">
            {{ i18n.t('transfer.invalid', [names(pending.invalid)]) }}
          </p>
          <p v-if="pending.notInDemo.length" class="shm-hint">
            {{ i18n.t('transfer.notInDemo', [names(pending.notInDemo)]) }}
          </p>
          <p v-if="pending.ignored.length" class="shm-hint">
            {{ i18n.t('transfer.ignored', [pending.ignored.join(', ')]) }}
          </p>
          <span class="shm-transfer-actions">
            <button type="button" class="shm-button" @click="pending = undefined">
              {{ i18n.t('transfer.cancel') }}
            </button>
            <button type="button" class="shm-button is-prominent" @click="confirmImport">
              {{ i18n.t('transfer.import') }}
            </button>
          </span>
        </div>
      </template>
    </SettingRow>
    <template v-if="imported && usageText" #after>
      <p class="shm-settings-group-foot">{{ usageText }}</p>
    </template>
  </SettingsGroup>

  <p class="shm-settings-group-foot">{{ i18n.t('transfer.notExported', [notExported]) }}</p>
</template>

<style scoped>
.shm-transfer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.shm-transfer-preview {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.shm-transfer-rows {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-transfer-row {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) auto;
  gap: 4px 12px;
  align-items: center;
}

.shm-transfer-name {
  color: var(--shm-text);
}

.shm-transfer-counts {
  grid-column: 1 / -1;
  margin: 0;
}
</style>
