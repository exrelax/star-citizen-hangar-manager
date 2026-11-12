import type { StarCitizenEvent } from '@/events/events';
import { normalizeSearchText } from '@/hangar/search';
import type { Ship } from '@/ships/ships';
import type { WarbondHistorySnapshot, WarbondSighting } from './warbond-history';

/*
 * The "Warbond CCU History" of the Pledge Store tab (#297): the expired warbond offers of the
 * history (#4) – those the last read of the Pledge Store no longer found –, within a period back
 * from now, searched by ship and manufacturer and sorted by date, standard price or discount.
 */

/** How far back the history reaches: the running event's period, or a number of days. */
export const HISTORY_PERIODS = ['event', 'days30', 'days90', 'days180'] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

const PERIOD_DAYS: Record<Exclude<HistoryPeriod, 'event'>, number> = {
  days30: 30,
  days90: 90,
  days180: 180,
};

/** The period without a running event. */
export const DEFAULT_HISTORY_PERIOD: HistoryPeriod = 'days90';

export const HISTORY_SORTS = ['date', 'standardPrice', 'discount'] as const;
export type HistorySort = (typeof HISTORY_SORTS)[number];

/** An expired offer as the history view lists it. */
export interface HistoryEntry {
  /** Unique within the list (the sighting's place in the history). */
  id: number;
  /** Ship name and manufacturer, normalized for the search (see `hangar/search.ts`). */
  searchText: string;
  sighting: WarbondSighting;
  /** The ship of the upgrade tool, for its image; none if it left the upgrade tool. */
  ship?: Ship;
  manufacturer?: string;
  /** `msrp - price` in USD, and in percent of the msrp. */
  discount: number;
  percent: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Whether a sighting is over: the last read of the Pledge Store didn't find it. */
export const isExpired = (history: WarbondHistorySnapshot, sighting: WarbondSighting) =>
  sighting.lastSeen !== history.lastReadAt;

/** The expired offers of the history, with their ship, manufacturer and discount. */
export function historyEntries(
  history: WarbondHistorySnapshot | undefined,
  ships: readonly Ship[],
  manufacturerOf: (shipId: number) => string | undefined = () => undefined,
): HistoryEntry[] {
  if (!history) return [];
  const shipOf = new Map(ships.map((ship) => [ship.id, ship]));
  return history.sightings.flatMap((sighting, index): HistoryEntry[] => {
    if (!isExpired(history, sighting)) return [];
    const ship = shipOf.get(sighting.shipId);
    const manufacturer = manufacturerOf(sighting.shipId);
    const discount = Math.round((sighting.msrp - sighting.price) * 100) / 100;
    return [
      {
        id: index,
        searchText: normalizeSearchText(`${sighting.shipName} ${manufacturer ?? ''}`),
        sighting,
        ...(ship && { ship }),
        ...(manufacturer && { manufacturer }),
        discount,
        percent: sighting.msrp > 0 ? (discount / sighting.msrp) * 100 : 0,
      },
    ];
  });
}

/** The event running at `now`; of several, the one that began first. */
export const runningEvent = (
  events: readonly StarCitizenEvent[],
  now: number,
): StarCitizenEvent | undefined =>
  events
    .filter((event) => event.eventStart <= now && now < event.eventEnd)
    .sort((a, b) => a.eventStart - b.eventStart)[0];

/** The periods to choose from: the event period only while an event runs. */
export const historyPeriods = (event: StarCitizenEvent | undefined): HistoryPeriod[] =>
  HISTORY_PERIODS.filter((period) => period !== 'event' || event);

/** The period selected at first: the event period while an event runs, else 90 days. */
export const defaultHistoryPeriod = (event: StarCitizenEvent | undefined): HistoryPeriod =>
  event ? 'event' : DEFAULT_HISTORY_PERIOD;

/** Where a period begins (epoch milliseconds); the event period falls back to 90 days. */
export function periodStart(
  period: HistoryPeriod,
  now: number,
  event: StarCitizenEvent | undefined,
): number {
  if (period === 'event') {
    return event ? event.eventStart : periodStart(DEFAULT_HISTORY_PERIOD, now, event);
  }
  return now - PERIOD_DAYS[period] * DAY;
}

/** The entries seen within the period: their last day at or after its start. */
export const withinPeriod = (entries: readonly HistoryEntry[], start: number) =>
  entries.filter((entry) => entry.sighting.lastSeen >= start);

const byName = (a: HistoryEntry, b: HistoryEntry) =>
  a.sighting.shipName.localeCompare(b.sighting.shipName);
const byDate = (a: HistoryEntry, b: HistoryEntry) =>
  b.sighting.lastSeen - a.sighting.lastSeen || b.sighting.firstSeen - a.sighting.firstSeen;

/** Sorted, the highest first: newest, most expensive ship, biggest discount. */
export function sortHistory(entries: readonly HistoryEntry[], sort: HistorySort): HistoryEntry[] {
  const compare = {
    date: (a: HistoryEntry, b: HistoryEntry) => byDate(a, b) || byName(a, b),
    standardPrice: (a: HistoryEntry, b: HistoryEntry) =>
      b.sighting.msrp - a.sighting.msrp || byName(a, b) || byDate(a, b),
    discount: (a: HistoryEntry, b: HistoryEntry) =>
      b.discount - a.discount || b.percent - a.percent || byDate(a, b) || byName(a, b),
  }[sort];
  return [...entries].sort(compare);
}
