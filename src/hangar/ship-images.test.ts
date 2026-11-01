import { describe, expect, it } from 'vitest';
import type { Pledge, PledgeItem, PledgeUpgrade } from './pledge';
import { parseShipMatrix, resolveUpgradeImages, shipKey } from './ship-images';

const ccu = (...targets: string[]) =>
  ({
    id: 1,
    items: [],
    upgrade: {
      matchItems: [],
      targetItems: targets.map((name, id) => ({ id, name })),
      type: 'R',
    } satisfies PledgeUpgrade,
  }) as unknown as Pledge;

const withShip = (title: string, image: string) =>
  ({ id: 2, items: [{ title, kind: 'Ship', image } satisfies PledgeItem] }) as unknown as Pledge;

describe('shipKey', () => {
  it('ignores case, punctuation and word order', () => {
    expect(shipKey('Hercules Starlifter M2')).toBe(shipKey('M2 Hercules Starlifter'));
    expect(shipKey('L-22 Alpha Wolf')).toBe(shipKey('l 22 alpha wolf'));
    expect(shipKey('Avenger Titan')).not.toBe(shipKey('Avenger Stalker'));
  });
});

describe('parseShipMatrix', () => {
  it('maps ship names to store images', () => {
    const images = parseShipMatrix({
      data: [
        { name: 'Avenger Titan', media: [{ images: { store_small: 'https://img/titan.jpg' } }] },
        { name: 'No Media' },
      ],
    });
    expect([...images]).toEqual([[shipKey('Avenger Titan'), 'https://img/titan.jpg']]);
  });

  it('returns no images for unexpected data', () => {
    expect(parseShipMatrix(null).size).toBe(0);
    expect(parseShipMatrix({ data: 'nope' }).size).toBe(0);
  });
});

describe('resolveUpgradeImages', () => {
  it('prefers the ship matrix and skips targets without an image', () => {
    const pledge = ccu('Titan - Best In Show Paint', 'Avenger Titan');
    resolveUpgradeImages([pledge], new Map([[shipKey('Avenger Titan'), 'matrix.jpg']]));
    expect(pledge.upgrade?.targetImage).toBe('matrix.jpg');
  });

  it('falls back to ship images from the hangar', () => {
    const pledge = ccu('Polaris');
    resolveUpgradeImages([pledge, withShip('Polaris', 'hangar.jpg')], new Map());
    expect(pledge.upgrade?.targetImage).toBe('hangar.jpg');
  });

  it('leaves the image empty when nothing matches', () => {
    const pledge = ccu('Unknown Ship');
    resolveUpgradeImages([pledge], new Map());
    expect(pledge.upgrade?.targetImage).toBeUndefined();
  });
});
