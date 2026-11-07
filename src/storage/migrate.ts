import { STORAGES } from './registry';

/*
 * Moves data stored under the keys of earlier versions to the current keys (see `legacyKeys` and
 * `obsoleteKeys` in the registry). Runs before the manager reads anything; does nothing once done.
 */

let migration: Promise<void> | undefined;

/** Migrates once per page; later calls wait for the first one. */
export function migrateStorage(): Promise<void> {
  migration ??= runMigration();
  return migration;
}

export async function runMigration(): Promise<void> {
  for (const { item, legacyKeys = [], obsoleteKeys = [] } of STORAGES) {
    for (const legacyKey of legacyKeys) {
      const value = await storage.getItem(legacyKey);
      if (value === null) continue;
      // Data a newer version already stored wins.
      if ((await storage.getItem(item.key as `local:${string}`)) === null) {
        await storage.setItem(item.key as `local:${string}`, value);
      }
      await storage.removeItem(legacyKey);
    }
    if (obsoleteKeys.length) await storage.removeItems(obsoleteKeys);
  }
}
