import { describe, expect, it } from 'vitest';
import { PLEDGE_STORE } from '@/config';
import type { StarCitizenEvent } from '@/events/events';
import type { Ship, WarbondSku } from '@/ships/ships';
import { offerHistory, recordWarbondOffers, WARBOND_HISTORY_VERSION } from './warbond-history';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-11-01T12:00:00Z');

const SHIPS: Ship[] = [
  { id: 1, name: 'Mercury', msrp: 260 },
  { id: 2, name: 'Vulture', msrp: 175 },
];
const mercury: WarbondSku = { shipId: 1, skuId: 10, price: 240 };
const vulture: WarbondSku = { shipId: 2, skuId: 20, price: 165 };

const IAE: StarCitizenEvent = {
  id: 'iae-2956',
  name: { en: 'IAE 2956' },
  eventStart: START + DAY,
  eventEnd: START + 10 * DAY,
  displayStart: START,
  displayEnd: START + 10 * DAY,
};

describe('recordWarbondOffers', () => {
  it('starts the history with the first read and keeps price, standard price and dates', () => {
    const history = recordWarbondOffers(null, [mercury], SHIPS, [], START);
    expect(history).toEqual({
      version: WARBOND_HISTORY_VERSION,
      lastReadAt: START,
      sightings: [
        {
          shipId: 1,
          skuId: 10,
          shipName: 'Mercury',
          price: 240,
          msrp: 260,
          firstSeen: START,
          lastSeen: START,
        },
      ],
    });
  });

  it('extends an offer found again by the next read, also after a gap without reads', () => {
    let history = recordWarbondOffers(null, [mercury], SHIPS, [], START);
    history = recordWarbondOffers(history, [mercury], SHIPS, [], START + 3 * DAY);
    expect(history.sightings).toHaveLength(1);
    expect(history.sightings[0]).toMatchObject({ firstSeen: START, lastSeen: START + 3 * DAY });
  });

  it('starts a new sighting for an offer that came back or changed its price', () => {
    let history = recordWarbondOffers(null, [mercury], SHIPS, [], START);
    history = recordWarbondOffers(history, [vulture], SHIPS, [], START + DAY);
    history = recordWarbondOffers(history, [mercury, vulture], SHIPS, [], START + 2 * DAY);
    history = recordWarbondOffers(
      history,
      [{ ...mercury, price: 230 }, vulture],
      SHIPS,
      [],
      START + 3 * DAY,
    );
    expect(
      history.sightings.map(({ shipName, price, firstSeen, lastSeen }) => [
        shipName,
        price,
        (firstSeen - START) / DAY,
        (lastSeen - START) / DAY,
      ]),
    ).toEqual([
      ['Mercury', 240, 0, 0],
      ['Vulture', 165, 1, 3],
      ['Mercury', 240, 2, 2],
      ['Mercury', 230, 3, 3],
    ]);
  });

  it('notes the events running at the reads that found an offer, each once', () => {
    let history = recordWarbondOffers(null, [mercury], SHIPS, [IAE], START);
    expect(history.sightings[0]!.events).toBeUndefined();
    history = recordWarbondOffers(history, [mercury], SHIPS, [IAE], START + 2 * DAY);
    history = recordWarbondOffers(history, [mercury], SHIPS, [IAE], START + 3 * DAY);
    expect(history.sightings[0]!.events).toEqual([{ id: 'iae-2956', name: { en: 'IAE 2956' } }]);
  });

  it('leaves out offers of unknown ships and ignores reads older than the last one', () => {
    const history = recordWarbondOffers(
      null,
      [mercury, { shipId: 99, skuId: 990, price: 50 }],
      SHIPS,
      [],
      START,
    );
    expect(history.sightings).toHaveLength(1);
    expect(recordWarbondOffers(history, [vulture], SHIPS, [], START)).toBe(history);
  });

  it('starts anew from a history of another format and keeps the newest sightings only', () => {
    const old = { version: 0, lastReadAt: START, sightings: [] };
    expect(recordWarbondOffers(old, [mercury], SHIPS, [], START).sightings).toHaveLength(1);

    let history = recordWarbondOffers(null, [], SHIPS, [], START);
    for (let read = 1; read <= PLEDGE_STORE.historyMax + 1; read++) {
      // Every other read without the offer: each one found is a new sighting.
      history = recordWarbondOffers(history, [mercury], SHIPS, [], START + read * 2);
      history = recordWarbondOffers(history, [], SHIPS, [], START + read * 2 + 1);
    }
    expect(history.sightings).toHaveLength(PLEDGE_STORE.historyMax);
    expect(history.sightings[0]!.firstSeen).toBe(START + 4);
  });
});

describe('offerHistory', () => {
  it('tells since when an offer is seen and lists the earlier ones of its ship, newest first', () => {
    let history = recordWarbondOffers(null, [mercury, vulture], SHIPS, [], START);
    history = recordWarbondOffers(history, [vulture], SHIPS, [], START + DAY);
    history = recordWarbondOffers(
      history,
      [{ ...mercury, price: 230 }],
      SHIPS,
      [],
      START + 2 * DAY,
    );
    history = recordWarbondOffers(history, [mercury], SHIPS, [IAE], START + 3 * DAY);

    const result = offerHistory(history, { shipId: 1, skuId: 10, price: 240 });
    expect(result.since).toBe(START + 3 * DAY);
    expect(result.events.map((event) => event.id)).toEqual(['iae-2956']);
    expect(result.earlier.map((sighting) => sighting.price)).toEqual([230, 240]);
  });

  it('knows nothing without a history', () => {
    expect(offerHistory(undefined, { shipId: 1, skuId: 10, price: 240 })).toEqual({
      events: [],
      earlier: [],
    });
  });
});
