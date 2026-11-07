import { EMPTY_META, type CheckOutcome, type StorageMeta } from './meta';
import { STORAGES } from './registry';

/*
 * Moves data stored under the keys of earlier versions to the current keys (see `legacyKeys`,
 * `obsoleteKeys` and `legacyCheckKeys` in the registry). Runs before the manager reads anything;
 * does nothing once done.
 */

/** The smart update state of earlier versions (`hangar.checkState`, `hangar.check`, …). */
interface LegacyCheckState {
  lastCheckAt?: number;
  cursor?: number;
  lastOutcome?: CheckOutcome | null;
}

/** Timestamps the data of earlier versions carried itself. */
interface LegacyStamps {
  syncedAt?: string;
  updatedAt?: string;
}

let migration: Promise<void> | undefined;

/** Migrates once per page; later calls wait for the first one. */
export function migrateStorage(): Promise<void> {
  migration ??= runMigration();
  return migration;
}

export async function runMigration(): Promise<void> {
  for (const definition of STORAGES) {
    const { item, meta, legacyKeys = [], obsoleteKeys = [], legacyCheckKeys = [] } = definition;
    const key = item.key as `local:${string}`;
    for (const legacyKey of legacyKeys) {
      const value = await storage.getItem(legacyKey);
      if (value === null) continue;
      // Data a newer version already stored wins.
      if ((await storage.getItem(key)) === null) await storage.setItem(key, value);
      await storage.removeItem(legacyKey);
    }
    if (obsoleteKeys.length) await storage.removeItems(obsoleteKeys);

    if (!meta) continue;
    let check: LegacyCheckState | null = null;
    for (const legacyKey of legacyCheckKeys) {
      check ??= await storage.getItem<LegacyCheckState>(legacyKey);
      await storage.removeItem(legacyKey);
    }
    // Metadata of data stored before it existed: from the data's own timestamps and the old
    // smart update state.
    if ((await storage.getItem(meta.key)) !== null) continue;
    const data = await storage.getItem<LegacyStamps>(key);
    if (!data) continue;
    const time = (iso?: string) => (iso ? Date.parse(iso) || 0 : 0);
    const seeded: StorageMeta = {
      ...EMPTY_META,
      syncedAt: time(data.syncedAt),
      updatedAt: time(data.updatedAt ?? data.syncedAt),
      checkedAt: check?.lastCheckAt ?? time(data.syncedAt),
      lastOutcome: check?.lastOutcome ?? null,
    };
    if (check?.cursor !== undefined) seeded.cursor = check.cursor;
    await meta.setValue(seeded);
  }
}
