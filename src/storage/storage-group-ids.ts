/*
 * The groups of the settings' "Stored data" (#624), in their order – apart from the registry, so
 * the settings can check the open groups without importing the storages.
 */

export const STORAGE_GROUPS = ['account', 'store', 'website', 'browser', 'synced'] as const;
export type StorageGroupId = (typeof STORAGE_GROUPS)[number];

export const isStorageGroup = (value: unknown): value is StorageGroupId =>
  STORAGE_GROUPS.includes(value as StorageGroupId);
