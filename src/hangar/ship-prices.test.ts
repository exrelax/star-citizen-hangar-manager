import { describe, expect, it } from 'vitest';
import { SHIPS_VERSION } from '@/ships/ships-storage';
import type { Pledge } from './pledge';
import { createPriceLookup, pledgeDiscount, shipPricesOf } from './ship-prices';

// Names and prices as listed by RSI's upgrade tool.
const priceOf = createPriceLookup([
  { name: 'Guardian', price: 250 },
  { name: 'Guardian QI', price: 260 },
  { name: 'Constellation Mk V Centaurus', price: 300 },
  { name: 'Mercury', price: 260 },
  { name: 'C2 Hercules', price: 400 },
  { name: 'M2 Hercules', price: 520 },
  { name: 'Asgard', price: 350 },
  { name: 'Aurora Mk I SE', price: 60 },
  { name: '600i Explorer', price: 475 },
  { name: 'F7C Hornet Mk I', price: 125 },
  { name: 'F7C-S Hornet Ghost Mk I', price: 140 },
  { name: 'F7C-S Hornet Ghost Mk II', price: 185 },
  { name: 'Ballista ', price: 140 },
  { name: 'Anvil Ballista Snowblind', price: 140 },
  { name: 'Anvil Ballista Dunestalker', price: 140 },
  { name: 'F7C-M Super Hornet Mk I', price: 180 },
  { name: 'F7C-M Super Hornet Heartseeker Mk I', price: 200 },
]);

const pledge = (overrides: Partial<Pledge>): Pledge =>
  ({ id: 1, valueUsd: 15, items: [], ...overrides }) as Pledge;

describe('createPriceLookup', () => {
  it('matches names exactly, ignoring case and punctuation', () => {
    expect(priceOf('Guardian QI')?.price).toBe(260);
    expect(priceOf('guardian-qi')?.price).toBe(260);
  });

  it('falls back to the one ship whose words all appear in the name', () => {
    expect(priceOf('Mercury Star Runner')?.name).toBe('Mercury');
    expect(priceOf('Hercules Starlifter C2')?.name).toBe('C2 Hercules');
    expect(priceOf('Guardian QI Wikelo Edition')?.name).toBe('Guardian QI');
  });

  it('falls back to the ship with the fewest extra words when the hangar name is shorter', () => {
    // Not the "F7C Hornet Mk I", although all of its words appear, too.
    expect(priceOf('F7C-M Hornet Heartseeker Mk I')?.price).toBe(200);
    expect(priceOf('F7C-M Super Hornet')?.price).toBe(180);
    // Two ships fit equally well: no guess.
    expect(priceOf('Hercules')).toBeUndefined();
  });

  it('takes the Mk I for names without a mark', () => {
    expect(priceOf('F7C-S Hornet Ghost')?.price).toBe(140);
  });

  it('prefers the base name over longer variants that fit as well', () => {
    expect(priceOf('Anvil Ballista')?.name).toBe('Ballista ');
  });

  it('knows ships the upgrade tool lists under another name', () => {
    expect(priceOf('600i Exploration Module')?.name).toBe('600i Explorer');
  });

  it('finds nothing for unknown ships and for extras of a ship', () => {
    expect(priceOf('Aurora Mk I LN')).toBeUndefined();
    expect(priceOf('Asgard - 2955 Best in Show Paint')).toBeUndefined();
    expect(priceOf('Mercury Star Runner Name Reservation')).toBeUndefined();
  });
});

describe('pledgeDiscount', () => {
  it('compares a CCU with the price difference of its ships', () => {
    // CCU #114810540: $15 for Guardian QI ($260) → Constellation Mk V Centaurus ($300).
    const ccu = pledge({
      upgrade: {
        type: 'R',
        matchItems: [{ id: 116618, name: 'Guardian QI' }],
        targetItems: [{ id: 141210, name: 'Constellation Mk V Centaurus' }],
      },
    });
    expect(pledgeDiscount(ccu, priceOf, false)).toMatchObject({
      original: 40,
      paid: 15,
      amount: 25,
      percent: 62.5,
    });
  });

  it('compares a pledge with one ship with the ship price, also when it cost more', () => {
    const ship = pledge({ valueUsd: 75, items: [{ title: 'Aurora Mk I SE', kind: 'Ship' }] });
    expect(pledgeDiscount(ship, priceOf, false)).toMatchObject({ amount: -15, percent: -25 });
  });

  it('leaves out packages with the game and pledges with several ships', () => {
    const items = [{ title: 'Mercury Star Runner', kind: 'Ship' }];
    expect(pledgeDiscount(pledge({ items }), priceOf, true)).toBeUndefined();
    const fleet = [...items, { title: 'Guardian', kind: 'Ship' }];
    expect(pledgeDiscount(pledge({ items: fleet }), priceOf, false)).toBeUndefined();
  });
});

describe('shipPricesOf', () => {
  it('takes the standard prices of the stored ships of the current format', () => {
    const ships = [{ id: 1, name: 'Mercury', msrp: 260 }];
    const fetchedAt = '2026-11-07T12:00:00Z';
    expect(shipPricesOf({ version: SHIPS_VERSION, fetchedAt, ships })).toEqual([
      { name: 'Mercury', price: 260 },
    ]);
    expect(shipPricesOf({ version: 0, fetchedAt, ships })).toEqual([]);
    expect(shipPricesOf(null)).toEqual([]);
  });
});
