import { describe, expect, it } from 'vitest';
import type { StarCitizenEvent } from '@/events/events';
import type { Ship } from '@/ships/ships';
import { WARBOND_HISTORY_VERSION, type WarbondSighting } from './warbond-history';
import {
  chosenPeriod,
  currentHistoryChoice,
  historyEntries,
  historyPeriods,
  periodStart,
  runningEvent,
  sortHistory,
  withinPeriod,
} from './warbond-history-view';
import { matchesSearch, parseSearchQuery } from '@/hangar/search';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-12T12:00:00Z');

const SHIPS: Ship[] = [
  { id: 1, name: 'Mercury', msrp: 260, image: 'mercury.jpg' },
  { id: 2, name: 'Vulture', msrp: 175 },
  { id: 3, name: 'Hull C', msrp: 500 },
];
const MANUFACTURERS: Record<number, string> = {
  1: 'Crusader Industries',
  2: 'Drake Interplanetary',
};

const sighting = (
  shipId: number,
  price: number,
  fromDaysAgo: number,
  toDaysAgo: number,
): WarbondSighting => {
  const ship = SHIPS.find((candidate) => candidate.id === shipId)!;
  return {
    shipId,
    skuId: shipId * 10,
    shipName: ship.name,
    price,
    msrp: ship.msrp,
    firstSeen: NOW - fromDaysAgo * DAY,
    lastSeen: NOW - toDaysAgo * DAY,
  };
};

const HISTORY = {
  version: WARBOND_HISTORY_VERSION,
  lastReadAt: NOW,
  sightings: [
    sighting(1, 240, 120, 110),
    sighting(2, 150, 40, 35),
    sighting(3, 450, 10, 8),
    // Still offered: found by the last read.
    sighting(1, 230, 2, 0),
  ],
};

const IAE: StarCitizenEvent = {
  id: 'iae',
  name: { en: 'IAE' },
  eventStart: NOW - 9 * DAY,
  eventEnd: NOW + DAY,
  displayStart: NOW - 10 * DAY,
  displayEnd: NOW + DAY,
};

const entries = () => historyEntries(HISTORY, SHIPS, (id) => MANUFACTURERS[id]);

describe('historyEntries', () => {
  it('lists only the expired offers, with ship, manufacturer and discount', () => {
    const list = entries();
    expect(list.map((entry) => [entry.sighting.shipName, entry.sighting.price])).toEqual([
      ['Mercury', 240],
      ['Vulture', 150],
      ['Hull C', 450],
    ]);
    expect(list[0]).toMatchObject({ discount: 20, manufacturer: 'Crusader Industries' });
    expect(list[0]!.ship?.image).toBe('mercury.jpg');
    expect(list[0]!.percent).toBeCloseTo(7.69, 2);
    expect(new Set(list.map((entry) => entry.id)).size).toBe(3);
  });

  it('is searchable by ship name and manufacturer', () => {
    const found = (query: string) =>
      entries()
        .filter((entry) => matchesSearch(entry.searchText, parseSearchQuery(query)))
        .map((entry) => entry.sighting.shipName);
    expect(found('drake')).toEqual(['Vulture']);
    expect(found('hull')).toEqual(['Hull C']);
    expect(found('crusader merc')).toEqual(['Mercury']);
  });

  it('is empty without a history', () => {
    expect(historyEntries(undefined, SHIPS)).toEqual([]);
  });
});

describe('periods', () => {
  it('offers and selects the event period only while an event runs', () => {
    expect(runningEvent([IAE], NOW)).toBe(IAE);
    expect(runningEvent([IAE], NOW + 2 * DAY)).toBeUndefined();
    expect(historyPeriods(IAE)).toEqual(['event', 'days30', 'days90', 'days180']);
    expect(historyPeriods(undefined)).toEqual(['days30', 'days90', 'days180']);
  });

  it('selects the period of a new event and goes back to 90 days once it is over', () => {
    const stored = { sort: 'discountDesc' as const, period: 'days30' as const };
    const during = currentHistoryChoice(stored, IAE);
    expect(during).toEqual({ sort: 'discountDesc', period: 'event', eventId: 'iae' });
    // Unchanged while the event runs: the same object, nothing to store.
    expect(currentHistoryChoice(during, IAE)).toBe(during);
    // Another period chosen during the event is kept until it ends.
    const chosen = chosenPeriod(during, 'days180', IAE);
    expect(currentHistoryChoice(chosen, IAE)).toBe(chosen);
    expect(currentHistoryChoice(chosen, undefined)).toBe(chosen);
    // After the event, its period goes back to 90 days; other periods stay.
    expect(currentHistoryChoice(during, undefined)).toEqual({
      sort: 'discountDesc',
      period: 'days90',
    });
    expect(currentHistoryChoice(stored, undefined)).toBe(stored);
    // The next event selects its period again.
    const next = { ...IAE, id: 'invictus' };
    expect(currentHistoryChoice(chosen, next)).toMatchObject({
      period: 'event',
      eventId: 'invictus',
    });
  });

  it('keeps the offers last seen within the period', () => {
    const names = (start: number) =>
      withinPeriod(entries(), start).map((entry) => entry.sighting.shipName);
    expect(names(periodStart('event', NOW, IAE))).toEqual(['Hull C']);
    expect(names(periodStart('days30', NOW, undefined))).toEqual(['Hull C']);
    expect(names(periodStart('days90', NOW, undefined))).toEqual(['Vulture', 'Hull C']);
    expect(names(periodStart('days180', NOW, undefined))).toEqual(['Mercury', 'Vulture', 'Hull C']);
    // Without an event its period falls back to 90 days.
    expect(periodStart('event', NOW, undefined)).toBe(periodStart('days90', NOW, undefined));
  });
});

describe('sortHistory', () => {
  const names = (sort: Parameters<typeof sortHistory>[1]) =>
    sortHistory(entries(), sort).map((entry) => entry.sighting.shipName);

  it('sorts by date, standard price or discount, in either direction', () => {
    expect(names('newest')).toEqual(['Hull C', 'Vulture', 'Mercury']);
    expect(names('oldest')).toEqual(['Mercury', 'Vulture', 'Hull C']);
    expect(names('priceDesc')).toEqual(['Hull C', 'Mercury', 'Vulture']);
    expect(names('priceAsc')).toEqual(['Vulture', 'Mercury', 'Hull C']);
    expect(names('discountDesc')).toEqual(['Hull C', 'Vulture', 'Mercury']);
    expect(names('discountAsc')).toEqual(['Mercury', 'Vulture', 'Hull C']);
  });
});
