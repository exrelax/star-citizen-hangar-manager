import { describe, expect, it } from 'vitest';
import type { BuybackPledge } from '@/buyback/buyback';
import type { Pledge, PledgeItem } from '@/hangar/pledge';
import { createPriceIncreaseMatcher, nameKey } from './price-increase-match';
import type { ExpectedPriceIncrease } from './price-increases';

const NOW = Date.parse('2026-11-10T12:00:00Z');

const galaxy: ExpectedPriceIncrease = {
  ship: { id: 244, name: 'Galaxy' },
  flightReadyAt: { at: Date.parse('2026-11-13T16:00:00Z') },
  priceIncreaseAt: { at: Date.parse('2026-11-13T16:00:00Z') },
  relatedItems: [{ name: 'Galaxy Cargo Module' }],
};
const liberator: ExpectedPriceIncrease = {
  ship: { id: 224, name: 'Liberator' },
  priceIncreaseAt: { at: Date.parse('2026-11-15T16:00:00Z') },
};
const hercules: ExpectedPriceIncrease = {
  ship: { id: 163, name: 'M2 Hercules', aliases: ['Hercules Starlifter M2'] },
  priceIncreaseAt: { at: Date.parse('2026-11-16'), dayOnly: true },
};
const over: ExpectedPriceIncrease = {
  ship: { id: 99, name: 'Retaliator' },
  priceIncreaseAt: { at: Date.parse('2026-11-01T16:00:00Z') },
};

const matcher = createPriceIncreaseMatcher([galaxy, liberator, hercules, over], NOW);

const hangarPledge = (overrides: Partial<Pledge>): Pledge => ({
  id: 1,
  name: 'Test',
  title: 'Test',
  value: '$0.00 USD',
  valueUsd: 0,
  configurationValue: '$0.00 USD',
  currency: 'USD',
  availability: 'Attributed',
  contains: '',
  isLastAlpha: false,
  isBuybackable: true,
  isGiftable: true,
  isExchangeable: true,
  isUpgradeable: false,
  isUpgraded: false,
  nameReservations: null,
  nameableShips: null,
  items: [],
  ...overrides,
});
const shipItem = (title: string): PledgeItem => ({ title, kind: 'Ship' });
const ccu = (title: string, target: string, id = 77754): Pledge =>
  hangarPledge({
    title,
    upgrade: {
      matchItems: [{ id: 8153, name: 'Valkyrie' }],
      targetItems: [{ id, name: target }],
      type: 'R',
    },
    items: [{ title }],
  });

const buybackPledge = (overrides: Partial<BuybackPledge>): BuybackPledge => ({
  id: 2,
  title: 'Test',
  contained: '',
  isUpgrade: false,
  ...overrides,
});
const buybackCcu = (title: string, toShipId?: number): BuybackPledge =>
  buybackPledge({
    title,
    contained: title.replace(/^Upgrade - /, ''),
    isUpgrade: true,
    ...(toShipId && { upgrade: { fromShipId: 169, toShipId, toSkuId: 1 } }),
  });

const reasonAndShip = (match: ReturnType<typeof matcher.hangar>) =>
  match && [match.reason, match.increase.ship.name];

describe('nameKey', () => {
  it('ignores case, punctuation, word order and the edition', () => {
    expect(nameKey('Galaxy Standard Edition')).toBe(nameKey('galaxy'));
    expect(nameKey('Constellation Mk V Centaurus Warbond Edition')).toBe(
      nameKey('Constellation Mk V Centaurus'),
    );
    expect(nameKey('Hercules M2')).toBe(nameKey('M2 Hercules'));
    expect(nameKey('Galaxy Refinery Module')).not.toBe(nameKey('Galaxy'));
    expect(nameKey('Valkyrie Liberator Edition')).not.toBe(nameKey('Liberator'));
  });
});

describe('My Hangar', () => {
  it('finds ships and packages by their ship items, also by an alias', () => {
    const ship = hangarPledge({ items: [shipItem('Galaxy'), { title: 'LTI', kind: 'Insurance' }] });
    expect(reasonAndShip(matcher.hangar(ship))).toEqual(['ship', 'Galaxy']);
    const pack = hangarPledge({
      items: [shipItem('Hercules Starlifter M2'), shipItem('Aurora Mk I MR')],
    });
    expect(reasonAndShip(matcher.hangar(pack))).toEqual(['ship', 'M2 Hercules']);
  });

  it('finds CCUs by the name of their target', () => {
    const toGalaxy = ccu('Upgrade - Valkyrie to Galaxy Standard Edition', 'Galaxy');
    expect(reasonAndShip(matcher.hangar(toGalaxy))).toEqual(['ccu', 'Galaxy']);
    const toModule = ccu('Upgrade - 600i Module to Galaxy Cargo Module', 'Galaxy Cargo Module');
    expect(reasonAndShip(matcher.hangar(toModule))).toEqual(['related', 'Galaxy']);
  });

  it('finds related items, but not paints or other ships of the name', () => {
    const module = hangarPledge({ items: [{ title: 'Galaxy Cargo Module', kind: 'Component' }] });
    expect(reasonAndShip(matcher.hangar(module))).toEqual(['related', 'Galaxy']);
    const paint = hangarPledge({ items: [{ title: 'Galaxy - Polar Paint', kind: 'Skin' }] });
    expect(matcher.hangar(paint)).toBeUndefined();
    const valkyrie = hangarPledge({ items: [shipItem('Valkyrie Liberator Edition')] });
    expect(matcher.hangar(valkyrie)).toBeUndefined();
    const fromGalaxy = ccu('Upgrade - Galaxy to Polaris', 'Polaris', 1);
    expect(matcher.hangar(fromGalaxy)).toBeUndefined();
  });

  it('only counts price increases still ahead, and of several the next one', () => {
    expect(matcher.hangar(hangarPledge({ items: [shipItem('Retaliator')] }))).toBeUndefined();
    const both = hangarPledge({ items: [shipItem('Liberator'), shipItem('Galaxy')] });
    expect(matcher.hangar(both)?.increase).toBe(galaxy);
    const later = createPriceIncreaseMatcher([galaxy], Date.parse('2026-11-13T16:00:00Z'));
    expect(later.hangar(hangarPledge({ items: [shipItem('Galaxy')] }))).toBeUndefined();
  });
});

describe('Buy Back', () => {
  it('finds CCUs by the Ship Matrix id of their target, else by its name', () => {
    expect(reasonAndShip(matcher.buyback(buybackCcu('Upgrade - Valkyrie to Ix', 244)))).toEqual([
      'ccu',
      'Galaxy',
    ]);
    const byName = buybackCcu('Upgrade - Valkyrie to Liberator Warbond Edition');
    expect(reasonAndShip(matcher.buyback(byName))).toEqual(['ccu', 'Liberator']);
    expect(matcher.buyback(buybackCcu('Upgrade - Galaxy to Polaris', 117))).toBeUndefined();
  });

  it('finds ships and packages by their ships', () => {
    const ship = buybackPledge({
      title: 'Standalone Ships - Galaxy',
      contained: 'Galaxy and 2 items',
      category: 'standalone_ship',
    });
    expect(reasonAndShip(matcher.buyback(ship))).toEqual(['ship', 'Galaxy']);
    const pack = buybackPledge({
      title: 'Package - Hauler Pack',
      contained: '3 items',
      items: ['Aurora Mk I MR', 'Liberator', 'LTI'],
    });
    expect(reasonAndShip(matcher.buyback(pack))).toEqual(['ship', 'Liberator']);
  });

  it('finds related items by their name, also in the title', () => {
    const module = buybackPledge({
      title: 'Add-Ons - Galaxy - Cargo Module - IAE',
      contained: '2 items',
    });
    expect(reasonAndShip(matcher.buyback(module))).toEqual(['related', 'Galaxy']);
    const paint = buybackPledge({
      title: 'Paints - Galaxy - Polar Paint',
      contained: 'Galaxy - Polar Paint',
    });
    expect(matcher.buyback(paint)).toBeUndefined();
  });

  it('finds nothing without price increases', () => {
    const none = createPriceIncreaseMatcher([], NOW);
    expect(none.buyback(buybackCcu('Upgrade - Valkyrie to Galaxy', 244))).toBeUndefined();
    expect(none.hangar(hangarPledge({ items: [shipItem('Galaxy')] }))).toBeUndefined();
  });
});
