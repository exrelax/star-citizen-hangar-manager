import { SYNC_CONCURRENCY } from '@/config';
import { mapWithConcurrency } from '@/shared/lib/pool';
import { hangarSnapshot } from './hangar-storage';
import { parsePledgePage, type PledgePage } from './parse-pledges';
import {
  HANGAR_SNAPSHOT_VERSION,
  PLEDGE_CATEGORIES,
  type HangarSnapshot,
  type Pledge,
  type PledgeCategory,
} from './pledge';
import { fetchShipMatrixImages, resolveUpgradeImages, type ShipImages } from './ship-images';
import { resolveShipLinks, type ShipLinks } from './ship-links';

export interface SyncProgress {
  done: number;
  total: number;
}

/** Fetches one page of the hangar, optionally limited to an RSI product category. */
export type FetchPledgePage = (page: number, category?: PledgeCategory) => Promise<PledgePage>;

export interface SyncOptions {
  fetchPage?: FetchPledgePage;
  fetchShipImages?: () => Promise<ShipImages>;
  fetchShipLinks?: (pledges: Pledge[], previous: ShipLinks | undefined) => Promise<ShipLinks>;
  onProgress?: (progress: SyncProgress) => void;
  concurrency?: number;
}

/**
 * Reads all pages of the hangar and stores them as a new snapshot. Nothing is stored unless every
 * page was read successfully, so a failed sync keeps the previous snapshot.
 *
 * Besides the full list, the pages of RSI's own product categories (game packages, standalone
 * ships) are read to tag the pledges with their category.
 */
export async function syncHangar(options: SyncOptions = {}): Promise<HangarSnapshot> {
  const {
    fetchPage = fetchPledgePage,
    fetchShipImages = fetchShipMatrixImages,
    fetchShipLinks = resolveShipLinks,
    onProgress,
    concurrency = SYNC_CONCURRENCY,
  } = options;

  // Only needed for CCU images – loads alongside the pages, and a failure just means fewer images.
  const shipImages = fetchShipImages().catch((error: unknown) => {
    console.warn('[sc-hangar-manager] Ship matrix unavailable, CCU images may be missing', error);
    return new Map() as ShipImages;
  });

  // The first page of each list tells how many pages there are in total.
  const lists: (PledgeCategory | undefined)[] = [undefined, ...PLEDGE_CATEGORIES];
  const firstPages = await Promise.all(lists.map((category) => fetchPage(1, category)));
  const total = firstPages.reduce((sum, page) => sum + page.lastPage, 0);
  let done = firstPages.length;
  onProgress?.({ done, total });

  const remaining = lists.flatMap((category, index) =>
    Array.from({ length: firstPages[index]!.lastPage - 1 }, (_, page) => ({
      category,
      page: page + 2,
    })),
  );
  const rest = await mapWithConcurrency(remaining, concurrency, async ({ category, page }) => {
    const result = await fetchPage(page, category);
    onProgress?.({ done: ++done, total });
    return { category, result };
  });

  const pagesOf = (category: PledgeCategory | undefined) => [
    firstPages[lists.indexOf(category)]!,
    ...rest.filter((entry) => entry.category === category).map((entry) => entry.result),
  ];

  // Pledges can move between pages while syncing – keep each one once, in hangar order.
  const pledges = new Map<number, Pledge>();
  for (const page of pagesOf(undefined)) {
    for (const pledge of page.pledges) {
      if (!pledges.has(pledge.id)) pledges.set(pledge.id, pledge);
    }
  }
  for (const category of PLEDGE_CATEGORIES) {
    for (const page of pagesOf(category)) {
      for (const { id } of page.pledges) {
        const pledge = pledges.get(id);
        if (pledge) pledge.category = category;
      }
    }
  }

  const allPledges = [...pledges.values()];
  resolveUpgradeImages(allPledges, await shipImages);

  // Links are optional as well: without Fleetyards the hangar is still stored, just without them.
  const previousLinks = (await hangarSnapshot.getValue())?.shipLinks;
  const shipLinks = await fetchShipLinks(allPledges, previousLinks).catch((error: unknown) => {
    console.warn('[sc-hangar-manager] Fleetyards unavailable, ship links may be missing', error);
    return previousLinks ?? {};
  });

  const snapshot: HangarSnapshot = {
    version: HANGAR_SNAPSHOT_VERSION,
    syncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pledges: allPledges,
    shipLinks,
  };
  await hangarSnapshot.setValue(snapshot);
  return snapshot;
}

/** Fetches a hangar page with the user's session. The English variant keeps dates parseable. */
export const fetchPledgePage: FetchPledgePage = async (page, category) => {
  const filter = category ? `&product-type=${category}` : '';
  const response = await fetch(`/en/account/pledges?page=${page}${filter}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Loading hangar page ${page} failed: HTTP ${response.status}`);

  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  // Logged out sessions get the login page instead of the account pages. (An empty category has
  // no pledge list, so the account navigation is the safer sign of being logged in.)
  if (!doc.querySelector('.sidenav a[href$="/account/pledges"]')) {
    throw new Error(`Hangar page ${page} is no account page – are you still logged in?`);
  }
  return parsePledgePage(doc);
};
