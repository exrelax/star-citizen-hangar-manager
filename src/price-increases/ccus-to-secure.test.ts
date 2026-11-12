import { describe, expect, it } from 'vitest';
import type { Ship, ShipSku } from '@/ships/ships';
import { ccusToSecure, type SecureInput } from './ccus-to-secure';
import type { ExpectedPriceIncrease } from './price-increases';

const NOW = Date.parse('2026-11-12T12:00:00Z');

const prospector: ExpectedPriceIncrease = {
  ship: { id: 109, name: 'Prospector' },
  priceIncreaseAt: { at: Date.parse('2026-11-19T16:00:00Z') },
  price: { from: 155, to: 175 },
};
/** Becomes flight ready: not on sale before, rises by an unknown amount. */
const galaxy: ExpectedPriceIncrease = {
  ship: { id: 244, name: 'Galaxy' },
  priceIncreaseAt: { at: Date.parse('2026-11-13T16:00:00Z') },
};
const vulture: ExpectedPriceIncrease = {
  ship: { id: 165, name: 'Vulture' },
  priceIncreaseAt: { at: Date.parse('2026-11-20T16:00:00Z') },
};

const ships: Ship[] = [
  { id: 109, name: 'Prospector', msrp: 155 },
  { id: 244, name: 'Galaxy', msrp: 380 },
  { id: 165, name: 'Vulture', msrp: 175 },
  { id: 32, name: 'Freelancer MAX', msrp: 150 },
  { id: 33, name: 'Clipper', msrp: 150 },
  { id: 34, name: 'Ballista', msrp: 140 },
  { id: 35, name: 'Arrow', msrp: 75 },
];
const sku = (shipId: number, skuId = shipId): ShipSku => ({
  shipId,
  skuId,
  title: 'Standard Edition',
  price: 1,
});

const secure = (extra: Partial<SecureInput> = {}) =>
  ccusToSecure({
    increases: [prospector, galaxy, vulture],
    ships,
    buyable: [sku(109), sku(165)],
    warbonds: [],
    now: NOW,
    ...extra,
  });

describe('ccusToSecure (#253)', () => {
  it('lists the cheapest CCUs to each ship on sale whose price will rise, the next first', () => {
    const [first, second] = secure();
    expect(first).toMatchObject({ ship: { name: 'Prospector' }, skuId: 109, price: 155, gain: 20 });
    // The most expensive base ships first (the cheapest CCUs); the Vulture rises itself.
    expect(first?.bases.map((base) => [base.ship.name, base.ccuPrice])).toEqual([
      ['Clipper', 5],
      ['Freelancer MAX', 5],
      ['Ballista', 15],
      ['Arrow', 80],
    ]);
    // Without a known new price: no gain.
    expect(second?.ship.name).toBe('Vulture');
    expect(second?.gain).toBeUndefined();
    expect(second?.bases.map((base) => base.ship.name)).not.toContain('Prospector');
  });

  it('leaves out ships RSI doesn’t sell CCUs to, also only as warbond', () => {
    expect(secure().map((offer) => offer.ship.name)).not.toContain('Galaxy');
    const warbondOnly = secure({
      buyable: [sku(109, 900)],
      warbonds: [{ shipId: 109, skuId: 900, price: 140 }],
    });
    expect(warbondOnly).toEqual([]);
  });

  it('counts what the user has of each base ship', () => {
    const holdings = new Map([
      [32, { hangarShips: 1, hangarCcus: 3, buybackShips: 0, buybackCcus: 2 }],
    ]);
    const [first] = secure({ holdings });
    expect(first?.bases.find((base) => base.ship.id === 32)?.holdings).toEqual({
      hangarShips: 1,
      hangarCcus: 3,
      buybackShips: 0,
      buybackCcus: 2,
    });
  });

  it('finds the ship by name where the upgrade tool has another id', () => {
    const otherIds = ships.map((ship) => (ship.id === 109 ? { ...ship, id: 9109 } : ship));
    const [first] = secure({ ships: otherIds, buyable: [sku(9109), sku(165)] });
    expect(first).toMatchObject({ ship: { id: 9109, name: 'Prospector' }, skuId: 9109 });
  });

  it('is gone once the price increase is past', () => {
    expect(secure({ now: Date.parse('2026-11-21T00:00:00Z') })).toEqual([]);
  });
});
