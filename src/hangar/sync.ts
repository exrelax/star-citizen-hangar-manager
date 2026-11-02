import { HANGAR_PAGE_SIZE, SYNC_WORK } from '@/config';
import { hangarSnapshot } from './hangar-storage';
import { prepareListPages } from './list-pages';
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
import type { SyncProgressTracker } from './sync-progress';

/** Fetches one page of the hangar, optionally limited to an RSI product category. */
export type FetchPledgePage = (page: number, category?: PledgeCategory) => Promise<PledgePage>;

export interface SyncOptions {
  fetchPage?: FetchPledgePage;
  fetchShipImages?: () => Promise<ShipImages>;
  fetchShipLinks?: (pledges: Pledge[], previous: ShipLinks | undefined) => Promise<ShipLinks>;
  /** Hears about the pages, announced as soon as their number is known. */
  progress?: SyncProgressTracker;
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
  const run = await prepareHangarSync(options);
  return run();
}

/**
 * First step of `syncHangar`: reads the first pages, which tell how many pages there are, and
 * announces them to `options.progress`. The returned function does the rest.
 */
export async function prepareHangarSync(
  options: SyncOptions = {},
): Promise<() => Promise<HangarSnapshot>> {
  const {
    fetchPage = fetchPledgePage,
    fetchShipImages = fetchShipMatrixImages,
    fetchShipLinks = resolveShipLinks,
    progress,
    concurrency,
  } = options;

  const readPages = await prepareListPages({
    fetchPage,
    pageSize: HANGAR_PAGE_SIZE,
    progress,
    concurrency,
  });
  progress?.expect(0, SYNC_WORK.finish);
  return async () => {
    // Only needed for CCU images – loads alongside the pages; a failure just means fewer images.
    const shipImages = fetchShipImages().catch((error: unknown) => {
      console.warn('[sc-hangar-manager] Ship matrix unavailable, CCU images may be missing', error);
      return new Map() as ShipImages;
    });
    const pagesOf = await readPages();

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

    const snapshot = await storeSnapshot([...pledges.values()], await shipImages, fetchShipLinks);
    progress?.complete(0, SYNC_WORK.finish);
    return snapshot;
  };
}

/** Adds images and ship links to the pledges read and stores them as the new snapshot. */
async function storeSnapshot(
  allPledges: Pledge[],
  shipImages: ShipImages,
  fetchShipLinks: NonNullable<SyncOptions['fetchShipLinks']>,
): Promise<HangarSnapshot> {
  resolveUpgradeImages(allPledges, shipImages);

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
