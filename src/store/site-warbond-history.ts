import { WARBOND_HISTORY_SITE } from '@/config';
import { fileList, localizedText, record, text, time } from '@/site-data/site-data';
import {
  WARBOND_HISTORY_VERSION,
  type SightingEvent,
  type WarbondHistorySnapshot,
  type WarbondSighting,
} from './warbond-history';

/*
 * The earlier warbond offers of the project website (`site/public/data/warbond-history.json`):
 * offers seen before this browser read the Pledge Store, e.g. collected by the community. They
 * are kept apart from the history of this browser (#4) and only added to it where it is shown,
 * so the history of this browser stays what it saw itself.
 *
 * {
 *   "schemaVersion": 1,
 *   "offers": [
 *     {
 *       "ship": { "id": 178, "name": "Corsair" },   // id of the upgrade tool, name when offered
 *       "skuId": 12345,                              // optional, the SKU of the warbond edition
 *       "price": 225,                                // warbond price in USD
 *       "msrp": 250,                                 // standard price when offered, in USD
 *       "firstSeen": "2026-09-10T16:00:00Z",
 *       "lastSeen": "2026-09-17T16:00:00Z",
 *       "events": [{ "id": "iae-2955", "name": "Intergalactic Aerospace Expo 2955" }]
 *     }
 *   ]
 * }
 *
 * An event's name is one text or one per language (`{ "en": …, "de": … }`).
 */

const MAX_USD = 100_000;

/** A price in USD of the file: above 0, at most `MAX_USD`; else none. */
const usd = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_USD
    ? Math.round(value * 100) / 100
    : undefined;

/** A positive whole number of the file, else none. */
const id = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;

function eventOf(value: unknown): SightingEvent | undefined {
  const event = record(value);
  const eventId = text(event?.id, 100);
  const name = localizedText(event?.name, 200);
  return eventId && name ? { id: eventId, name } : undefined;
}

function offerOf(value: unknown): WarbondSighting | undefined {
  const offer = record(value);
  const ship = record(offer?.ship);
  const shipId = id(ship?.id);
  const shipName = text(ship?.name, 200);
  const price = usd(offer?.price);
  const msrp = usd(offer?.msrp);
  const firstSeen = time(offer?.firstSeen);
  const lastSeen = time(offer?.lastSeen);
  if (!shipId || !shipName || !price || !msrp || price >= msrp) return undefined;
  if (firstSeen === undefined || lastSeen === undefined || lastSeen < firstSeen) return undefined;
  const events = Array.isArray(offer?.events)
    ? offer.events.map(eventOf).filter((event) => !!event)
    : [];
  return {
    shipId,
    skuId: id(offer?.skuId) ?? 0,
    shipName,
    price,
    msrp,
    firstSeen,
    lastSeen,
    ...(events.length && { events }),
  };
}

/**
 * The offers of the website's file, oldest first; entries that don't fit are left out.
 * `undefined` for a file of another format, so the stored ones are kept.
 */
export function parseSiteWarbondHistory(json: unknown): WarbondSighting[] | undefined {
  const list = fileList(json, WARBOND_HISTORY_SITE.schemaVersion, 'offers');
  if (!list) return undefined;
  return list
    .map(offerOf)
    .filter((offer) => !!offer)
    .sort((a, b) => a.firstSeen - b.firstSeen);
}

/**
 * The history of this browser with the website's offers added, oldest first. A website offer of
 * the same ship and price as a sighting of this browser, at overlapping times, is the same offer:
 * this browser's sighting is kept. The website's offers are all expired, even without a history
 * of this browser (`lastReadAt` 0).
 */
export function withSiteSightings(
  history: WarbondHistorySnapshot | undefined,
  site: readonly WarbondSighting[],
): WarbondHistorySnapshot | undefined {
  if (!site.length) return history;
  const own = history?.sightings ?? [];
  const known = (offer: WarbondSighting) =>
    own.some(
      (sighting) =>
        sighting.shipId === offer.shipId &&
        sighting.price === offer.price &&
        sighting.firstSeen <= offer.lastSeen &&
        offer.firstSeen <= sighting.lastSeen,
    );
  const added = site.filter((offer) => !known(offer));
  if (!added.length) return history;
  return {
    version: WARBOND_HISTORY_VERSION,
    lastReadAt: history?.lastReadAt ?? 0,
    sightings: [...own, ...added].sort((a, b) => a.firstSeen - b.firstSeen),
  };
}
