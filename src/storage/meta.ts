/*
 * The same metadata for every storage (see `registry.ts`): when its data was last read in full,
 * last changed and last checked, with the check's outcome and a fingerprint to compare with on
 * the next check. It lives in a small key of its own next to the data (`<key>.meta`), so a check
 * that finds nothing new writes a few bytes instead of rewriting thousands of pledges.
 *
 * The data keeps its format version and, for hangar and buy back, the time of its last write:
 * both have to change together with the data, which a second key can't guarantee.
 */

/** Outcome of the last check, shown in the status line. */
export interface CheckOutcome {
  /** Epoch milliseconds. */
  at: number;
  status: 'unchanged' | 'updated' | 'needsFullSync' | 'failed';
  added: number;
  removed: number;
  changed: number;
  /** Pages the check read from RSI, if known. */
  pages?: number;
}

export interface StorageMeta {
  /** Epoch milliseconds of the last full sync (everything read); 0 if there was none. */
  syncedAt: number;
  /** Epoch milliseconds of the last change of the data; 0 if there was none. */
  updatedAt: number;
  /** Epoch milliseconds of the last check (smart update) or full sync; 0 if there was none. */
  checkedAt: number;
  lastOutcome: CheckOutcome | null;
  /**
   * Compared with on the next check: the newest pledge log entry for the orders, a hash of the
   * answer for the data of the upgrade tool. Hangar and buy back compare each pledge instead.
   */
  fingerprint?: string;
  /** Hangar and buy back: rotation of the spot check pages. */
  cursor?: number;
}

export const EMPTY_META: StorageMeta = Object.freeze({
  syncedAt: 0,
  updatedAt: 0,
  checkedAt: 0,
  lastOutcome: null,
});

export type MetaItem = ReturnType<typeof defineMeta>;

/** The metadata item of a storage, `<key>.meta`. */
export function defineMeta(key: `local:${string}`) {
  return storage.defineItem<StorageMeta>(`${key}.meta`, { fallback: EMPTY_META });
}

const NO_CHANGES = { added: 0, removed: 0, changed: 0 };

/** After a full sync: everything was read, which is the most thorough check there is. */
export async function recordSync(
  item: MetaItem,
  {
    at = Date.now(),
    fingerprint,
    updatedAt = at,
  }: { at?: number; fingerprint?: string; updatedAt?: number } = {},
): Promise<StorageMeta> {
  const meta: StorageMeta = {
    ...(await item.getValue()),
    syncedAt: at,
    updatedAt,
    checkedAt: at,
    lastOutcome: { at, status: 'unchanged', ...NO_CHANGES },
  };
  if (fingerprint !== undefined) meta.fingerprint = fingerprint;
  await item.setValue(meta);
  return meta;
}

/** After a check: its outcome; `updated` also moves `updatedAt`. */
export async function recordCheck(
  item: MetaItem,
  outcome: Pick<CheckOutcome, 'status'> & Partial<Omit<CheckOutcome, 'at' | 'status'>>,
  {
    at = Date.now(),
    ...changes
  }: { at?: number } & Pick<StorageMeta, 'fingerprint' | 'cursor'> = {},
): Promise<CheckOutcome> {
  const previous = await item.getValue();
  const lastOutcome = { ...NO_CHANGES, ...outcome, at };
  await item.setValue({
    ...previous,
    ...changes,
    checkedAt: at,
    updatedAt: outcome.status === 'updated' ? at : previous.updatedAt,
    lastOutcome,
  });
  return lastOutcome;
}

/** After a change of the data outside a check, e.g. by an exchange in the manager. */
export async function recordUpdate(item: MetaItem, at = Date.now()): Promise<void> {
  await item.setValue({ ...(await item.getValue()), updatedAt: at });
}

/** A short, stable hash of any JSON value (FNV-1a, 32 bit), e.g. of an answer of RSI. */
export function hashOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
