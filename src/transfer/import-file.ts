import { STORAGES, type StorageId } from '@/storage/registry';
import { withDefaults } from '@/settings/settings';
import { currentPlanOf } from '@/store/paint-consultant/rebuy-plan-storage';
import {
  COMPLETED_PLANS_VERSION,
  decodeCompleted,
  encodeCompleted,
} from '@/store/paint-consultant/synced-plans';
import { WARBOND_HISTORY_VERSION } from '@/store/warbond-history';
import { decodeWatchlist, encodeWatchlist } from '@/watchlists/watchlists-storage';
import type { Watchlist } from '@/watchlists/watchlists';
import type { CompletedPaintPlan } from '@/store/paint-consultant/completed-plans';
import {
  EXPORT_FORMAT,
  EXPORT_SCHEMA_VERSION,
  type ExportFile,
  type ExportKind,
} from './export-file';

/*
 * Reading a file of Export & Import (#230, #231): is it ours, of a version this one reads, and of
 * the kind expected. Each storage of it goes through the same checks as a stored value of an
 * earlier version (`withDefaults`, `currentPlanOf`, the codecs of the synced storage): what can't
 * be read is named and left out, a storage this version doesn't know is ignored and named too.
 */

export type ImportError = 'json' | 'format' | 'schema' | 'kind';

export type ReadFile =
  { ok: true; file: ExportFile; ignored: string[] } | { ok: false; error: ImportError };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const KNOWN = new Set<string>(STORAGES.map((storage) => storage.id));

/** The file's text as one of our files of `kind`, or why not. */
export function readExportFile(text: string, kind: ExportKind): ReadFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!isObject(json) || json.format !== EXPORT_FORMAT || !isObject(json.storages)) {
    return { ok: false, error: 'format' };
  }
  if (typeof json.schemaVersion !== 'number' || json.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: 'schema' };
  }
  if (json.kind !== kind) return { ok: false, error: 'kind' };
  const ignored: string[] = [];
  const storages: ExportFile['storages'] = {};
  for (const [id, entry] of Object.entries(json.storages)) {
    if (!KNOWN.has(id) || !isObject(entry) || typeof entry.version !== 'number') {
      ignored.push(id);
      continue;
    }
    storages[id as StorageId] = { version: entry.version, value: entry.value };
  }
  return { ok: true, file: { ...(json as unknown as ExportFile), storages }, ignored };
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const arrayOf = <T>(value: unknown, isItem: (item: unknown) => item is T): T[] | undefined =>
  Array.isArray(value) ? value.filter(isItem) : undefined;
const isString = (value: unknown): value is string => typeof value === 'string';

/** A watchlist as the synced storage would read it back, or none. */
function checkedWatchlist(value: unknown): Watchlist | undefined {
  if (!isObject(value) || !isString(value.id) || !value.id) return undefined;
  try {
    return decodeWatchlist(value.id, encodeWatchlist(value as unknown as Watchlist));
  } catch {
    return undefined;
  }
}

/** A completed plan as the synced storage would read it back, or none. */
function checkedCompleted(value: unknown): CompletedPaintPlan | undefined {
  try {
    return decodeCompleted(encodeCompleted(value as CompletedPaintPlan));
  } catch {
    return undefined;
  }
}

/**
 * The value of a storage of the file in the current format, or `undefined` if it can't be read.
 * Only for the storages of the export of settings and your data; the hangar has its own (#231).
 */
export function importedValue(id: StorageId, value: unknown): unknown {
  switch (id) {
    case 'settings':
      return isObject(value) ? withDefaults(value) : undefined;
    case 'notifications':
      return arrayOf(
        value,
        (note): note is object =>
          isObject(note) && isString(note.id) && isString(note.text) && isFiniteNumber(note.at),
      );
    case 'dismissedPaints':
    case 'dismissedPriceIncreases':
      return arrayOf(value, isFiniteNumber);
    case 'dismissedPriceAdvisor':
    case 'dismissedShipRemovals':
      return arrayOf(value, isString);
    case 'riskNoteSeen':
    case 'browserHintDismissed':
      return typeof value === 'boolean' ? value : undefined;
    case 'warbondHistory':
      return isObject(value) &&
        value.version === WARBOND_HISTORY_VERSION &&
        Array.isArray(value.sightings)
        ? value
        : undefined;
    case 'meltMarks':
      return isObject(value)
        ? Object.fromEntries(
            Object.entries(value).filter(
              ([pledgeId, at]) => /^\d+$/.test(pledgeId) && isFiniteNumber(at),
            ),
          )
        : undefined;
    case 'watchlists': {
      if (!Array.isArray(value)) return undefined;
      const lists = value.flatMap((list) => checkedWatchlist(list) ?? []);
      const seen = new Set<string>();
      return lists.filter((list) => !seen.has(list.id) && seen.add(list.id));
    }
    case 'paintPlan':
      if (value === null) return null;
      // A plan of the first format is kept as it is; the readers upgrade it.
      return currentPlanOf(value) ? value : undefined;
    case 'paintHistory':
      return isObject(value) &&
        value.version === COMPLETED_PLANS_VERSION &&
        Array.isArray(value.plans)
        ? {
            version: COMPLETED_PLANS_VERSION,
            plans: value.plans.flatMap((plan) => checkedCompleted(plan) ?? []),
          }
        : undefined;
    default:
      return undefined;
  }
}
