import { bytesOf, SYNC_QUOTA } from '@/watchlists/watchlists-storage';

/*
 * What the user keeps in the browser's synced storage (#560): the watchlists (#465) and the marks
 * to melt (#144), measured as the browsers count them (key and JSON value, `bytesOf`), against the
 * limits of the synced storage (`SYNC_QUOTA`: 100 KB in all, 8 KB per key, 512 keys).
 */

/** The storages kept in the synced storage, as listed in the settings' "Stored data". */
export const SYNCED_IDS = ['watchlists', 'meltMarks'] as const;
export type SyncedId = (typeof SYNCED_IDS)[number];

/** A limit counts as near from this share of it on. */
export const NEAR_LIMIT_SHARE = 0.8;

/** The storage of a key of the synced storage (without the area), or none of these. */
export function syncedIdOf(key: string): SyncedId | undefined {
  if (key === 'watchlists' || key.startsWith('watchlist.')) return 'watchlists';
  if (key === 'hangar.meltMarks') return 'meltMarks';
  return undefined;
}

export interface SyncedRowUsage {
  /** Its entries: watchlists, marks. */
  entries: number;
  bytes: number;
  /** Its largest key, against the limit per key. */
  largestKey: number;
}

export interface SyncedUsage {
  rows: Record<SyncedId, SyncedRowUsage>;
  /** Everything in the synced storage, also the settings. */
  bytes: number;
  keys: number;
}

const entriesOf = (id: SyncedId, key: string, value: unknown): number => {
  if (id === 'meltMarks') return value && typeof value === 'object' ? Object.keys(value).length : 0;
  // A watchlist per key; the index of their order isn't one.
  return key === 'watchlists' ? 0 : 1;
};

/** Measures everything stored in the synced storage (by key without the area). */
export function measureSynced(stored: Readonly<Record<string, unknown>>): SyncedUsage {
  const rows = Object.fromEntries(
    SYNCED_IDS.map((id) => [id, { entries: 0, bytes: 0, largestKey: 0 }]),
  ) as Record<SyncedId, SyncedRowUsage>;
  let bytes = 0;
  let keys = 0;
  for (const [key, value] of Object.entries(stored)) {
    const size = bytesOf(key, value);
    bytes += size;
    keys += 1;
    const id = syncedIdOf(key);
    if (!id) continue;
    const row = rows[id];
    row.entries += entriesOf(id, key, value);
    row.bytes += size;
    row.largestKey = Math.max(row.largestKey, size);
  }
  return { rows, bytes, keys };
}

export interface NearLimits {
  /** The 100 KB in all. */
  total: boolean;
  /** The 512 keys. */
  keys: boolean;
  /** The storages with a key near 8 KB. */
  perKey: SyncedId[];
}

/** Which limits the stored data is near (`NEAR_LIMIT_SHARE`). */
export function nearLimits(usage: SyncedUsage): NearLimits {
  const near = (value: number, limit: number) => value >= limit * NEAR_LIMIT_SHARE;
  return {
    total: near(usage.bytes, SYNC_QUOTA.total),
    keys: near(usage.keys, SYNC_QUOTA.maxItems),
    perKey: SYNCED_IDS.filter((id) => near(usage.rows[id].largestKey, SYNC_QUOTA.perItem)),
  };
}
