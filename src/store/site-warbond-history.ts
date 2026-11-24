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
 *       "expectedEnd": "2026-10-10T16:00:00Z",   // optional, when it is expected to end (#568)
 *       "events": [{ "id": "iae-2955", "name": "Intergalactic Aerospace Expo 2955" }]
 *     }
 *   ]
 * }
 *
 * An event's name is one text or one per language (`{ "en": …, "de": … }`). `expectedEnd` is an
 * expectation, not confirmed by CIG, e.g. for the warbond offers of ships flight ready at an event,
 * sold for about a month; it is left out when invalid or before `firstSeen`.
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
  const expectedEnd = time(offer?.expectedEnd);
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
    ...(expectedEnd !== undefined && expectedEnd > firstSeen && { expectedEnd }),
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
 * the same ship and price (and SKU, where both name one) as a sighting of this browser, at
 * overlapping times, is the same offer. The website's offer counts until its expected end, not
 * only until it was last seen there: a browser that saw the offer first later, or again after a
 * gap, still finds it (#664). Its expected end comes first (#569), and its events where this
 * browser saw none; the sighting keeps its own times. The website's other offers are all expired,
 * even without a history of this browser (`lastReadAt` 0).
 */
export function withSiteSightings(
  history: WarbondHistorySnapshot | undefined,
  site: readonly WarbondSighting[],
): WarbondHistorySnapshot | undefined {
  if (!site.length) return history;
  const same = (sighting: WarbondSighting, offer: WarbondSighting) =>
    sighting.shipId === offer.shipId &&
    sighting.price === offer.price &&
    (!sighting.skuId || !offer.skuId || sighting.skuId === offer.skuId) &&
    sighting.firstSeen <= Math.max(offer.lastSeen, offer.expectedEnd ?? 0) &&
    offer.firstSeen <= sighting.lastSeen;
  let changed = false;
  const own = (history?.sightings ?? []).map((sighting) => {
    const offers = site.filter((offer) => same(sighting, offer));
    const expectedEnd = offers.findLast((offer) => offer.expectedEnd)?.expectedEnd;
    const events = sighting.events?.length
      ? undefined
      : offers.findLast((offer) => offer.events?.length)?.events;
    const newEnd = expectedEnd !== undefined && sighting.expectedEnd !== expectedEnd;
    if (!newEnd && !events) return sighting;
    changed = true;
    return {
      ...sighting,
      ...(newEnd && { expectedEnd }),
      ...(events && { events }),
    };
  });
  const added = site.filter((offer) => !own.some((sighting) => same(sighting, offer)));
  if (!added.length && !changed) return history;
  return {
    version: WARBOND_HISTORY_VERSION,
    lastReadAt: history?.lastReadAt ?? 0,
    sightings: [...own, ...added].sort((a, b) => a.firstSeen - b.firstSeen),
  };
}
