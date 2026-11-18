import { describe, expect, it } from 'vitest';
import type { Ship } from '@/ships/ships';
import { removalCcus, removalLevel, type RemovalCcusInput } from './removal-ccus';
import type { ShipRemoval } from './ship-removals';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const SOURCE = 'https://robertsspaceindustries.com/en/comm-link/transmission/21350';

const removal = (id: number, name: string, removedAt = '2027-01-27T00:00:00Z'): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at: Date.parse(removedAt), dayOnly: true },
  source: SOURCE,
});
const ANDROMEDA = removal(45, 'Constellation Mk IV Andromeda');
const TAURUS = removal(46, 'Constellation Mk IV Taurus');

const ship = (id: number, name: string, msrp: number): Ship => ({ id, name, msrp });
const SHIPS = [
  ship(45, 'Constellation Mk IV Andromeda', 240),
  ship(46, 'Constellation Mk IV Taurus', 190),
  ship(4, 'Cutlass Black', 110),
  ship(325, 'Constellation Mk V Centaurus', 350),
];

/** A CCU of My Hangar: RSI names its ships in the upgrade data, the old names. */
const hangarCcu = (id: number, from: string, to: string) => ({
  id,
  title: `Upgrade - ${from} to ${to}`,
  isCcu: true,
  upgrade: {
    matchItems: [{ id: 1, name: from }],
    targetItems: [{ id: 2, name: to }],
    type: 'R',
  },
});
/** A CCU of the buy back, with the upgrade tool's ids of its "Buy Back" button. */
const buybackCcu = (id: number, from: number, to: number, title: string) => ({
  id,
  title,
  isCcu: true,
  upgrade: { fromShipId: from, toShipId: to, toSkuId: 1 },
});

const input = (overrides: Partial<RemovalCcusInput>): RemovalCcusInput => ({
  removals: [ANDROMEDA],
  ships: SHIPS,
  hangar: [],
  buyback: [],
  now: NOW,
  ...overrides,
});
const counts = (entries: ReturnType<typeof removalCcus>) =>
  entries.map(({ removal: { ship }, from, to, level }) => ({
    ship: ship.id,
    from: from.length,
    to: to.length,
    level,
  }));

describe('removalLevel', () => {
  it('warns while there are at least as many CCUs to the ship as from it', () => {
    expect(removalLevel(0, 0)).toBeUndefined();
    expect(removalLevel(0, 3)).toBeUndefined();
    expect(removalLevel(2, 2)).toBe('warning');
    expect(removalLevel(1, 3)).toBe('warning');
    expect(removalLevel(2, 1)).toBe('critical');
    expect(removalLevel(1, 0)).toBe('critical');
  });
});

describe('removalCcus', () => {
  it('lists every removal, also without CCUs', () => {
    expect(counts(removalCcus(input({ removals: [TAURUS, ANDROMEDA] })))).toEqual([
      { ship: 46, from: 0, to: 0, level: undefined },
      { ship: 45, from: 0, to: 0, level: undefined },
    ]);
  });

  it('is critical with CCUs from the ship and fewer to it', () => {
    const result = removalCcus(
      input({
        hangar: [
          hangarCcu(1, 'Constellation Andromeda', 'Constellation Mk V Centaurus'),
          hangarCcu(2, 'Constellation Andromeda', 'Constellation Mk V Centaurus'),
          hangarCcu(3, 'Cutlass Black', 'Constellation Andromeda'),
        ],
      }),
    );
    expect(counts(result)).toEqual([{ ship: 45, from: 2, to: 1, level: 'critical' }]);
    expect(result[0]!.to).toEqual([
      { source: 'hangar', id: 3, title: 'Upgrade - Cutlass Black to Constellation Andromeda' },
    ]);
  });

  it('warns with as many CCUs to the ship, from the hangar and the buy back together', () => {
    const result = removalCcus(
      input({
        hangar: [
          hangarCcu(1, 'Constellation Andromeda', 'Constellation Mk V Centaurus'),
          hangarCcu(2, 'Constellation Andromeda', 'Constellation Mk V Centaurus'),
          hangarCcu(3, 'Cutlass Black', 'Constellation Andromeda'),
        ],
        buyback: [
          buybackCcu(10, 4, 45, 'Upgrade - Cutlass Black to Constellation Andromeda'),
          // The buy back's title may use another name: its button's ids count.
          buybackCcu(11, 45, 325, 'Upgrade - Connie to Centaurus'),
          buybackCcu(12, 4, 45, 'Upgrade - Cutlass Black to Constellation Andromeda'),
        ],
      }),
    );
    expect(counts(result)).toEqual([{ ship: 45, from: 3, to: 3, level: 'warning' }]);
    expect(result[0]!.from.map(({ source, id }) => `${source} ${id}`)).toEqual([
      'hangar 1',
      'hangar 2',
      'buyback 11',
    ]);
  });

  it('counts the CCUs from the ship in the hangar only for the level', () => {
    const result = removalCcus(
      input({
        hangar: [hangarCcu(1, 'Constellation Andromeda', 'Constellation Mk V Centaurus')],
        buyback: [
          buybackCcu(10, 45, 325, 'Upgrade - Constellation Andromeda to Centaurus'),
          buybackCcu(11, 45, 325, 'Upgrade - Constellation Andromeda to Centaurus'),
          buybackCcu(12, 4, 45, 'Upgrade - Cutlass Black to Constellation Andromeda'),
        ],
      }),
    );
    // 3 from it (1 owned), 1 to it: enough for the one in the hangar.
    expect(counts(result)).toEqual([{ ship: 45, from: 3, to: 1, level: 'warning' }]);
    const buybackOnly = removalCcus(
      input({
        buyback: [buybackCcu(10, 45, 325, 'Upgrade - Constellation Andromeda to Centaurus')],
      }),
    );
    expect(counts(buybackOnly)).toEqual([{ ship: 45, from: 1, to: 0, level: undefined }]);
  });

  it('counts only CCUs, not pledges with the ship itself', () => {
    const result = removalCcus(
      input({
        hangar: [
          { id: 1, title: 'Constellation Andromeda', isCcu: false },
          hangarCcu(2, 'Constellation Andromeda', 'Constellation Mk V Centaurus'),
        ],
        buyback: [{ id: 10, title: 'Package - Constellation Andromeda', isCcu: false }],
      }),
    );
    expect(counts(result)).toEqual([{ ship: 45, from: 1, to: 0, level: 'critical' }]);
  });

  it('leaves out buy back CCUs RSI can’t sell again', () => {
    const unavailable = {
      ...buybackCcu(
        10,
        325,
        45,
        'Upgrade - Constellation Mk V Centaurus to Constellation Andromeda',
      ),
      unavailable: {
        from: { name: 'Constellation Mk V Centaurus', msrp: 350 },
        to: { name: 'Constellation Mk IV Andromeda', msrp: 240 },
      },
    };
    const result = removalCcus(
      input({
        hangar: [hangarCcu(1, 'Constellation Andromeda', 'Constellation Mk V Centaurus')],
        buyback: [unavailable],
      }),
    );
    expect(counts(result)).toEqual([{ ship: 45, from: 1, to: 0, level: 'critical' }]);
  });

  it('matches by the removals’ own names without the upgrade tool’s ships', () => {
    const result = removalCcus(
      input({
        ships: [],
        hangar: [
          hangarCcu(1, 'Constellation Andromeda', 'Cutlass Black'),
          hangarCcu(2, 'Constellation Taurus', 'Cutlass Black'),
        ],
        buyback: [buybackCcu(10, 4, 46, 'Upgrade - Cutlass Black to Constellation Taurus')],
        removals: [ANDROMEDA, TAURUS],
      }),
    );
    expect(counts(result)).toEqual([
      { ship: 45, from: 1, to: 0, level: 'critical' },
      { ship: 46, from: 1, to: 1, level: 'warning' },
    ]);
  });

  it('reads the ships of a CCU from its title without upgrade data', () => {
    const result = removalCcus(
      input({
        hangar: [
          { id: 1, title: 'Upgrade - Constellation Andromeda to Cutlass Black', isCcu: true },
        ],
      }),
    );
    expect(counts(result)).toEqual([{ ship: 45, from: 1, to: 0, level: 'critical' }]);
  });

  it('leaves out removals that are past', () => {
    const past = removal(46, 'Constellation Mk IV Taurus', '2026-11-01T00:00:00Z');
    expect(counts(removalCcus(input({ removals: [past, ANDROMEDA] })))).toEqual([
      { ship: 45, from: 0, to: 0, level: undefined },
    ]);
  });
});
