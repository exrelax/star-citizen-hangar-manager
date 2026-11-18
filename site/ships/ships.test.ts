import { describe, expect, it } from 'vitest';
import {
  brokenReason,
  continueFile,
  isRetired,
  matchVehicles,
  observe,
  parseShipMatrix,
  parseWiki,
  serialize,
  type MatrixShip,
  type ShipsFile,
  type WikiVehicle,
} from './ships.ts';

const MATRIX: MatrixShip[] = [
  { id: 44, name: 'C8R Pisces', manufacturer: 'Anvil Aerospace', status: 'flight-ready' },
  { id: 70, name: 'Dragonfly Black', status: 'flight-ready' },
  { id: 71, name: 'Dragonfly Yellowjacket', status: 'flight-ready' },
  { id: 157, name: 'Ballista', manufacturer: 'Anvil Aerospace', status: 'flight-ready' },
  { id: 189, name: 'Freelancer MAX', manufacturer: 'MISC', status: 'flight-ready' },
  { id: 224, name: 'Liberator', manufacturer: 'Anvil Aerospace', status: 'in-concept' },
];
const WIKI: WikiVehicle[] = [
  { name: 'C8R Pisces Rescue', alwaysAvailable: true, retired: false, msrp: 65 },
  { name: 'Dragonfly', alwaysAvailable: true, retired: false, msrp: 40 },
  { name: 'Ballista', alwaysAvailable: true, retired: false, msrp: 140 },
  { name: 'Ballista Snowblind', alwaysAvailable: false, retired: false, msrp: 150 },
  { name: 'Freelancer Max', alwaysAvailable: true, retired: false, msrp: 150 },
  { name: 'Liberator', alwaysAvailable: false, retired: false, msrp: 575 },
];

const DAY1 = '2026-11-12T04:17:00.000Z';
const DAY2 = '2026-11-13T04:17:00.000Z';
const DAY3 = '2026-11-14T04:17:00.000Z';

const run = (previous: ShipsFile | undefined, wiki: WikiVehicle[], now: string, matrix = MATRIX) =>
  continueFile(previous, observe(matrix, wiki, previous).observations, now);

describe('parsing (#107)', () => {
  it('reads the wiki’s vehicles with availability and price, each once', () => {
    expect(
      parseWiki({
        bucket: [
          { page_name: 'Ballista', pledge_availability: 'Always available', pledge_price: 140 },
          { page_name: 'Ballista', pledge_availability: 'Time-limited sales' },
          { page_name: 'Polaris ', pledge_availability: 'Time-limited sales', pledge_price: 0 },
          { pledge_availability: 'Always available' },
        ],
      }),
    ).toEqual([
      { name: 'Ballista', alwaysAvailable: true, retired: false, msrp: 140 },
      { name: 'Polaris', alwaysAvailable: false, retired: false },
    ]);
  });

  it("reads the ships RSI doesn't sell any more in any way (#385)", () => {
    for (const value of [
      'Retired',
      'Out of production',
      'Out of production*',
      'Limited edition (No longer available)',
      '(No longer available)',
    ]) {
      expect(isRetired(value), value).toBe(true);
    }
    for (const value of [
      'Always available',
      'Time-limited sales',
      'Not available for sale',
      '[https://robertsspaceindustries.com/en/comm-link/transmission/21336 Retiring]',
      undefined,
    ]) {
      expect(isRetired(value), String(value)).toBe(false);
    }
  });

  it('reads the Ship Matrix’s ids, names, manufacturers and status', () => {
    expect(
      parseShipMatrix({
        data: [
          {
            id: 1,
            name: 'Aurora Mk I ES ',
            manufacturer: { name: 'RSI' },
            production_status: 'flight-ready',
          },
          { name: 'no id' },
        ],
      }),
    ).toEqual([{ id: 1, name: 'Aurora Mk I ES', manufacturer: 'RSI', status: 'flight-ready' }]);
  });

  it('fails without data', () => {
    expect(() => parseWiki({ error: { code: 'ratelimited' } })).toThrow();
    expect(() => parseShipMatrix({ data: [] })).toThrow();
  });
});

describe('matchVehicles', () => {
  it('matches exactly first, then the only ship either name contains', () => {
    const { byId, unmatched } = matchVehicles(MATRIX, WIKI);
    expect(byId.get(157)?.name).toBe('Ballista');
    expect(byId.get(189)?.name).toBe('Freelancer Max');
    expect(byId.get(44)?.name).toBe('C8R Pisces Rescue');
    // Ambiguous ("Dragonfly"), or a variant of a ship that already has its exact match.
    expect(unmatched).toEqual(['Ballista Snowblind', 'Dragonfly']);
  });
});

describe('continueFile', () => {
  it('starts every period on the first run', () => {
    const { file, changed } = run(undefined, WIKI, DAY1);
    expect(changed).toBe(true);
    expect(file.revision).toBe(1);
    expect(file.ships.find((ship) => ship.id === 157)).toEqual({
      id: 157,
      name: 'Ballista',
      manufacturer: 'Anvil Aerospace',
      wikiName: 'Ballista',
      status: [{ value: 'flight-ready', from: '2026-11-12' }],
      alwaysAvailable: [{ from: '2026-11-12' }],
      msrp: [{ value: 140, from: '2026-11-12' }],
      retired: [],
    });
    expect(file.ships.find((ship) => ship.id === 224)?.alwaysAvailable).toEqual([]);
  });

  it('keeps the revision while nothing changes', () => {
    const first = run(undefined, WIKI, DAY1).file;
    const { file, changed } = run(first, WIKI, DAY2);
    expect(changed).toBe(false);
    expect(file.revision).toBe(1);
    expect(file.changedAt).toBe(DAY1);
    expect(file.generatedAt).toBe(DAY2);
  });

  it('ends and opens periods when the availability, the price or the status changes', () => {
    const first = run(undefined, WIKI, DAY1).file;
    const wiki = WIKI.map((vehicle) =>
      vehicle.name === 'Ballista'
        ? { ...vehicle, alwaysAvailable: false }
        : vehicle.name === 'Liberator'
          ? { ...vehicle, msrp: 600 }
          : vehicle,
    );
    const matrix = MATRIX.map((ship) =>
      ship.id === 224 ? { ...ship, status: 'flight-ready' } : ship,
    );
    const { file, changed } = run(first, wiki, DAY2, matrix);
    expect(changed).toBe(true);
    expect(file.revision).toBe(2);
    expect(file.changedAt).toBe(DAY2);
    const ballista = file.ships.find((ship) => ship.id === 157)!;
    expect(ballista.alwaysAvailable).toEqual([{ from: '2026-11-12', to: '2026-11-13' }]);
    const liberator = file.ships.find((ship) => ship.id === 224)!;
    expect(liberator.msrp).toEqual([
      { value: 575, from: '2026-11-12', to: '2026-11-13' },
      { value: 600, from: '2026-11-13' },
    ]);
    expect(liberator.status).toEqual([
      { value: 'in-concept', from: '2026-11-12', to: '2026-11-13' },
      { value: 'flight-ready', from: '2026-11-13' },
    ]);
    // Always available again: a new period.
    const again = run(file, WIKI, DAY3, matrix).file.ships.find((ship) => ship.id === 157)!;
    expect(again.alwaysAvailable).toEqual([
      { from: '2026-11-12', to: '2026-11-13' },
      { from: '2026-11-14' },
    ]);
  });

  it('keeps what a source doesn’t tell, and ships gone from the Ship Matrix', () => {
    // Without its own wiki vehicle, the Ballista isn't matched with a variant ("Ballista
    // Snowblind") either: it counts as not seen.
    const first = run(undefined, WIKI, DAY1).file;
    // The wiki no longer lists the Ballista, and the Ship Matrix drops the Liberator.
    const { file } = run(
      first,
      WIKI.filter((vehicle) => vehicle.name !== 'Ballista'),
      DAY2,
      MATRIX.filter((ship) => ship.id !== 224),
    );
    expect(file.ships.find((ship) => ship.id === 157)?.alwaysAvailable).toEqual([
      { from: '2026-11-12' },
    ]);
    expect(file.ships.find((ship) => ship.id === 224)).toEqual(
      first.ships.find((ship) => ship.id === 224),
    );
  });
});

describe('retired ships (#385)', () => {
  it('opens a period when the wiki retires a ship, and continues a file without the fact', () => {
    const first = run(undefined, WIKI, DAY1).file;
    // A file of before #385: no `retired` yet.
    const old = {
      ...first,
      ships: first.ships.map((ship) => {
        const copy = { ...ship };
        delete copy.retired;
        return copy;
      }),
    } as ShipsFile;
    const wiki = WIKI.map((vehicle) =>
      vehicle.name === 'Ballista' ? { ...vehicle, retired: true } : vehicle,
    );
    const { file, changed } = run(old, wiki, DAY2);
    expect(changed).toBe(true);
    expect(file.ships.find((ship) => ship.id === 157)?.retired).toEqual([{ from: '2026-11-13' }]);
    expect(file.ships.find((ship) => ship.id === 224)?.retired).toEqual([]);
  });
});

describe('brokenReason', () => {
  const many = <T>(count: number, make: (index: number) => T) =>
    Array.from({ length: count }, (_, index) => make(index));
  const matrix = many(200, (id) => ({ id, name: `Ship ${id}` }));
  const wiki = many(200, (index) => ({
    name: `Ship ${index}`,
    alwaysAvailable: index < 40,
    retired: false,
  }));

  it('accepts complete sources', () => {
    expect(brokenReason(matrix, wiki, undefined)).toBeUndefined();
    expect(brokenReason(matrix, wiki, run(undefined, wiki, DAY1, matrix).file)).toBeUndefined();
  });

  it('rejects an empty or far shorter answer, e.g. a throttled wiki', () => {
    expect(brokenReason(matrix, [], undefined)).toBeDefined();
    expect(brokenReason(matrix.slice(0, 100), wiki, undefined)).toBeDefined();
    const previous = run(undefined, wiki, DAY1, matrix).file;
    const fewer = wiki.map((vehicle, index) => ({ ...vehicle, alwaysAvailable: index < 25 }));
    expect(brokenReason(matrix, fewer, previous)).toMatch(/always available/);
  });
});

describe('serialize', () => {
  it('writes one ship per line, fields in a fixed order, and reads back the same', () => {
    const { file } = run(undefined, WIKI, DAY1);
    const text = serialize(file);
    expect(text).toContain(
      '    {"id":157,"name":"Ballista","manufacturer":"Anvil Aerospace","wikiName":"Ballista","status":[{"value":"flight-ready","from":"2026-11-12"}],"alwaysAvailable":[{"from":"2026-11-12"}],"msrp":[{"value":140,"from":"2026-11-12"}],"retired":[]}',
    );
    expect(JSON.parse(text)).toEqual(file);
  });
});
