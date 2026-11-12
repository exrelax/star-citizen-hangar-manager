import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import siteFile from '../../site/public/data/ships.json';
import { siteDataDue } from '@/site-data/sync-site-data';
import { EMPTY_META } from '@/storage/meta';
import { createShipFactsLookup, parseShipFacts, type ShipFacts } from './ship-facts';
import {
  bundledShipFacts,
  maybeRefreshShipFacts,
  shipFactsItem,
  storedShipFacts,
} from './sync-ship-facts';

const SOURCES = [
  { id: 'ship-matrix', name: 'RSI Ship Matrix', url: 'https://x', facts: ['id', 'status'] },
  {
    id: 'starcitizen-tools',
    name: 'Star Citizen Wiki',
    url: 'https://y',
    license: 'CC BY-SA 4.0',
    facts: ['alwaysAvailable', 'msrp'],
  },
];
const file = (ships: unknown[], extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  revision: 3,
  changedAt: '2026-11-12T04:17:00.000Z',
  generatedAt: '2026-11-14T04:17:00.000Z',
  sources: SOURCES,
  ships,
  ...extra,
});
const ballista = {
  id: 183,
  name: 'Ballista',
  manufacturer: 'Anvil Aerospace',
  wikiName: 'Ballista',
  status: [{ value: 'flight-ready', from: '2026-11-12' }],
  alwaysAvailable: [{ from: '2026-11-12' }],
  msrp: [
    { value: 135, from: '2026-11-12', to: '2026-11-13' },
    { value: 140, from: '2026-11-13' },
  ],
};
const clipper = {
  id: 230,
  name: 'Clipper',
  wikiName: 'Clipper',
  status: [{ value: 'flight-ready', from: '2026-11-12' }],
  alwaysAvailable: [{ from: '2026-11-12', to: '2026-11-13' }],
  msrp: [{ value: 150, from: '2026-11-12' }],
};
/** The wiki doesn't list it: whether it is always available is unknown. */
const merchantman = {
  id: 36,
  name: 'Merchantman',
  status: [{ value: 'in-concept', from: '2026-11-12' }],
  alwaysAvailable: [],
  msrp: [],
};

describe('parseShipFacts (#109)', () => {
  it('reads every field and period', () => {
    const facts = parseShipFacts(file([ballista]))!;
    expect(facts.ships).toEqual([ballista]);
    expect(facts.sources).toEqual(SOURCES);
    expect(facts.revision).toBe(3);
    expect(facts.changedAt).toBe('2026-11-12T04:17:00.000Z');
  });

  it('ignores files of another format, so the stored or bundled facts stay', () => {
    expect(parseShipFacts(file([ballista], { schemaVersion: 2 }))).toBeUndefined();
    expect(parseShipFacts(file([]))).toBeUndefined();
    expect(parseShipFacts('[]')).toBeUndefined();
    expect(parseShipFacts(null)).toBeUndefined();
  });

  it('leaves out invalid ships and periods', () => {
    const facts = parseShipFacts(
      file([
        {
          ...ballista,
          msrp: [
            { value: -5, from: '2026-11-12' },
            { value: 140, from: 'soon' },
          ],
        },
        { id: '183', name: 'Ballista' },
        { id: 1 },
      ]),
    )!;
    expect(facts.ships).toEqual([{ ...ballista, msrp: [] }]);
  });

  it('reads the file of the website and the bundled copy', () => {
    expect(parseShipFacts(siteFile)?.ships.length).toBeGreaterThan(150);
    expect(bundledShipFacts()?.ships.length).toBe(siteFile.ships.length);
  });
});

describe('createShipFactsLookup', () => {
  const lookup = createShipFactsLookup(parseShipFacts(file([ballista, clipper, merchantman]))!);

  it('tells whether a ship is always available, and since when', () => {
    expect(lookup.isAlwaysAvailable(183)).toBe(true);
    expect(lookup.alwaysAvailableSince(183)).toBe('2026-11-12');
    // It was, but no longer is.
    expect(lookup.isAlwaysAvailable(230)).toBe(false);
    expect(lookup.alwaysAvailableSince(230)).toBeUndefined();
  });

  it('doesn’t know for unknown ships, ships the source doesn’t list, or another source', () => {
    expect(lookup.isAlwaysAvailable(999)).toBeUndefined();
    expect(lookup.isAlwaysAvailable(36)).toBeUndefined();
    expect(lookup.isAlwaysAvailable(183, 'starcitizen-tools')).toBe(true);
    expect(lookup.isAlwaysAvailable(183, 'ship-matrix')).toBeUndefined();
  });

  it('gives the current status and standard price, the sources and the date of the list', () => {
    expect(lookup.status(36)).toBe('in-concept');
    expect(lookup.msrp(183)).toBe(140);
    expect(lookup.msrp(36)).toBeUndefined();
    expect(lookup.sources.map((source) => source.id)).toEqual(['ship-matrix', 'starcitizen-tools']);
    expect(lookup.changedAt).toBe('2026-11-12T04:17:00.000Z');
  });
});

describe('reading the ships’ facts', () => {
  const DAY = 24 * 60 * 60 * 1000;
  beforeEach(() => fakeBrowser.reset());

  it('is due once a day, a failed read again after the retry time', () => {
    const at = Date.parse('2026-11-12T12:00:00Z');
    const read = { ...EMPTY_META, checkedAt: at };
    expect(siteDataDue(read, at + DAY - 1, undefined, DAY)).toBe(false);
    expect(siteDataDue(read, at + DAY, undefined, DAY)).toBe(true);
    const failed = {
      ...read,
      lastOutcome: { ...read.lastOutcome!, at, status: 'failed' as const },
    };
    expect(siteDataDue(failed, at + 60 * 60 * 1000, undefined, DAY)).toBe(true);
  });

  it('stores what it reads and keeps it while the website can’t be read', async () => {
    const facts = parseShipFacts(file([ballista]))! as ShipFacts;
    await maybeRefreshShipFacts({ force: true, fetch: async () => facts });
    expect(storedShipFacts(await shipFactsItem.getValue())).toEqual(facts);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await maybeRefreshShipFacts({
      force: true,
      fetch: async () => {
        throw new Error('offline');
      },
    });
    warn.mockRestore();
    expect(storedShipFacts(await shipFactsItem.getValue())).toEqual(facts);
  });
});
