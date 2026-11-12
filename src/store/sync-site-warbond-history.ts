import { WARBOND_HISTORY_SITE } from '@/config';
import { createSiteDataSync, fetchSiteFile, type RefreshOptions } from '@/site-data/sync-site-data';
import { parseSiteWarbondHistory } from './site-warbond-history';
import type { WarbondSighting } from './warbond-history';
import {
  SITE_WARBOND_HISTORY_VERSION,
  siteWarbondHistoryItem,
  siteWarbondHistoryMeta,
  type SiteWarbondHistorySnapshot,
} from './warbond-history-storage';

/*
 * Keeps the stored earlier warbond offers of the project website current, like every data file
 * of the website (`site-data/sync-site-data.ts`): at most once a day (`WARBOND_HISTORY_SITE`);
 * offline the stored ones stay.
 */

/**
 * The offers of the website's file, checked; throws if it can't be read. The development build
 * reads the file of the working copy (`site/public/data/warbond-history.json`), so entries can be
 * tried before they go live; "Stored data" in the settings reads it again at once.
 */
export async function fetchSiteWarbondHistory(): Promise<WarbondSighting[] | undefined> {
  if (import.meta.env.DEV) {
    const local = await import('../../site/public/data/warbond-history.json');
    return parseSiteWarbondHistory(local.default);
  }
  return parseSiteWarbondHistory(await fetchSiteFile(WARBOND_HISTORY_SITE.url));
}

const refresh = createSiteDataSync({
  name: 'Warbond history of the website',
  item: siteWarbondHistoryItem,
  meta: siteWarbondHistoryMeta,
  version: SITE_WARBOND_HISTORY_VERSION,
  fetch: () => fetchSiteWarbondHistory(),
  toSnapshot: (offers: WarbondSighting[]) => ({ version: SITE_WARBOND_HISTORY_VERSION, offers }),
  fromSnapshot: (snapshot: SiteWarbondHistorySnapshot) => snapshot.offers,
  maxAgeMs: WARBOND_HISTORY_SITE.maxAgeMs,
});

/** Reads the website's earlier warbond offers if due (`force`: in any case). */
export async function maybeRefreshSiteWarbondHistory(
  options: RefreshOptions<WarbondSighting[]> = {},
): Promise<void> {
  await refresh(options);
}
