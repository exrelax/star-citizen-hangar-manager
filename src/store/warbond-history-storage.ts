import { defineMeta } from '@/storage/meta';
import type { WarbondHistorySnapshot, WarbondSighting } from './warbond-history';

/**
 * The warbond offers seen so far (#4, see `warbond-history.ts`), added to by every read of the
 * upgrade tool. Kept in this browser only; it can't be read again from RSI.
 */
export const warbondHistoryItem = storage.defineItem<WarbondHistorySnapshot | null>(
  'local:store.warbondHistory',
  { fallback: null },
);

/**
 * Format version of the stored offers of the website; others are ignored and read again. Version 1
 * (1.1.1) lacks the offers' expected end (#568): still shown, and read again at once (#479).
 */
export const SITE_WARBOND_HISTORY_VERSION = 2;

/** Earlier versions of the stored offers that are still read until the next read replaces them. */
export const SITE_WARBOND_HISTORY_EARLIER_VERSIONS: readonly number[] = [1];

export interface SiteWarbondHistorySnapshot {
  version: number;
  offers: WarbondSighting[];
}

/** The earlier warbond offers of the project website (see `site-warbond-history.ts`), as last read. */
export const siteWarbondHistoryItem = storage.defineItem<SiteWarbondHistorySnapshot | null>(
  'local:store.warbondHistorySite',
  { fallback: null },
);

/** The stored offers of the website, if of the current format; else none. */
export const storedSiteWarbondHistory = (
  snapshot: SiteWarbondHistorySnapshot | null,
): WarbondSighting[] =>
  snapshot &&
  (snapshot.version === SITE_WARBOND_HISTORY_VERSION ||
    SITE_WARBOND_HISTORY_EARLIER_VERSIONS.includes(snapshot.version))
    ? snapshot.offers
    : [];

/** Last read, check and fingerprint of the website's offers (see `storage/meta.ts`). */
export const siteWarbondHistoryMeta = defineMeta('local:store.warbondHistorySite');
