import { BUYBACK_PAGE_SIZE, SYNC_CONCURRENCY, SYNC_WORK } from '@/config';
import { prepareListPages, type ListPagesOf } from '@/hangar/list-pages';
import { PLEDGE_CATEGORIES, type Pledge, type PledgeCategory } from '@/hangar/pledge';
import { resolveShipLinks, type ShipLinks } from '@/hangar/ship-links';
import type { ListPage } from '@/hangar/smart-update/check';
import type { SyncProgressTracker } from '@/hangar/sync-progress';
import { mapWithConcurrency } from '@/shared/lib/pool';
import {
  BUYBACK_SNAPSHOT_VERSION,
  buybackShipNames,
  hasSeveralItems,
  type BuybackPledge,
  type BuybackSnapshot,
} from './buyback';
import { buybackSnapshot } from './buyback-storage';
import { parseBuybackDetail, parseBuybackPage } from './parse-buyback';

export type FetchBuybackPage = (
  page: number,
  category?: PledgeCategory,
  pageSize?: number,
) => Promise<ListPage<BuybackPledge>>;

export interface BuybackSyncDeps {
  fetchPage?: FetchBuybackPage;
  fetchDetails?: (id: number) => Promise<string[]>;
  fetchShipLinks?: (pledges: Pledge[], previous: ShipLinks | undefined) => Promise<ShipLinks>;
  /** Hears about the list pages and – once known – the detail pages to read. */
  progress?: SyncProgressTracker;
  concurrency?: number;
}

/**
 * Reads the whole buy back (all pages plus RSI's category lists) and stores it. Like the hangar
 * sync, nothing is stored unless every page was read.
 */
export async function syncBuyback(deps: BuybackSyncDeps = {}): Promise<BuybackSnapshot> {
  const run = await prepareBuybackSync(deps);
  return run();
}

/**
 * First step of `syncBuyback`: reads the first pages, which tell how many pages there are, and
 * announces them to `deps.progress`. The returned function does the rest.
 */
export async function prepareBuybackSync(
  deps: BuybackSyncDeps = {},
): Promise<() => Promise<BuybackSnapshot>> {
  const { fetchPage = fetchBuybackPage, progress, concurrency } = deps;
  const readPages = await prepareListPages({
    fetchPage,
    pageSize: BUYBACK_PAGE_SIZE,
    progress,
    concurrency,
  });
  progress?.expect(0, SYNC_WORK.finish);
  return async () => {
    const snapshot = await storeBuyback(await readPages(), deps);
    progress?.complete(0, SYNC_WORK.finish);
    return snapshot;
  };
}

/** Merges the pages read, adds the details and stores the result as the new snapshot. */
async function storeBuyback(
  pagesOf: ListPagesOf<BuybackPledge>,
  deps: BuybackSyncDeps,
): Promise<BuybackSnapshot> {
  const pledges = new Map<number, BuybackPledge>();
  for (const page of pagesOf(undefined)) {
    for (const pledge of page.pledges) if (!pledges.has(pledge.id)) pledges.set(pledge.id, pledge);
  }
  for (const category of PLEDGE_CATEGORIES) {
    for (const page of pagesOf(category)) {
      for (const { id } of page.pledges) {
        const pledge = pledges.get(id);
        if (pledge) pledge.category = category;
      }
    }
  }

  const previous = await buybackSnapshot.getValue();
  const all = [...pledges.values()];
  const shipLinks = await enrichBuyback(all, previous, deps);

  const now = new Date().toISOString();
  const snapshot: BuybackSnapshot = {
    version: BUYBACK_SNAPSHOT_VERSION,
    syncedAt: now,
    updatedAt: now,
    pledges: all,
    shipLinks,
  };
  await buybackSnapshot.setValue(snapshot);
  return snapshot;
}

/**
 * Adds what the list pages don't show: the items of pledges with several items (from their
 * detail pages; known ones are reused) and links for their ships. Returns the ship links.
 */
export async function enrichBuyback(
  pledges: BuybackPledge[],
  previous: BuybackSnapshot | null | undefined,
  deps: BuybackSyncDeps = {},
): Promise<ShipLinks | undefined> {
  const {
    fetchDetails = fetchBuybackDetails,
    fetchShipLinks = resolveShipLinks,
    concurrency = SYNC_CONCURRENCY,
    progress,
  } = deps;

  const knownItems = new Map(
    (previous?.pledges ?? []).filter((p) => p.items).map((p) => [p.id, p.items!]),
  );
  const missing: BuybackPledge[] = [];
  for (const pledge of pledges) {
    if (!hasSeveralItems(pledge)) continue;
    const items = pledge.items ?? knownItems.get(pledge.id);
    if (items) pledge.items = items;
    else missing.push(pledge);
  }
  // Only known once the list pages are read, so they join the progress late.
  progress?.expect(missing.length, missing.length * SYNC_WORK.detailPage);
  await mapWithConcurrency(missing, concurrency, async (pledge) => {
    pledge.items = await fetchDetails(pledge.id);
    progress?.complete(1, SYNC_WORK.detailPage);
  });

  // Ship links reuse the hangar's matching; buy back ships have no manufacturer code.
  const ships = [...new Set(pledges.flatMap(buybackShipNames))];
  const previousLinks = previous?.shipLinks;
  if (ships.every((name) => previousLinks?.[name])) return previousLinks;
  const shipPledges = [{ items: ships.map((title) => ({ title, kind: 'Ship' })) }] as Pledge[];
  return fetchShipLinks(shipPledges, previousLinks).catch((error: unknown) => {
    console.warn('[sc-hangar-manager] Fleetyards unavailable, buy back ship links missing', error);
    return previousLinks;
  });
}

/** Fetches a buy back page with the user's session (English variant, largest page size). */
export const fetchBuybackPage: FetchBuybackPage = async (
  page,
  category,
  pageSize = BUYBACK_PAGE_SIZE,
) => {
  const filter = category ? `&product-type=${category}` : '';
  const response = await fetch(
    `/en/account/buy-back-pledges?page=${page}&pagesize=${pageSize}${filter}`,
    { credentials: 'include' },
  );
  if (!response.ok)
    throw new Error(`Loading buy back page ${page} failed: HTTP ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  if (!doc.querySelector('.sidenav a[href$="/account/pledges"]')) {
    throw new Error(`Buy back page ${page} is no account page – are you still logged in?`);
  }
  return parseBuybackPage(doc);
};

/** Items of a buy back pledge, from its detail page. */
export async function fetchBuybackDetails(id: number): Promise<string[]> {
  const response = await fetch(`/pledge/buyback/${id}`, { credentials: 'include' });
  if (!response.ok)
    throw new Error(`Loading buy back pledge ${id} failed: HTTP ${response.status}`);
  return parseBuybackDetail(new DOMParser().parseFromString(await response.text(), 'text/html'));
}
