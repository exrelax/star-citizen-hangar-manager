import { describe, expect, it } from 'vitest';
import siteFile from '../../site/public/data/warbond-history.json';
import { parseSiteWarbondHistory, withSiteSightings } from './site-warbond-history';
import { WARBOND_HISTORY_VERSION, type WarbondSighting } from './warbond-history';

const offer = {
  ship: { id: 178, name: 'Corsair' },
  price: 225,
  msrp: 250,
  firstSeen: '2026-09-10T16:00:00Z',
  lastSeen: '2026-09-17T16:00:00Z',
};

describe('parseSiteWarbondHistory', () => {
  it("reads the website's file", () => {
    expect(parseSiteWarbondHistory(siteFile)?.length).toBeGreaterThan(0);
  });

  it('reads an offer with its events, the SKU optional', () => {
    const [read] = parseSiteWarbondHistory({
      schemaVersion: 1,
      offers: [{ ...offer, events: [{ id: 'iae', name: { en: 'IAE', de: 'IAE de' } }, {}] }],
    })!;
    expect(read).toEqual({
      shipId: 178,
      skuId: 0,
      shipName: 'Corsair',
      price: 225,
      msrp: 250,
      firstSeen: Date.parse(offer.firstSeen),
      lastSeen: Date.parse(offer.lastSeen),
      events: [{ id: 'iae', name: { en: 'IAE', de: 'IAE de' } }],
    });
  });

  it('reads when an offer is expected to end (#568), ignoring an invalid or early one', () => {
    const read = parseSiteWarbondHistory({
      schemaVersion: 1,
      offers: [
        { ...offer, expectedEnd: '2026-10-10T16:00:00Z' },
        { ...offer, expectedEnd: 'soon' },
        { ...offer, expectedEnd: '2026-09-01T00:00:00Z' },
      ],
    })!;
    expect(read.map((sighting) => sighting.expectedEnd)).toEqual([
      Date.parse('2026-10-10T16:00:00Z'),
      undefined,
      undefined,
    ]);
    // The offer itself is read either way.
    expect(read).toHaveLength(3);
  });

  it('has the warbond offers of the ships flight ready at the IAE 2956 (#568)', () => {
    const offers = parseSiteWarbondHistory(siteFile)!.filter((sighting) =>
      sighting.events?.some((event) => event.id.endsWith('-flight-ready-iae-2956')),
    );
    expect(
      offers.map(({ shipId, price, msrp, firstSeen, expectedEnd }) => [
        shipId,
        msrp - price,
        new Date(firstSeen).toISOString().slice(0, 10),
        new Date(expectedEnd!).toISOString().slice(0, 10),
      ]),
    ).toEqual([
      [244, 40, '2026-11-13', '2026-12-13'],
      [224, 75, '2026-11-15', '2026-12-15'],
      [329, 15, '2026-11-17', '2026-12-17'],
      [330, 20, '2026-11-21', '2026-12-21'],
    ]);
  });

  it("leaves out offers that don't fit, and ignores files of another format", () => {
    const offers = parseSiteWarbondHistory({
      schemaVersion: 1,
      offers: [
        { ...offer, price: 260 },
        { ...offer, ship: { name: 'Corsair' } },
        { ...offer, lastSeen: '2026-09-01T00:00:00Z' },
        { ...offer, msrp: '250' },
        offer,
      ],
    });
    expect(offers).toHaveLength(1);
    expect(parseSiteWarbondHistory({ schemaVersion: 2, offers: [offer] })).toBeUndefined();
    expect(parseSiteWarbondHistory([])).toBeUndefined();
  });
});

describe('withSiteSightings', () => {
  const site = parseSiteWarbondHistory({ schemaVersion: 1, offers: [offer] })!;
  const own = (sighting: Partial<WarbondSighting>): WarbondSighting => ({
    ...site[0]!,
    skuId: 7,
    ...sighting,
  });

  it('adds the offers of the website as expired ones, also without an own history', () => {
    const merged = withSiteSightings(undefined, site)!;
    expect(merged.sightings).toEqual(site);
    expect(merged.lastReadAt).toBe(0);
    expect(withSiteSightings(undefined, [])).toBeUndefined();
  });

  it("keeps this browser's sighting of the same offer, sorted by first seen", () => {
    const at = Date.parse('2026-09-12T00:00:00Z');
    const history = {
      version: WARBOND_HISTORY_VERSION,
      lastReadAt: at + 1,
      sightings: [own({ firstSeen: at, lastSeen: at + 1 })],
    };
    expect(withSiteSightings(history, site)).toBe(history);
    // Another price, or another time: another offer.
    const other = {
      ...history,
      sightings: [own({ price: 200 }), own({ firstSeen: 1, lastSeen: 2 })],
    };
    expect(withSiteSightings(other, site)!.sightings.map((s) => s.price)).toEqual([225, 200, 225]);
  });
});
