import { extensionVersion } from '@/shared/extension-version';
import type { StorageId } from '@/storage/registry';

/*
 * The files of Export & Import (#1): one format for the hangar export (#226) and the export of
 * settings and your data (#229). Each storage is written as its registry item gives it (#633), with
 * its format version, so an import runs the same checks and migrations as an update. The file is
 * made in the browser only; nothing is sent anywhere. The format is documented in
 * docs/EXPORT-FORMAT.md.
 */

/** Tells our files from others. */
export const EXPORT_FORMAT = 'star-citizen-hangar-manager';

/** Version of the file's frame; the storages carry their own versions. */
export const EXPORT_SCHEMA_VERSION = 1;

/** The two exports: the account's hangar, or the settings with the user's own data. */
export type ExportKind = 'hangar' | 'settings';

/** A storage in the file: its value as the registry item gives it, and the value's format. */
export interface ExportedStorage {
  version: number;
  value: unknown;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  kind: ExportKind;
  /** ISO time of the export. */
  exportedAt: string;
  /** The extension's version that wrote it. */
  extensionVersion: string;
  /**
   * What was left out on purpose, so an import can't take it for the whole account: the ids
   * (pledge and order ids) and the amounts (values, prices, orders, store credit).
   */
  redacted?: ('ids' | 'amounts')[];
  /** Only the pledges shown in My Hangar (search and filters), not the whole hangar. */
  partial?: boolean;
  storages: Partial<Record<StorageId, ExportedStorage>>;
}

/**
 * The format version of a stored value: the snapshots carry their own (`version`), the others
 * are in the first format.
 */
export function versionOf(value: unknown): number {
  const version = (value as { version?: unknown } | null)?.version;
  return typeof version === 'number' && Number.isInteger(version) ? version : 1;
}

/** The frame of a file around its storages. */
export function exportFile(
  kind: ExportKind,
  storages: ExportFile['storages'],
  extras: Pick<ExportFile, 'redacted' | 'partial'> = {},
  now = new Date(),
  version = extensionVersion(),
): ExportFile {
  return {
    format: EXPORT_FORMAT,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    kind,
    exportedAt: now.toISOString(),
    extensionVersion: version,
    ...(extras.redacted?.length && { redacted: extras.redacted }),
    ...(extras.partial && { partial: true }),
    storages,
  };
}

/** A storage's entry for the file; nothing for a storage without data. */
export function exported(value: unknown): ExportedStorage | undefined {
  if (value === null || value === undefined) return undefined;
  return { version: versionOf(value), value };
}

/** e.g. "hangar-manager-hangar-2026-11-23.json". */
export function exportFileName(kind: string, extension: 'json' | 'csv', now = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  return `hangar-manager-${kind}-${day}.${extension}`;
}

/** Saves a file made in the browser, by the browser's own download. */
export function saveFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves an export as JSON. */
export const saveJson = (name: string, file: unknown) =>
  saveFile(name, `${JSON.stringify(file, null, 2)}\n`, 'application/json');
