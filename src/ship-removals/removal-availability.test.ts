import { describe, expect, it } from 'vitest';
import type { StarCitizenEvent } from '@/events/events';
import {
  limitedSaleNote,
  limitedSales,
  limitedSaleText,
  obtainableRemovals,
} from './removal-availability';
import type { ShipRemoval } from './ship-removals';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const removal = (id: number, name: string): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
  source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
});
const ANDROMEDA = removal(45, 'Constellation Mk IV Andromeda');
const AQUILA = removal(47, 'Constellation Mk IV Aquila');
const TAURUS = removal(46, 'Constellation Mk IV Taurus');
const IAE: StarCitizenEvent = {
  id: 'iae-2956',
  name: { en: 'Intergalactic Aerospace Expo 2956' },
  eventStart: Date.parse('2026-11-13T16:00:00Z'),
  eventEnd: Date.parse('2026-11-27T20:00:00Z'),
  displayStart: Date.parse('2026-11-06T16:00:00Z'),
  displayEnd: Date.parse('2026-11-27T20:00:00Z'),
};

// Andromeda: on sale, not always available. Aquila: on sale, always available. Taurus: not on sale.
const input = (overrides = {}) => ({
  removals: [ANDROMEDA, AQUILA, TAURUS],
  onSale: new Set([45, 47]),
  alwaysAvailable: (id: number) => (id === 47 ? true : id === 45 ? false : undefined),
  events: [] as StarCitizenEvent[],
  now: NOW,
  ...overrides,
});

describe('limitedSales', () => {
  it('finds the ships on sale now that aren’t always available', () => {
    expect([...limitedSales(input()).keys()]).toEqual([45]);
  });

  it('tells nothing without data on always available ships or on the ships on sale', () => {
    expect(limitedSales(input({ alwaysAvailable: () => undefined })).size).toBe(0);
    expect(limitedSales(input({ onSale: new Set() })).size).toBe(0);
  });

  it('names the event running now, not one to come or past', () => {
    expect(limitedSales(input({ events: [IAE] })).get(45)).toEqual({
      event: { name: IAE.name, end: IAE.eventEnd },
    });
    expect(limitedSales(input({ events: [IAE], now: IAE.eventEnd })).get(45)).toEqual({});
    expect(limitedSales(input({ events: [IAE], now: IAE.eventStart - 1 })).get(45)).toEqual({});
  });
});

describe('limitedSaleText', () => {
  it('tells one ship, with and without an event', () => {
    expect(limitedSaleText(['Constellation Mk IV Andromeda'], {}, 'en')).toBe(
      "The Constellation Mk IV Andromeda is on sale right now, but isn't one of the always available ships.",
    );
    expect(
      limitedSaleText(
        ['Constellation Mk IV Andromeda'],
        { event: { name: IAE.name, end: IAE.eventEnd } },
        'en',
      ),
    ).toMatch(
      /It may not be on sale any more once Intergalactic Aerospace Expo 2956 ends on November 27, 2026\.$/,
    );
  });

  it('tells several ships together', () => {
    const sales = limitedSales(input({ alwaysAvailable: () => false }));
    expect(limitedSaleNote([ANDROMEDA, AQUILA, TAURUS], sales, 'en')).toBe(
      "The Constellation Mk IV Andromeda and Constellation Mk IV Aquila are on sale right now, but aren't among the always available ships.",
    );
    expect(limitedSaleNote([TAURUS], sales, 'en')).toBeUndefined();
  });
});

describe('obtainableRemovals (#454)', () => {
  it('keeps the ships on sale now or always available, by ship id', () => {
    const result = obtainableRemovals(input());
    expect([...result.keys()]).toEqual([45, 47]);
    expect(result.get(45)).toBe(ANDROMEDA);
  });

  it('keeps an always available ship that isn’t on sale right now', () => {
    expect([...obtainableRemovals(input({ onSale: new Set() })).keys()]).toEqual([47]);
  });
});
