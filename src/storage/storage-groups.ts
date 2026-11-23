import { STORAGES, type StorageDefinition, type StorageId } from './registry';
import type { StorageGroupId } from './storage-group-ids';

/*
 * The storages of the settings' "Stored data" in groups by where their data comes from (#624):
 * RSI's account pages, RSI's public Pledge Store and ships, the project website, this browser, and
 * the synced storage of the browser profile (#560). Each registry entry names its group; the
 * settings stay out of them. The groups are also the scope of a later export and import (#232):
 * those that can't be read again are what an export must hold.
 */

export { isStorageGroup, STORAGE_GROUPS, type StorageGroupId } from './storage-group-ids';

/** The storages of a group, in the registry's order. */
export const storagesOf = (group: StorageGroupId): StorageDefinition[] =>
  STORAGES.filter((storage) => storage.group === group);

/** Whether a group's data can be read again (from RSI or the website) after it was deleted. */
export const canReadAgain = (group: StorageGroupId): boolean =>
  storagesOf(group).some((storage) => storage.readAgain !== 'never');

/**
 * What deleting a whole group means, for its question: read again later, gone for good, or gone
 * for good on every device of the browser profile (#560).
 */
export const deleteKindOf = (group: StorageGroupId): 'readAgain' | 'never' | 'synced' =>
  group === 'synced' ? 'synced' : canReadAgain(group) ? 'readAgain' : 'never';

/** What a row of a group adds to its sums; `undefined` while nothing is stored. */
export interface StorageFigures {
  id: StorageId;
  entries?: number;
  bytes?: number;
  /** Its last check (ms), 0 for none. */
  checkedAt?: number;
}

export interface GroupSums {
  storages: number;
  entries: number;
  bytes: number;
  /** The oldest last check of its storages that were checked, `undefined` without one. */
  oldestCheck?: number;
  /** Nothing of it is stored. */
  empty: boolean;
}

/** The sums of a group's rows: entries, size and the oldest last check. */
export function groupSums(rows: readonly StorageFigures[]): GroupSums {
  const checks = rows.map((row) => row.checkedAt ?? 0).filter((at) => at > 0);
  return {
    storages: rows.length,
    entries: rows.reduce((sum, row) => sum + (row.entries ?? 0), 0),
    bytes: rows.reduce((sum, row) => sum + (row.bytes ?? 0), 0),
    oldestCheck: checks.length ? Math.min(...checks) : undefined,
    empty: rows.every((row) => !row.entries && !row.bytes),
  };
}

/** The storages RSI's upgrade tool fills with one read. */
const UPGRADE_TOOL: readonly StorageId[] = ['ships', 'shipsBuyable', 'shipsWarbonds'];

/**
 * The storages a group's "Refresh" reads, one after the other: those that can be read again; the
 * upgrade tool's three only once, as its first reads all of them.
 */
export function refreshOrder(ids: readonly StorageId[]): StorageId[] {
  const upgradeTool = (id: StorageId) => UPGRADE_TOOL.includes(id);
  let toolRead = false;
  return ids.filter((id) => {
    if (!upgradeTool(id)) return true;
    if (toolRead) return false;
    toolRead = true;
    return true;
  });
}
