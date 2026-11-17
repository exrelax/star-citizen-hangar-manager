import { describe, expect, it } from 'vitest';
import siteFile from '../../site/public/data/ship-removals.json';
import { parseShipRemovals, removalsByDate, upcomingShipRemovals } from './ship-removals';

const file = (shipRemovals: unknown[]) => ({ schemaVersion: 1, shipRemovals });
const SOURCE = 'https://robertsspaceindustries.com/comm-link/transmission/12345';
const hornet = {
  ship: { id: 15, name: 'F7C-M Super Hornet Mk I' },
  removedAt: '2026-11-27',
  source: SOURCE,
};

describe('parseShipRemovals', () => {
  it('reads the file of the website', () => {
    const list = parseShipRemovals(siteFile);
    expect(list).toBeDefined();
    expect(list).toHaveLength(siteFile.shipRemovals.length);
  });

  it('reads every field', () => {
    expect(
      parseShipRemovals(
        file([{ ...hornet, removedAt: '2026-11-27T16:00:00Z', event: 'iae-2956' }]),
      ),
    ).toEqual([
      {
        ship: { id: 15, name: 'F7C-M Super Hornet Mk I' },
        removedAt: { at: Date.parse('2026-11-27T16:00:00Z') },
        source: SOURCE,
        event: 'iae-2956',
      },
    ]);
  });

  it('reads a day without a time as the whole day (UTC)', () => {
    expect(parseShipRemovals(file([hornet]))?.[0]?.removedAt).toEqual({
      at: Date.parse('2026-11-27T00:00:00Z'),
      dayOnly: true,
    });
  });

  it('leaves out entries without what they need', () => {
    const invalid = [
      null,
      'F7C-M Super Hornet Mk I',
      { ...hornet, ship: undefined },
      { ...hornet, ship: { id: '15', name: 'F7C-M Super Hornet Mk I' } },
      { ...hornet, ship: { id: 0, name: 'F7C-M Super Hornet Mk I' } },
      { ...hornet, ship: { id: 1.5, name: 'F7C-M Super Hornet Mk I' } },
      { ...hornet, ship: { id: 15, name: ' ' } },
      { ...hornet, removedAt: undefined },
      { ...hornet, removedAt: 'soon' },
      // Without a zone the time would depend on the user's.
      { ...hornet, removedAt: '2026-11-27T16:00:00' },
      { ...hornet, removedAt: '2026-13-45' },
      { ...hornet, source: undefined },
      { ...hornet, source: 'http://robertsspaceindustries.com/comm-link' },
      { ...hornet, source: 'javascript:alert(1)' },
    ];
    expect(parseShipRemovals(file(invalid))).toEqual([]);
  });

  it('keeps an entry whose event doesn’t fit, without it', () => {
    expect(parseShipRemovals(file([{ ...hornet, event: 42 }]))?.[0]).not.toHaveProperty('event');
  });

  it('keeps the first entry of a ship', () => {
    const list = parseShipRemovals(file([hornet, { ...hornet, removedAt: '2026-12-01' }]));
    expect(list?.map((removal) => removal.removedAt.at)).toEqual([
      Date.parse('2026-11-27T00:00:00Z'),
    ]);
  });

  it('ignores files of another format', () => {
    expect(parseShipRemovals({ schemaVersion: 2, shipRemovals: [hornet] })).toBeUndefined();
    expect(parseShipRemovals({ schemaVersion: 1 })).toBeUndefined();
    expect(parseShipRemovals('<html>')).toBeUndefined();
  });
});

describe('upcomingShipRemovals', () => {
  const list = parseShipRemovals(
    file([
      { ...hornet, ship: { id: 2, name: 'Later' }, removedAt: '2026-12-10' },
      hornet,
      { ...hornet, ship: { id: 3, name: 'Earlier' }, removedAt: '2026-11-20T16:00:00Z' },
    ]),
  )!;

  it('lists the removals still ahead, the next first', () => {
    const now = Date.parse('2026-11-21T00:00:00Z');
    expect(upcomingShipRemovals(list, now).map((removal) => removal.ship.id)).toEqual([15, 2]);
  });

  it('counts a day without a time until its end, a time until then', () => {
    const lastMinute = Date.parse('2026-11-27T23:59:00Z');
    expect(upcomingShipRemovals(list, lastMinute).map((removal) => removal.ship.id)).toEqual([
      15, 2,
    ]);
    expect(upcomingShipRemovals(list, Date.parse('2026-11-28T00:00:00Z'))).toHaveLength(1);
    expect(upcomingShipRemovals(list, Date.parse('2026-11-20T16:00:00Z'))).toHaveLength(2);
  });
});

describe('removalsByDate', () => {
  const list = parseShipRemovals(
    file([
      { ...hornet, ship: { id: 47, name: 'Constellation Mk IV Aquila' }, removedAt: '2027-01-27' },
      {
        ...hornet,
        ship: { id: 45, name: 'Constellation Mk IV Andromeda' },
        removedAt: '2027-01-27',
      },
      // The same day with a time is another date: told apart.
      {
        ...hornet,
        ship: { id: 46, name: 'Constellation Mk IV Taurus' },
        removedAt: '2027-01-27T00:00:00Z',
      },
      hornet,
    ]),
  )!;

  it('groups the upcoming removals by date, the next first, the ships by name', () => {
    const groups = removalsByDate(list, Date.parse('2026-11-20T00:00:00Z'));
    expect(groups.map((group) => group.removals.map((removal) => removal.ship.id))).toEqual([
      [15],
      [46],
      [45, 47],
    ]);
    expect(groups[2]!.removedAt).toEqual({ at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true });
  });

  it('leaves out the dates that are past', () => {
    expect(
      removalsByDate(list, Date.parse('2027-01-27T12:00:00Z')).map(
        (group) => group.removals.length,
      ),
    ).toEqual([2]);
  });
});
