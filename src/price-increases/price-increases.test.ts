import { describe, expect, it } from 'vitest';
import siteFile from '../../site/public/data/price-increases.json';
import { endOf, parsePriceIncreases, upcomingPriceIncreases } from './price-increases';

const file = (priceIncreases: unknown[]) => ({ schemaVersion: 1, priceIncreases });
const galaxy = { id: 244, name: 'Galaxy' };

describe('parsePriceIncreases', () => {
  it('reads the file of the website', () => {
    const list = parsePriceIncreases(siteFile);
    expect(list).toBeDefined();
    expect(list).toHaveLength(siteFile.priceIncreases.length);
  });

  it('reads every field', () => {
    expect(
      parsePriceIncreases(
        file([
          {
            ship: { id: 163, name: 'M2 Hercules', aliases: ['Hercules Starlifter M2'] },
            flightReadyAt: '2026-11-13',
            priceIncreaseAt: '2026-11-16T16:00:00Z',
            relatedItems: [{ name: 'Example Module' }],
            event: 'iae-2956',
            note: { en: 'Expected with the IAE.', de: 'Erwartet mit der IAE.' },
          },
        ]),
      ),
    ).toEqual([
      {
        ship: { id: 163, name: 'M2 Hercules', aliases: ['Hercules Starlifter M2'] },
        flightReadyAt: { at: Date.parse('2026-11-13T00:00:00Z'), dayOnly: true },
        priceIncreaseAt: { at: Date.parse('2026-11-16T16:00:00Z') },
        relatedItems: [{ name: 'Example Module' }],
        event: 'iae-2956',
        note: { en: 'Expected with the IAE.', de: 'Erwartet mit der IAE.' },
      },
    ]);
  });

  it('ignores files of another format', () => {
    expect(parsePriceIncreases({ schemaVersion: 2, priceIncreases: [] })).toBeUndefined();
    expect(parsePriceIncreases({ schemaVersion: 1 })).toBeUndefined();
    expect(parsePriceIncreases('[]')).toBeUndefined();
    expect(parsePriceIncreases(null)).toBeUndefined();
  });

  it('leaves out entries without a valid ship or date', () => {
    const at = '2026-11-16';
    expect(
      parsePriceIncreases(
        file([
          { ship: { id: '244', name: 'Galaxy' }, priceIncreaseAt: at },
          { ship: { id: 0, name: 'Galaxy' }, priceIncreaseAt: at },
          { ship: { id: 244.5, name: 'Galaxy' }, priceIncreaseAt: at },
          { ship: { id: 244, name: ' ' }, priceIncreaseAt: at },
          { ship: galaxy },
          { ship: galaxy, priceIncreaseAt: 'soon' },
          // Without a zone the time would depend on the user's.
          { ship: galaxy, priceIncreaseAt: '2026-11-16T16:00:00' },
          { ship: galaxy, priceIncreaseAt: '2026-13-40' },
          { priceIncreaseAt: at },
          'Galaxy',
          null,
        ]),
      ),
    ).toEqual([]);
  });

  it('leaves out optional fields that don’t fit', () => {
    const [entry] = parsePriceIncreases(
      file([
        {
          ship: { ...galaxy, aliases: ['Galaxy', '', 42, 'RSI Galaxy', 'RSI Galaxy'] },
          priceIncreaseAt: '2026-11-13T16:00:00+00:00',
          flightReadyAt: 'next week',
          relatedItems: [
            { name: '' },
            'Galaxy Refinery Module',
            { name: 'Galaxy Refinery Module' },
          ],
          event: 7,
          note: { de: 'Nur Deutsch' },
          html: '<b>ignored</b>',
        },
      ]),
    )!;
    expect(entry).toEqual({
      ship: { ...galaxy, aliases: ['RSI Galaxy'] },
      priceIncreaseAt: { at: Date.parse('2026-11-13T16:00:00Z') },
      relatedItems: [{ name: 'Galaxy Refinery Module' }],
    });
  });

  it('reads a ship once per time', () => {
    const list = parsePriceIncreases(
      file([
        { ship: galaxy, priceIncreaseAt: '2026-11-13' },
        { ship: galaxy, priceIncreaseAt: '2026-11-13' },
        { ship: galaxy, priceIncreaseAt: '2026-11-20' },
      ]),
    );
    expect(list).toHaveLength(2);
  });
});

describe('upcomingPriceIncreases', () => {
  const list = parsePriceIncreases(
    file([
      { ship: { id: 2, name: 'Day' }, priceIncreaseAt: '2026-11-15' },
      { ship: { id: 1, name: 'Time' }, priceIncreaseAt: '2026-11-13T16:00:00Z' },
    ]),
  )!;

  it('keeps a time until it is reached and a day until it is over (UTC), the next first', () => {
    const names = (now: string) =>
      upcomingPriceIncreases(list, Date.parse(now)).map((entry) => entry.ship.name);
    expect(names('2026-11-10T12:00:00Z')).toEqual(['Time', 'Day']);
    expect(names('2026-11-13T16:00:00Z')).toEqual(['Day']);
    expect(names('2026-11-15T23:59:00Z')).toEqual(['Day']);
    expect(names('2026-11-16T00:00:00Z')).toEqual([]);
  });

  it('knows when a point in time is over', () => {
    expect(endOf({ at: 1000 })).toBe(1000);
    expect(endOf({ at: 1000, dayOnly: true })).toBe(1000 + 24 * 60 * 60 * 1000);
  });
});
