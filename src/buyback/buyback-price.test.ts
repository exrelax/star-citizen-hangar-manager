// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { createPriceLookup } from '@/hangar/ship-prices';
import { createItemPriceLookup } from '@/store/items/item-prices';
import type { BuybackPledge } from './buyback';
import { createBuybackPricer } from './buyback-price';
import { parseBuybackPrice } from './parse-buyback';

const pledge = (title: string, contained: string, extra: Partial<BuybackPledge> = {}) =>
  ({ id: 1, title, contained, isUpgrade: false, ...extra }) as BuybackPledge;

const priceOf = createBuybackPricer({
  ships: [
    { id: 268, name: 'MPUV Tractor', msrp: 40 },
    { id: 5, name: 'Aurora Mk I CL', msrp: 45 },
  ],
  shipPriceOf: createPriceLookup([{ name: 'Starlite', price: 60 }]),
  itemPriceOf: createItemPriceLookup([
    {
      id: 1,
      name: 'Sabre - Blue Steel Paint',
      category: 'Paints',
      price: 9,
      isWarbond: false,
      available: true,
    },
    {
      id: 2,
      name: 'Starlite - 10 Year',
      category: 'Standalone Ships',
      price: 60,
      isWarbond: false,
      available: true,
    },
  ]),
});

describe('createBuybackPricer', () => {
  it('takes the price read from the detail page first', () => {
    const bundle = pledge('Package - Bundle', 'Fury and 4 items', { price: 120 });
    expect(priceOf(bundle)).toEqual({ amount: 120, source: 'rsi' });
  });

  it("prices a CCU by the difference of its ships' standard prices", () => {
    const ccu = pledge('Upgrade - MPUV Tractor to Aurora Mk I CL', 'Upgrade - …', {
      isUpgrade: true,
      upgrade: { fromShipId: 268, toShipId: 5, toSkuId: 12991 },
    });
    expect(priceOf(ccu)).toEqual({ amount: 5, source: 'ships' });
  });

  it('prices a single item by the Pledge Store, a single ship by its standard price', () => {
    const paint = pledge('Paints - Sabre - Blue Steel Paint', 'Sabre - Blue Steel Paint');
    expect(priceOf(paint)).toEqual({ amount: 9, source: 'store' });
    const ship = pledge('Standalone Ships - Starlite', 'Starlite', { category: 'standalone_ship' });
    expect(priceOf(ship)).toEqual({ amount: 60, source: 'ships' });
  });

  it('prices a package the store sells by its title, also with several items', () => {
    const ship = pledge('Standalone Ships - Starlite - 10 Year', 'Starlite and 2 items', {
      category: 'standalone_ship',
    });
    expect(priceOf(ship)).toEqual({ amount: 60, source: 'store' });
  });

  it('prices a standalone ship with extras by its ship, but not an upgraded one', () => {
    const ilw = pledge('Standalone Ship - Starlite - ILW', 'Starlite and 3 items', {
      category: 'standalone_ship',
    });
    expect(priceOf(ilw)).toEqual({ amount: 60, source: 'ships' });
    const upgraded = pledge('Standalone Ship - Starlite - upgraded', 'Starlite and 2 items', {
      category: 'standalone_ship',
    });
    expect(priceOf(upgraded)).toBeUndefined();
  });

  it('prices a game package only by its buy back page', () => {
    const cutlass = pledge('Package - Cutlass Black', 'Cutlass Black and 7 items', {
      category: 'game_package',
    });
    const priceOfCutlass = createBuybackPricer({
      itemPriceOf: createItemPriceLookup([
        {
          id: 3,
          name: 'Cutlass Black',
          category: 'Standalone Ships',
          price: 110,
          isWarbond: false,
          available: true,
        },
      ]),
    });
    expect(priceOfCutlass(cutlass)).toBeUndefined();
    expect(priceOfCutlass({ ...cutlass, price: 115 })).toEqual({ amount: 115, source: 'rsi' });
  });

  it('knows no price of a pledge with several items without its detail page', () => {
    expect(priceOf(pledge('Package - Bundle', 'Fury and 4 items'))).toBeUndefined();
    expect(
      priceOf(pledge('Package - Bundle', 'Fury and 4 items', { price: null })),
    ).toBeUndefined();
  });
});

describe('parseBuybackPrice', () => {
  const page = (taxes: string) =>
    new DOMParser().parseFromString(
      `<div class="price"><strong class="final-price" data-value="7140" data-currency="USD">
       $71.40 USD</strong><div class="taxes js-taxes"><div class="taxes-details">
       store_taxes_includes-en <ul>${taxes}</ul></div></div></div>`,
      'text/html',
    );

  it('takes the taxes off the price RSI shows', () => {
    expect(parseBuybackPrice(page('<li>VAT 19%</li>'))).toBe(60);
    expect(parseBuybackPrice(page(''))).toBe(71.4);
  });

  it('has none without a price', () => {
    expect(parseBuybackPrice(new DOMParser().parseFromString('<p></p>', 'text/html'))).toBe(
      undefined,
    );
  });
});
