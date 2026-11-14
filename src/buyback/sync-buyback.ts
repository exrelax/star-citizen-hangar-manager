import { BUYBACK_PAGE_SIZE, BUYBACK_RETRY_DELAYS_MS, SYNC_CONCURRENCY, SYNC_WORK } from '@/config';
import { httpError, isTransient, urlOf, withRetry, withUrl } from '@/shared/lib/retry';
import { narrowingFetchPage, type SkippedPositions } from './narrow-pages';
import { capitalized, logError, reasonOf } from '@/errors/error-log';
import { prepareListPages, type ListPagesOf } from '@/hangar/list-pages';
import { PLEDGE_CATEGORIES, type Pledge, type PledgeCategory } from '@/hangar/pledge';
import { resolveShipLinks, type ShipLinks } from '@/hangar/ship-links';
import type { ProgressSink } from '@/hangar/sync-progress';
import { mapWithConcurrency } from '@/shared/lib/pool';
import {
  BUYBACK_SNAPSHOT_VERSION,
  buybackShipNames,
  describeBuybackPledge,
  hasSeveralItems,
  type BuybackPledge,
  type BuybackSnapshot,
} from './buyback';
import { buybackSnapshot, rememberBuybackDetails } from './buyback-storage';
import {
  parseBuybackDetail,
  parseBuybackPage,
  parseBuybackPrice,
  type BuybackListPage,
} from './parse-buyback';

export type FetchBuybackPage = (
  page: number,
  category?: PledgeCategory,
  pageSize?: number,
) => Promise<BuybackListPage>;

export interface BuybackSyncDeps {
  fetchPage?: FetchBuybackPage;
  fetchDetails?: (id: number) => Promise<BuybackDetails>;
  /**
   * Also reads the detail pages of pledges with several items whose price isn't known yet (a full
   * sync, after an update that added prices, #185). Smart updates read only new pledges.
   */
  backfillPrices?: boolean;
  fetchShipLinks?: (pledges: Pledge[], previous: ShipLinks | undefined) => Promise<ShipLinks>;
  /** Hears about the list pages and – once known – the detail pages to read. */
  progress?: ProgressSink;
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
  // A page RSI can't render is narrowed down to the pledge that breaks it (#339).
  const skipped: SkippedPositions[] = [];
  // The last read names the pledges around a skipped one (#342); read once, when needed.
  let previous: Promise<BuybackSnapshot | null> | undefined;
  const readPages = await prepareListPages({
    fetchPage: narrowingFetchPage(fetchPage, (position) => {
      console.warn(
        `[star-citizen-hangar-manager] Buy back position ${position.position + 1}` +
          `${position.category ? ` of ${position.category}` : ''} skipped`,
        position.error,
      );
      skipped.push(position);
      previous ??= buybackSnapshot.getValue();
      void logSkipped(position, previous);
    }),
    pageSize: BUYBACK_PAGE_SIZE,
    progress,
    concurrency,
  });
  progress?.expect(0, SYNC_WORK.finish);
  return async () => {
    const snapshot = await storeBuyback(await readPages(), deps, skipped);
    progress?.complete(0, SYNC_WORK.finish);
    return snapshot;
  };
}

/**
 * Logs a skipped pledge (#339) as the error closest to the cause, with the larger pages that
 * failed before it as its sub-errors, and – for the full list – the pledges the last read had at
 * and around its position (#342).
 */
async function logSkipped(
  position: SkippedPositions,
  previous: Promise<BuybackSnapshot | null>,
): Promise<void> {
  let near = '';
  if (!position.category) {
    const pledges = (await previous.catch(() => null))?.pledges ?? [];
    const around = (offset: number) => pledges[position.position + offset];
    const there = around(0);
    if (there) {
      const before = around(-1);
      const after = around(1);
      near =
        `; the last read had ${describeBuybackPledge(there)} there` +
        (before ? `, after "${before.title}"` : '') +
        (after ? `, before "${after.title}"` : '');
    }
  }
  const list = position.category ? ` (${position.category})` : '';
  await logError(
    'BB-PAGE-SKIP',
    `Buy back${list} position ${position.position + 1}, page of 1 pledge: ` +
      `${reasonOf(position.error)}; the pledge there was left out${near}`,
    {
      error: position.error,
      subErrors: position.attempts.map((attempt) => {
        const url = urlOf(attempt.error);
        return {
          at: attempt.at,
          message:
            `Buy back${list} page ${attempt.page} of ${attempt.size} pledges: ` +
            reasonOf(attempt.error),
          ...(url && { url }),
        };
      }),
    },
  );
}

/** Merges the pages read, adds the details and stores the result as the new snapshot. */
async function storeBuyback(
  pagesOf: ListPagesOf<BuybackPledge>,
  deps: BuybackSyncDeps,
  skipped: readonly SkippedPositions[] = [],
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
  // A full sync also fills in the prices of pledges read before prices were (#185).
  const shipLinks = await enrichBuyback(all, previous, { ...deps, backfillPrices: true });

  // RSI shows the tokens above every page of the list; the first one is read anyway.
  const tokens = (pagesOf(undefined)[0] as BuybackListPage | undefined)?.tokens;
  const now = new Date().toISOString();
  // Only the full list counts: a pledge skipped in a category list just misses its category.
  const unread = skipped.filter((position) => !position.category).length;
  const snapshot: BuybackSnapshot = {
    version: BUYBACK_SNAPSHOT_VERSION,
    syncedAt: now,
    updatedAt: now,
    pledges: all,
    shipLinks,
    ...(tokens !== undefined && { tokens }),
    ...(unread > 0 && { unread }),
  };
  await buybackSnapshot.setValue(snapshot);
  return snapshot;
}

/** What a buy back pledge's detail page adds: all its items and its price. */
export interface BuybackDetails {
  items: string[];
  /** USD without taxes; undefined if the page shows none. */
  price?: number;
}

/**
 * Adds what the list pages don't show: the items and the price of pledges with several items (from
 * their detail pages; known ones are reused) and links for their ships. Returns the ship links.
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
    backfillPrices = false,
  } = deps;

  const known = new Map((previous?.pledges ?? []).filter((p) => p.items).map((p) => [p.id, p]));
  const missing: BuybackPledge[] = [];
  for (const pledge of pledges) {
    if (!hasSeveralItems(pledge)) continue;
    const before = known.get(pledge.id);
    pledge.items ??= before?.items;
    if (pledge.price === undefined && before?.price !== undefined) pledge.price = before.price;
    if (!pledge.items || (backfillPrices && pledge.price === undefined)) missing.push(pledge);
  }
  // Only known once the list pages are read, so they join the progress late.
  progress?.expect(missing.length, missing.length * SYNC_WORK.detailPage);
  // A page that can't be read leaves its pledge as the list shows it, never the whole buy back
  // unread (#334); it is read again next time, as its items are still missing.
  await mapWithConcurrency(missing, concurrency, async (pledge) => {
    try {
      const details = await fetchDetails(pledge.id);
      pledge.items = details.items;
      pledge.price = details.price ?? null;
      delete pledge.detailsFailed;
    } catch (error) {
      console.warn(
        `[star-citizen-hangar-manager] Details of buy back pledge ${pledge.id} unavailable`,
        error,
      );
      pledge.detailsFailed = true;
      void logError(
        'BB-DETAIL-SKIP',
        `${capitalized(describeBuybackPledge(pledge))}: ${reasonOf(error)}; ` +
          'kept without its items and price',
        { error },
      );
    }
    progress?.complete(1, SYNC_WORK.detailPage);
  });

  // Ship links reuse the hangar's matching; buy back ships have no manufacturer code.
  const ships = [...new Set(pledges.flatMap(buybackShipNames))];
  const previousLinks = previous?.shipLinks;
  if (ships.every((name) => previousLinks?.[name])) return previousLinks;
  const shipPledges = [{ items: ships.map((title) => ({ title, kind: 'Ship' })) }] as Pledge[];
  return fetchShipLinks(shipPledges, previousLinks).catch((error: unknown) => {
    console.warn(
      '[star-citizen-hangar-manager] Fleetyards unavailable, buy back ship links missing',
      error,
    );
    void logError('BB-LINKS-FAIL', `FleetYards: ${reasonOf(error)}; kept the known ship links`, {
      error,
    });
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
  const html = await fetchHtml(
    `/en/account/buy-back-pledges?page=${page}&pagesize=${pageSize}${filter}`,
    `Loading buy back page ${page}`,
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.querySelector('.sidenav a[href$="/account/pledges"]')) {
    throw new Error(`Buy back page ${page} is no account page – are you still logged in?`);
  }
  return parseBuybackPage(doc);
};

/** Items and price of a buy back pledge, from its detail page. */
export async function fetchBuybackDetails(id: number): Promise<BuybackDetails> {
  const html = await fetchHtml(`/pledge/buyback/${id}`, `Loading buy back pledge ${id}`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const price = parseBuybackPrice(doc);
  return { items: parseBuybackDetail(doc), ...(price !== undefined && { price }) };
}

/**
 * The HTML of a page of the user's account, read again while it fails for a reason that may pass
 * (#334: HTTP 429, 5xx, no answer). Throws "<what> failed: HTTP <status>" otherwise.
 */
export async function fetchHtml(url: string, what: string): Promise<string> {
  return withRetry(
    async () => {
      const response = await fetch(url, { credentials: 'include' }).catch((error: unknown) => {
        throw withUrl(error, url);
      });
      if (!response.ok) throw httpError(what, response, url);
      return response.text();
    },
    BUYBACK_RETRY_DELAYS_MS,
    isTransient,
  );
}

const loading = new Map<number, Promise<void>>();

/**
 * Reads the detail page of one pledge and keeps what it shows, when its row is opened: the buy back
 * price of single items the Pledge Store doesn't sell any more (#185), and the items and price of a
 * pledge whose page couldn't be read during the sync (#334). Once per pledge, also when its row is
 * opened twice meanwhile; a failure leaves it unread, so the next opening tries again.
 */
export function loadBuybackDetails(
  id: number,
  fetchDetails: (id: number) => Promise<BuybackDetails> = fetchBuybackDetails,
): Promise<void> {
  let reading = loading.get(id);
  if (!reading) {
    reading = fetchDetails(id)
      .then((details) => rememberBuybackDetails(id, details))
      .catch((error: unknown) => {
        console.warn(
          `[star-citizen-hangar-manager] Details of buy back pledge ${id} unavailable`,
          error,
        );
        void buybackSnapshot.getValue().then((snapshot) => {
          const pledge = snapshot?.pledges.find((candidate) => candidate.id === id);
          const which = pledge ? describeBuybackPledge(pledge) : `buy back pledge #${id}`;
          return logError(
            'BB-DETAIL-OPEN',
            `${capitalized(which)}: ${reasonOf(error)} when opened; read again next time`,
            { error },
          );
        });
      })
      .finally(() => loading.delete(id));
    loading.set(id, reading);
  }
  return reading;
}
