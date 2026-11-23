import { storagesToTransfer, type StorageId } from '@/storage/registry';
import { exported, exportFile, type ExportFile } from './export-file';

/*
 * The export of settings and your data (#229), e.g. for a backup or another browser: the
 * settings with their decisions (notifications checked off, notes closed) and what the user made,
 * which can't be read again from RSI – the watchlists, the marks to melt, the running and the
 * completed paint plans, the warbond offers this browser saw. Most of it is in the browser's
 * synced storage and follows the browser profile anyway (#560); the file is for a backup, another
 * browser or a profile without sync. Which storages go in says the registry (`transfer`, #633);
 * each as its item gives it, so the synced ones decoded, not in their compact per-key format.
 * Nothing of the account beyond it: no pledges, orders, store credit or gift flags (#226).
 */

/** The two parts of the file; both by default. */
export const SETTINGS_PARTS = ['settings', 'yourData'] as const;
export type SettingsPart = (typeof SETTINGS_PARTS)[number];

/** The storages of a part, in the registry's order. */
export const storagesOfPart = (part: SettingsPart) => storagesToTransfer(part);

/** The values of the storages of these parts, as their registry items give them. */
export async function loadSettingsData(
  parts: readonly SettingsPart[] = SETTINGS_PARTS,
): Promise<Partial<Record<StorageId, unknown>>> {
  const storages = parts.flatMap(storagesOfPart);
  const values = await Promise.all(storages.map((storage) => storage.item.getValue()));
  return Object.fromEntries(storages.map((storage, index) => [storage.id, values[index]]));
}

/** The file of the export of settings and your data. */
export function buildSettingsExport(
  values: Partial<Record<StorageId, unknown>>,
  parts: readonly SettingsPart[] = SETTINGS_PARTS,
  now = new Date(),
  version?: string,
): ExportFile {
  const ids = parts.flatMap(storagesOfPart).map((storage) => storage.id);
  const storages = Object.fromEntries(
    ids.flatMap((id) => {
      const entry = exported(values[id]);
      return entry ? [[id, entry] as const] : [];
    }),
  );
  return {
    ...exportFile('settings', storages, {}, now, version),
    parts: SETTINGS_PARTS.filter((part) => parts.includes(part)),
  };
}
