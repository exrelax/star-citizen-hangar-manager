import { PLEDGE_STORE } from '@/config';
import type { LocalizedText, StarCitizenEvent } from '@/events/events';
import type { Ship, WarbondSku } from '@/ships/ships';

/*
 * The warbond offers seen so far (#4): every read of the upgrade tool adds the offers it finds,
 * with price, standard price, first and last time seen, and the events running meanwhile. It grows
 * only while the Hangar Manager reads the Pledge Store, and is kept in this browser only; earlier
 * offers of the project website are added where it is shown (`site-warbond-history.ts`).
 *
 * A sighting lasts as long as the offer is found by consecutive reads with the same SKU and
 * price. An offer missing in one read and found again later – or found with another price – is a
 * new sighting: it came back. Gaps without any read (the browser closed) don't end a sighting.
 */

/** Format version of the stored history; others are ignored and started anew. */
export const WARBOND_HISTORY_VERSION = 1;

/** An event running while an offer was seen. */
export interface SightingEvent {
  id: string;
  name: LocalizedText;
}

/** One time a warbond offer was in the Pledge Store, from its first to its last read. */
export interface WarbondSighting {
  shipId: number;
  skuId: number;
  /** The ship's name when seen, in case it is renamed or leaves the upgrade tool. */
  shipName: string;
  /** Warbond price in USD. */
  price: number;
  /** Standard price of the ship when seen, in USD. */
  msrp: number;
  /** Epoch milliseconds of the first and the last read that found it. */
  firstSeen: number;
  lastSeen: number;
  /** The events running at the reads that found it, in the order they began. */
  events?: SightingEvent[];
}

export interface WarbondHistorySnapshot {
  version: number;
  /** Epoch milliseconds of the last read recorded: the sightings seen by it are current. */
  lastReadAt: number;
  /** Oldest first. */
  sightings: WarbondSighting[];
}

/** The events running at `at`. */
const runningAt = (events: readonly StarCitizenEvent[], at: number): SightingEvent[] =>
  events
    .filter((event) => event.eventStart <= at && at < event.eventEnd)
    .map(({ id, name }) => ({ id, name }));

/**
 * The history with the offers of a read at `at` added: an offer of the last read with the same
 * SKU and price goes on, any other one starts a new sighting. Offers of ships missing in the ship
 * list are left out (their name and standard price are unknown). Without a stored history it
 * starts with this read. The oldest sightings go once there are more than
 * `PLEDGE_STORE.historyMax`.
 */
export function recordWarbondOffers(
  history: WarbondHistorySnapshot | null | undefined,
  warbonds: readonly WarbondSku[],
  ships: readonly Ship[],
  events: readonly StarCitizenEvent[],
  at: number,
): WarbondHistorySnapshot {
  const stored = history?.version === WARBOND_HISTORY_VERSION ? history : undefined;
  // A read older than the last recorded one (another tab's) changes nothing.
  if (stored && at <= stored.lastReadAt) return stored;

  const sightings = stored ? stored.sightings.map((sighting) => ({ ...sighting })) : [];
  const open = new Map(
    sightings
      .filter((sighting) => sighting.lastSeen === stored?.lastReadAt)
      .map((sighting) => [`${sighting.skuId}|${sighting.price}`, sighting]),
  );
  const running = runningAt(events, at);
  const shipOf = new Map(ships.map((ship) => [ship.id, ship]));

  for (const sku of warbonds) {
    const ship = shipOf.get(sku.shipId);
    if (!ship) continue;
    const key = `${sku.skuId}|${sku.price}`;
    const sighting = open.get(key) ?? {
      shipId: sku.shipId,
      skuId: sku.skuId,
      shipName: ship.name,
      price: sku.price,
      msrp: ship.msrp,
      firstSeen: at,
      lastSeen: at,
    };
    if (!open.has(key)) {
      sightings.push(sighting);
      open.set(key, sighting);
    }
    sighting.lastSeen = at;
    const known = new Set(sighting.events?.map((event) => event.id));
    const added = running.filter((event) => !known.has(event.id));
    if (added.length) sighting.events = [...(sighting.events ?? []), ...added];
  }

  return {
    version: WARBOND_HISTORY_VERSION,
    lastReadAt: at,
    sightings: sightings.slice(-PLEDGE_STORE.historyMax),
  };
}

/** What the history tells about a current offer. */
export interface OfferHistory {
  /** When the current sighting began (epoch milliseconds); none if it isn't recorded yet. */
  since?: number;
  /** The events of the current sighting. */
  events: SightingEvent[];
  /** Earlier sightings of the same ship (any SKU and price), newest first. */
  earlier: WarbondSighting[];
}

/** The history of an offer of the current read: its sighting and the earlier ones of its ship. */
export function offerHistory(
  history: WarbondHistorySnapshot | undefined,
  offer: { shipId: number; skuId: number; price: number },
): OfferHistory {
  const sightings = history?.sightings ?? [];
  const current = sightings.findLast(
    (sighting) =>
      sighting.lastSeen === history?.lastReadAt &&
      sighting.skuId === offer.skuId &&
      sighting.price === offer.price,
  );
  // Another offer of the ship found by the last read isn't an earlier one.
  const earlier = sightings
    .filter(
      (sighting) => sighting.shipId === offer.shipId && sighting.lastSeen !== history?.lastReadAt,
    )
    .sort((a, b) => b.firstSeen - a.firstSeen);
  return {
    ...(current && { since: current.firstSeen }),
    events: current?.events ?? [],
    earlier,
  };
}
