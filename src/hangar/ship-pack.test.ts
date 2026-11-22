import { describe, expect, it } from 'vitest';
import { toBuybackView } from '@/buyback/buyback-view';
import { createBuybackImager } from '@/buyback/buyback-image';
import type { Pledge } from './pledge';
import { toPledgeView } from './pledge-view';
import { createBuybackShipKind } from './ship-kind';
import { packCards, packTitle } from './ship-pack';

/* Ship packs at a glance (#515). */

const ursa = { name: 'Ursa Medivac', image: 'https://example.com/ursa.jpg' };
const pisces = { name: 'C8R Pisces', image: 'https://example.com/pisces.jpg' };

describe('the title and cards of a pack', () => {
  it('names each ship once with its count', () => {
    expect(packTitle([ursa, pisces])).toBe('Ursa Medivac, C8R Pisces');
    expect(packTitle([ursa, ursa, pisces])).toBe('2× Ursa Medivac, C8R Pisces');
  });

  it('fans two ships side by side', () => {
    expect(packCards([ursa, pisces]).map((card) => [card.name, card.fan])).toEqual([
      ['Ursa Medivac', -0.5],
      ['C8R Pisces', 0.5],
    ]);
  });

  it('fans the first ship in front and up to two more behind it', () => {
    const third = { name: 'Nox' };
    const fourth = { name: 'Dragonfly' };
    expect(
      packCards([ursa, ursa, pisces, third, fourth]).map((card) => [card.name, card.fan]),
    ).toEqual([
      ['Ursa Medivac', 0],
      ['C8R Pisces', 1],
      ['Nox', -1],
    ]);
  });
});

describe('packs in My Hangar', () => {
  const pledge = (items: Pledge['items'], extra: Partial<Pledge> = {}) =>
    ({
      id: 1,
      name: 'Packs - MXC Duo Pack plus Icefront Paint',
      title: 'Packs - MXC Duo Pack plus Icefront Paint',
      value: '$110.00 USD',
      valueUsd: 110,
      items,
      isUpgraded: false,
      isGiftable: true,
      isExchangeable: true,
      ...extra,
    }) as Pledge;

  it('lists the ships of a pledge with two ships, with their images, upgraded too', () => {
    const view = toPledgeView(
      pledge(
        [
          { title: 'MXC - Icefront Camo Paint', kind: 'Skin' },
          { title: 'Ursa Medivac', kind: 'Ship', image: ursa.image },
          { title: 'C8R Pisces', kind: 'Ship', image: pisces.image },
          { title: 'Lifetime Insurance', kind: 'Insurance' },
        ],
        { isUpgraded: true },
      ),
    );
    expect(view.pack).toEqual([ursa, pisces]);
    expect(view.originalName).toBe('Packs - MXC Duo Pack plus Icefront Paint');
  });

  it('has no pack for a single ship', () => {
    const view = toPledgeView(
      pledge([
        { title: 'Ursa Medivac', kind: 'Ship' },
        { title: 'Lifetime Insurance', kind: 'Insurance' },
      ]),
    );
    expect(view.pack).toBeUndefined();
  });
});

describe('packs in the Buy Back', () => {
  const ships = [
    { id: 1, name: 'Ursa Medivac', msrp: 65, image: ursa.image },
    { id: 2, name: 'C8R Pisces', msrp: 45, image: pisces.image },
  ];
  const context = {
    position: 0,
    shipKindOf: createBuybackShipKind({ ships }),
    imageOf: createBuybackImager({ ships }),
  };

  it('lists the ships named in "Contained" and among the items, with their images', () => {
    const view = toBuybackView(
      {
        id: 7,
        title: 'Package - Ursa Medivac and C8R Pisces Pack',
        contained: 'Ursa Medivac and 2 items',
        items: ['Ursa Medivac', 'C8R Pisces', 'Lifetime Insurance'],
        isUpgrade: false,
        category: 'standalone_ship',
      },
      context,
    );
    expect(view.pack).toEqual([ursa, pisces]);
  });

  it('has no pack for a single ship', () => {
    const view = toBuybackView(
      {
        id: 8,
        title: 'Standalone Ships - Ursa Medivac',
        contained: 'Ursa Medivac',
        isUpgrade: false,
        category: 'standalone_ship',
      },
      context,
    );
    expect(view.pack).toBeUndefined();
  });
});
