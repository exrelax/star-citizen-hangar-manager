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
    // smart update state. Times a check recorded without them are filled in from the data.
    const data = await storage.getItem<LegacyStamps>(key);
    if (!data) continue;
    const existing = await storage.getItem<StorageMeta>(meta.key);
    if (existing?.syncedAt) continue;
    const time = (iso?: string) => (iso ? Date.parse(iso) || 0 : 0);
    const seeded: StorageMeta = {
      ...EMPTY_META,
      checkedAt: check?.lastCheckAt ?? time(data.syncedAt),
      lastOutcome: check?.lastOutcome ?? null,
      ...existing,
      syncedAt: time(data.syncedAt),
      updatedAt: existing?.updatedAt || time(data.updatedAt ?? data.syncedAt),
    };
    if (check?.cursor !== undefined && existing?.cursor === undefined) seeded.cursor = check.cursor;
    // Nothing to fill in: no write on every start.
    if (existing && !seeded.syncedAt) continue;
    await meta.setValue(seeded);
  }
}
