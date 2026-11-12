import { SHIP_FACTS } from '@/config';
import { defineMeta } from '@/storage/meta';
import { createSiteDataSync, fetchSiteFile, type RefreshOptions } from '@/site-data/sync-site-data';
import bundledFile from '../../site/public/data/ships.json';
import { parseShipFacts, type ShipFacts } from './ship-facts';

/*
 * Keeps the ships' facts of the project website (`data/ships.json`, #109) current, like every
 * data file of the website (`site-data/sync-site-data.ts`), but at most once a day: the file is
 * larger and changes rarely. Offline and before the first read, the copy bundled with the
 * extension counts (`bundledShipFacts`).
 */

/** Format version of the stored facts; others are ignored and read again. */
export const SHIP_FACTS_VERSION = 1;

export interface ShipFactsSnapshot {
  version: number;
  facts: ShipFacts;
}

export const shipFactsItem = storage.defineItem<ShipFactsSnapshot | null>('local:shipFacts', {
  fallback: null,
});

/** Last read, check and fingerprint of the ships' facts (see `storage/meta.ts`). */
export const shipFactsMeta = defineMeta('local:shipFacts');

/** The stored facts, if of the current format. */
export const storedShipFacts = (snapshot: ShipFactsSnapshot | null | undefined) =>
  snapshot?.version === SHIP_FACTS_VERSION ? snapshot.facts : undefined;

let bundled: ShipFacts | undefined;
/** The copy bundled with this version of the extension (parsed once). */
export const bundledShipFacts = (): ShipFacts | undefined =>
  (bundled ??= parseShipFacts(bundledFile));

/**
 * The facts of the website's file, checked. The development build reads the file of the working
 * copy (`site/public/data/ships.json`); "Stored data" in the settings reads it again at once.
 */
export async function fetchShipFacts(): Promise<ShipFacts | undefined> {
  if (import.meta.env.DEV) return bundledShipFacts();
  return parseShipFacts(await fetchSiteFile(SHIP_FACTS.url));
}

const refresh = createSiteDataSync({
  name: 'Ship facts',
  item: shipFactsItem,
  meta: shipFactsMeta,
  version: SHIP_FACTS_VERSION,
  fetch: () => fetchShipFacts(),
  toSnapshot: (facts: ShipFacts) => ({ version: SHIP_FACTS_VERSION, facts }),
  fromSnapshot: (snapshot: ShipFactsSnapshot) => snapshot.facts,
  maxAgeMs: SHIP_FACTS.maxAgeMs,
});

/** Reads the ships' facts if due (once a day; `force`: in any case). */
export async function maybeRefreshShipFacts(
  options: RefreshOptions<ShipFacts> = {},
): Promise<void> {
  await refresh(options);
}
