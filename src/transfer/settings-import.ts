import { STORAGES, type StorageId } from '@/storage/registry';
import { syncedIdOf } from '@/storage/synced-usage';
import {
  encodePlan,
  isCompletedKey,
  isPlanKey,
  saveCompleted,
  savePlan,
} from '@/store/paint-consultant/synced-plans';
import type { AnyStoredRebuyPlan } from '@/store/paint-consultant/rebuy-plan-storage';
import type { CompletedPlansSnapshot } from '@/store/paint-consultant/completed-plans';
import {
  bytesOf,
  isWatchlistKey,
  SYNC_QUOTA,
  watchlistEntries,
} from '@/watchlists/watchlists-storage';
import type { Watchlist } from '@/watchlists/watchlists';
import type { ExportFile } from './export-file';
import { importedValue } from './import-file';
import { SETTINGS_PARTS, storagesOfPart, type SettingsPart } from './settings-export';

/*
 * The import of settings and your data (#230): a file of the export (#229) restores the settings
 * and their decisions (replaced) and the user's own data (replaced here; merged by #634). Most of
 * it goes into the browser's synced storage, so it reaches every device of the browser profile,
 * and it must fit its limits: everything to write is measured together first, and what wouldn't
 * fit is named before anything is written. A write that fails puts back what was there before.
 * The browser notifications' permission belongs to the browser and isn't in the file: an import
 * leaves it as it is.
 */

type Stored = Record<string, unknown>;
export type Values = Partial<Record<StorageId, unknown>>;

const definition = (id: StorageId) => STORAGES.find((storage) => storage.id === id)!;

/** The storages kept in one key of the synced storage each (settings, decisions, marks). */
const isSingleSynced = (id: StorageId) =>
  definition(id).item.key.startsWith('sync:') &&
  id !== 'watchlists' &&
  id !== 'paintPlan' &&
  id !== 'paintHistory';
const syncedKeyOf = (id: StorageId) => definition(id).item.key.slice('sync:'.length);

export interface SettingsImport {
  /** The parts chosen that the file holds. */
  parts: SettingsPart[];
  /** What would be written, by storage, in the current format. */
  values: Values;
  /** Storages of the file that can't be read: left out. */
  invalid: StorageId[];
}

/** What a file of the export would write, for the parts chosen (both by default). */
export function settingsImportOf(
  file: ExportFile,
  parts: readonly SettingsPart[] = SETTINGS_PARTS,
): SettingsImport {
  const chosen = SETTINGS_PARTS.filter(
    (part) => parts.includes(part) && (file.parts ?? SETTINGS_PARTS).includes(part),
  );
  const values: Values = {};
  const invalid: StorageId[] = [];
  for (const { id } of chosen.flatMap(storagesOfPart)) {
    const entry = file.storages[id];
    if (!entry) continue;
    const value = importedValue(id, entry.value);
    if (value === undefined) invalid.push(id);
    else values[id] = value;
  }
  return { parts: chosen, values, invalid };
}

/** A row of the preview: how many entries this browser has now, and how many the file brings. */
export interface ImportPreviewRow {
  id: StorageId;
  here: number;
  file: number;
}

/** The entries of a value, as the settings' "Stored data" counts them. */
export const entriesOf = (id: StorageId, value: unknown): number =>
  value === null || value === undefined ? 0 : (definition(id).count?.(value as never) ?? 1);

export function importPreview(values: Values, here: Values): ImportPreviewRow[] {
  return (Object.keys(values) as StorageId[]).map((id) => ({
    id,
    here: entriesOf(id, here[id]),
    file: entriesOf(id, values[id]),
  }));
}

/** Where an import doesn't fit the synced storage: the storage of a key too big, or the total. */
export type ImportLimit = { storage: StorageId; limit: 'perItem' } | { limit: 'total' | 'items' };

/** An import that doesn't fit the synced storage; nothing was written. */
export class ImportQuotaError extends Error {
  constructor(readonly where: ImportLimit) {
    super(`Import doesn't fit into the synced storage (${where.limit})`);
    this.name = 'ImportQuotaError';
  }
}

/**
 * The synced storage after the import (`stored`: everything there now, by key without the area)
 * – the keys written at once, those removed –, or where it doesn't fit. The running plan is
 * measured as it is written (`encodePlan`); completed plans give way for it and stay in this
 * browser, so they never keep an import out.
 */
export function syncedImport(
  stored: Readonly<Stored>,
  values: Values,
): { writes: Stored; removed: string[] } | ImportLimit {
  const after: Stored = { ...stored };
  const writes: Stored = {};
  const removed: string[] = [];
  for (const id of Object.keys(values) as StorageId[]) {
    if (isSingleSynced(id)) writes[syncedKeyOf(id)] = values[id];
  }
  if ('watchlists' in values) {
    const entries = watchlistEntries(values.watchlists as Watchlist[]);
    for (const key of Object.keys(stored).filter(isWatchlistKey)) {
      if (!(key in entries)) {
        removed.push(key);
        delete after[key];
      }
    }
    Object.assign(writes, entries);
  }
  Object.assign(after, writes);

  // Measured as written: the plan by its own write, the completed plans out of the way.
  const measured = Object.fromEntries(
    Object.entries(after).filter(([key]) => !isCompletedKey(key) && !isPlanKey(key)),
  );
  const written = Object.keys(writes);
  if ('paintPlan' in values) {
    const plan = values.paintPlan as AnyStoredRebuyPlan | null;
    if (plan?.version === 2) {
      measured['consultant.plan'] = encodePlan(plan);
      written.push('consultant.plan');
    }
  } else {
    for (const key of Object.keys(after).filter(isPlanKey)) measured[key] = after[key];
  }
  for (const key of written) {
    if (bytesOf(key, measured[key]) > SYNC_QUOTA.perItem) {
      const owner =
        (Object.keys(values) as StorageId[]).find(
          (id) => isSingleSynced(id) && syncedKeyOf(id) === key,
        ) ?? (syncedIdOf(key) as StorageId);
      return { storage: owner, limit: 'perItem' };
    }
  }
  const entries = Object.entries(measured);
  const total = entries.reduce((sum, [key, value]) => sum + bytesOf(key, value), 0);
  if (total > SYNC_QUOTA.total) return { limit: 'total' };
  if (entries.length > SYNC_QUOTA.maxItems) return { limit: 'items' };
  return { writes, removed };
}

/** The local keys an import may change, to put them back if a write fails. */
const LOCAL_KEYS = [
  'local:notifications',
  'local:store.warbondHistory',
  'local:consultant.plan',
  'local:consultant.history',
] as const;

/**
 * Writes the import, after measuring it against the synced storage's limits (`ImportQuotaError`:
 * nothing written). If a write fails, everything goes back to how it was, and the error is thrown.
 */
export async function writeSettingsImport(values: Values): Promise<void> {
  const sync = browser.storage.sync;
  const before = await sync.get(null);
  const placed = syncedImport(before, values);
  if (!('writes' in placed)) throw new ImportQuotaError(placed);
  const localBefore = await storage.getItems([...LOCAL_KEYS]);
  try {
    if (Object.keys(placed.writes).length) await sync.set(placed.writes);
    if (placed.removed.length) await sync.remove(placed.removed);
    for (const id of Object.keys(values) as StorageId[]) {
      const key = definition(id).item.key;
      if (key.startsWith('local:') && id !== 'paintPlan' && id !== 'paintHistory') {
        await storage.setItem(key as `local:${string}`, values[id]);
      }
    }
    if ('paintHistory' in values) {
      await saveCompleted((values.paintHistory as CompletedPlansSnapshot).plans);
    }
    if ('paintPlan' in values) await savePlan(values.paintPlan as AnyStoredRebuyPlan | null);
  } catch (error) {
    const after = await sync.get(null);
    const added = Object.keys(after).filter((key) => !(key in before));
    if (added.length) await sync.remove(added);
    await sync.set(before);
    for (const { key, value } of localBefore) {
      if (value === null) await storage.removeItem(key as `local:${string}`);
      else await storage.setItem(key as `local:${string}`, value);
    }
    throw error;
  }
}

/** What this browser has now of the storages of the import, for its preview. */
export async function currentValues(ids: readonly StorageId[]): Promise<Values> {
  const values = await Promise.all(ids.map((id) => definition(id).item.getValue()));
  return Object.fromEntries(ids.map((id, index) => [id, values[index]]));
}
