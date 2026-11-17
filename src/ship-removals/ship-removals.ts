import { SHIP_REMOVALS } from '@/config';
import {
  dayOrTime,
  endOf,
  fileList,
  httpsUrl,
  record,
  text,
  type DayOrTime,
} from '@/site-data/site-data';

/*
 * The ship removals (#285): ships CIG takes out of the Pledge Store for good, usually because they
 * get an alternative variant (e.g. a Mk II). Loaded from the project website
 * (`data/ship-removals.json`, see "Editing the ship removals" in DEVELOPMENT.md). Each entry is an
 * announcement with its source: the date is CIG's, not a fact.
 */

export interface ShipRemoval {
  ship: {
    /** The ship's id in the Ship Matrix, also the upgrade tool's and the buy back CCUs'. */
    id: number;
    /** Its name in the Ship Matrix. */
    name: string;
  };
  /** When the ship leaves the Pledge Store; a day counts until its end (UTC). */
  removedAt: DayOrTime;
  /** Where it was announced, e.g. a Comm-Link or a post on Spectrum: an https URL. */
  source: string;
  /** The id of the event (#69) the removal belongs to. */
  event?: string;
}

const MAX_NAME = 150;

/** One entry of the file, if it has everything it needs; an `event` that doesn't fit is left out. */
function parseEntry(entry: unknown): ShipRemoval | undefined {
  const raw = record(entry);
  const ship = record(raw?.ship);
  if (!raw || !ship) return undefined;
  const id = ship.id;
  const name = text(ship.name, MAX_NAME);
  const removedAt = dayOrTime(raw.removedAt);
  const source = httpsUrl(raw.source);
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return undefined;
  if (!name || !removedAt || !source) return undefined;
  const event = text(raw.event, 100);
  return { ship: { id, name }, removedAt, source, ...(event && { event }) };
}

/**
 * The ship removals of the website's file; `undefined` if it isn't one of the format the
 * extension reads (another `schemaVersion`, no list), so the stored ones are kept. A ship's second
 * entry is left out: a ship is removed once.
 */
export function parseShipRemovals(json: unknown): ShipRemoval[] | undefined {
  const list = fileList(json, SHIP_REMOVALS.schemaVersion, 'shipRemovals');
  if (!list) return undefined;
  const seen = new Set<number>();
  return list.flatMap((entry) => {
    const removal = parseEntry(entry);
    if (!removal || seen.has(removal.ship.id)) return [];
    seen.add(removal.ship.id);
    return [removal];
  });
}

/** The removals still ahead at `now`, the next first. */
export const upcomingShipRemovals = (list: readonly ShipRemoval[], now: number): ShipRemoval[] =>
  list
    .filter((removal) => endOf(removal.removedAt) > now)
    .sort((a, b) => a.removedAt.at - b.removedAt.at);

/** The removals of one date: ships removed on the same date are told together (#285). */
export interface RemovalDate {
  removedAt: DayOrTime;
  removals: ShipRemoval[];
}

/** The upcoming removals by date, the next to be over first; the ships of a date by name. */
export function removalsByDate(list: readonly ShipRemoval[], now: number): RemovalDate[] {
  const groups = new Map<string, RemovalDate>();
  for (const removal of upcomingShipRemovals(list, now)) {
    const { at, dayOnly } = removal.removedAt;
    const key = `${at}${dayOnly ? 'd' : ''}`;
    const group = groups.get(key) ?? { removedAt: removal.removedAt, removals: [] };
    group.removals.push(removal);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.removals.sort((a, b) => a.ship.name.localeCompare(b.ship.name));
  }
  // A date with a time before the whole day it falls on: it is over first.
  return [...groups.values()].sort((a, b) => endOf(a.removedAt) - endOf(b.removedAt));
}
