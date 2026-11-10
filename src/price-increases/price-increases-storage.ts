import { defineMeta } from '@/storage/meta';
import type { ExpectedPriceIncrease } from './price-increases';

/** Format version of the stored price increases; others are ignored and read again. */
export const PRICE_INCREASES_VERSION = 1;

export interface PriceIncreasesSnapshot {
  version: number;
  priceIncreases: ExpectedPriceIncrease[];
}

/** The expected price increases of the project website (#195), as last read. */
export const priceIncreasesItem = storage.defineItem<PriceIncreasesSnapshot | null>(
  'local:priceIncreases',
  { fallback: null },
);

/** The stored price increases, if of the current format; else none. */
export const storedPriceIncreases = (
  snapshot: PriceIncreasesSnapshot | null,
): ExpectedPriceIncrease[] =>
  snapshot?.version === PRICE_INCREASES_VERSION ? snapshot.priceIncreases : [];

/** Last read, check and fingerprint of the price increases (see `storage/meta.ts`). */
export const priceIncreasesMeta = defineMeta('local:priceIncreases');
