import { describe, expect, it } from 'vitest';
import type { BuybackPledge } from '@/buyback/buyback';
import type { Pledge } from '@/hangar/pledge';
import { createPriceLookup } from '@/hangar/ship-prices';
import { ccuPriceChange } from './ccu-price-change';
import { createPriceIncreaseMatcher } from './price-increase-match';
import type { ExpectedPriceIncrease } from './price-increases';

const NOW = Date.parse('2026-11-10T12:00:00Z');

/** The example of #248: the Prospector rises from $155 to $175. */
const prospector: ExpectedPriceIncrease = {
  ship: { id: 109, name: 'Prospector' },
  priceIncreaseAt: { at: Date.parse('2026-11-19T16:00:00Z') },
  price: { from: 155, to: 175 },
};
/** Rises without a known new price, like ships that become flight ready. */
const galaxy: ExpectedPriceIncrease = {
  ship: { id: 244, name: 'Galaxy' },
  priceIncreaseAt: { at: Date.parse('2026-11-13T16:00:00Z') },
  relatedItems: [{ name: 'Galaxy Cargo Module' }],
};

const priceOf = createPriceLookup([
  { name: 'Prospector', price: 155 },
  { name: 'Vulture', price: 175 },
  { name: 'Cutlass Black', price: 135 },
  { name: 'Freelancer MAX', price: 170 },
  { name: 'Galaxy', price: 400 },
  { name: 'Carrack', price: 600 },
]);
const matcher = createPriceIncreaseMatcher([prospector, galaxy], NOW);

const ccu = (from: string, to: string, valueUsd: number): Pledge => ({
  id: 1,
  name: `Upgrade - ${from} to ${to}`,
  title: `Upgrade - ${from} to ${to}`,
  value: `$${valueUsd}.00 USD`,
  valueUsd,
  configurationValue: '',
  currency: 'Store Credit',
  availability: 'Attributed',
  contains: '',
  isLastAlpha: false,
  isBuybackable: true,
  isGiftable: true,
  isExchangeable: true,
  isUpgradeable: false,
  isUpgraded: false,
  upgrade: {
    matchItems: [{ id: 1, name: from }],
    targetItems: [{ id: 2, name: to }],
    type: 'R',
  },
  nameReservations: null,
  nameableShips: null,
  items: [{ title: `Upgrade - ${from} to ${to}` }],
});
const buybackCcu = (title: string, upgrade?: BuybackPledge['upgrade']): BuybackPledge => ({
  id: 2,
  title,
  contained: title.replace(/^Upgrade - /, ''),
  isUpgrade: true,
  ...(upgrade && { upgrade }),
});

describe('hangarCcu (#250)', () => {
  it('loses upgrade value when the base ship rises, down to $0', () => {
    // CCUs Prospector → Vulture for $5 each: $20 upgrade value today, $0 after.
    expect(matcher.hangarCcu(ccu('Prospector', 'Vulture', 5), priceOf)).toEqual({
      base: prospector,
      direction: 'loses',
      amounts: { before: 20, after: 0, change: -20, discountBefore: 15, discountAfter: -5 },
    });
  });

  it('gains upgrade value when the target ship rises', () => {
    expect(matcher.hangarCcu(ccu('Cutlass Black', 'Prospector', 15), priceOf)).toEqual({
      target: prospector,
      direction: 'gains',
      amounts: { before: 20, after: 40, change: 20, discountBefore: 5, discountAfter: 25 },
    });
  });

  it('keeps an upgrade value below $0: the CCU stays applicable', () => {
    const cheap = createPriceLookup([
      { name: 'Prospector', price: 155 },
      { name: 'Cutlass Red', price: 160 },
    ]);
    expect(matcher.hangarCcu(ccu('Prospector', 'Cutlass Red', 5), cheap)?.amounts).toEqual({
      before: 5,
      after: -15,
      change: -20,
      discountBefore: 0,
      discountAfter: -20,
    });
  });

  it('knows only the direction without a new price', () => {
    expect(matcher.hangarCcu(ccu('Galaxy', 'Carrack', 200), priceOf)).toEqual({
      base: galaxy,
      direction: 'loses',
    });
    // A module rises with its ship, but the increase's price is the ship's.
    expect(matcher.hangarCcu(ccu('Carrack', 'Galaxy Cargo Module', 20), priceOf)).toEqual({
      target: galaxy,
      direction: 'gains',
    });
  });

  it('knows only the direction without the other ship’s price', () => {
    expect(matcher.hangarCcu(ccu('Prospector', 'Unknown Ship', 5), priceOf)).toEqual({
      base: prospector,
      direction: 'loses',
    });
  });

  it('takes the increase’s old price if the upgrade tool doesn’t know the ship', () => {
    const withoutProspector = createPriceLookup([{ name: 'Vulture', price: 175 }]);
    expect(
      matcher.hangarCcu(ccu('Prospector', 'Vulture', 5), withoutProspector)?.amounts?.before,
    ).toBe(20);
  });

  it('leaves out the discount of a CCU without a melt value', () => {
    expect(matcher.hangarCcu(ccu('Prospector', 'Vulture', 0), priceOf)?.amounts).toEqual({
      before: 20,
      after: 0,
      change: -20,
    });
  });

  it('is mixed while both ships rise without known amounts', () => {
    expect(matcher.hangarCcu(ccu('Galaxy', 'Prospector', 5), priceOf)?.direction).toBe('mixed');
  });

  it('ignores CCUs without a rising ship, other pledges and applied upgrades', () => {
    expect(matcher.hangarCcu(ccu('Cutlass Black', 'Vulture', 5), priceOf)).toBeUndefined();
    // A pledge upgraded to the Prospector is the Prospector now, not a CCU.
    const upgraded: Pledge = {
      ...ccu('Cutlass Black', 'Prospector', 140),
      upgrade: undefined,
      isUpgraded: true,
      items: [{ title: 'Prospector', kind: 'Ship' }],
    };
    expect(matcher.hangarCcu(upgraded, priceOf)).toBeUndefined();
    expect(matcher.hangar(upgraded)?.reason).toBe('ship');
  });

  it('ignores price increases that are over', () => {
    const later = createPriceIncreaseMatcher([prospector], Date.parse('2026-11-20T00:00:00Z'));
    expect(later.hangarCcu(ccu('Prospector', 'Vulture', 5), priceOf)).toBeUndefined();
  });
});

describe('buybackCcu (#250)', () => {
  it('finds the ships by the ids of the "Buy Back" button', () => {
    const pledge = buybackCcu('Upgrade - Some Name to Other Name', {
      fromShipId: 109,
      toShipId: 1,
      toSkuId: 1,
    });
    expect(matcher.buybackCcu(pledge, priceOf)).toEqual({ base: prospector, direction: 'loses' });
  });

  it('finds the ships by the names in the title, with the buy back price as its cost', () => {
    expect(
      matcher.buybackCcu(buybackCcu('Upgrade - Cutlass Black to Prospector'), priceOf, 15),
    ).toEqual({
      target: prospector,
      direction: 'gains',
      amounts: { before: 20, after: 40, change: 20, discountBefore: 5, discountAfter: 25 },
    });
  });

  it('ignores pledges that are no CCU', () => {
    const ship: BuybackPledge = { id: 3, title: 'Prospector', contained: '', isUpgrade: false };
    expect(matcher.buybackCcu(ship, priceOf)).toBeUndefined();
  });
});

describe('ccuPriceChange', () => {
  it('nets out both ships when both new prices are known', () => {
    const vulture: ExpectedPriceIncrease = {
      ship: { id: 2, name: 'Vulture' },
      priceIncreaseAt: prospector.priceIncreaseAt,
      price: { from: 175, to: 200 },
    };
    expect(
      ccuPriceChange(
        { name: 'Prospector', increase: prospector },
        { name: 'Vulture', increase: vulture },
        5,
        priceOf,
      ),
    ).toMatchObject({ direction: 'gains', amounts: { before: 20, after: 25, change: 5 } });
  });
});
