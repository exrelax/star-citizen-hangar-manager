import { PRICE_INCREASES } from '@/config';
import { createSiteDataSync, fetchSiteFile, type RefreshOptions } from '@/site-data/sync-site-data';
import { parsePriceIncreases, type ExpectedPriceIncrease } from './price-increases';
import {
  PRICE_INCREASES_VERSION,
  priceIncreasesItem,
  priceIncreasesMeta,
  type PriceIncreasesSnapshot,
} from './price-increases-storage';

/*
 * Keeps the stored expected price increases of the project website (#195) current, like every
 * data file of the website (`site-data/sync-site-data.ts`): at most once a day, after a failure
 * again after an hour; offline the stored ones stay.
 */

/**
 * The price increases of the website's file, checked; throws if it can't be read. The
 * development build reads the file of the working copy (`site/public/data/price-increases.json`),
 * so entries can be tried before they go live; "Stored data" in the settings reads it again at
 * once.
 */
export async function fetchPriceIncreases(): Promise<ExpectedPriceIncrease[] | undefined> {
  if (import.meta.env.DEV) {
    const local = await import('../../site/public/data/price-increases.json');
    return parsePriceIncreases(local.default);
  }
  return parsePriceIncreases(await fetchSiteFile(PRICE_INCREASES.url));
}

const refresh = createSiteDataSync({
  name: 'Price increases',
  item: priceIncreasesItem,
  meta: priceIncreasesMeta,
  version: PRICE_INCREASES_VERSION,
  refreshMs: PRICE_INCREASES.refreshMs,
  retryMs: PRICE_INCREASES.retryMs,
  fetch: () => fetchPriceIncreases(),
  toSnapshot: (priceIncreases: ExpectedPriceIncrease[]) => ({
    version: PRICE_INCREASES_VERSION,
    priceIncreases,
  }),
  fromSnapshot: (snapshot: PriceIncreasesSnapshot) => snapshot.priceIncreases,
});

/** Reads the expected price increases if due (`force`: in any case). */
export async function maybeRefreshPriceIncreases(
  options: RefreshOptions<ExpectedPriceIncrease[]> = {},
): Promise<void> {
  await refresh(options);
}
