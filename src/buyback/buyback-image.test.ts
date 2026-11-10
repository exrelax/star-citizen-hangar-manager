import { describe, expect, it } from 'vitest';
import type { Pledge } from '@/hangar/pledge';
import type { BuybackPledge } from './buyback';
import { createBuybackImager } from './buyback-image';

const PLACEHOLDER = 'https://cdn.robertsspaceindustries.com/static/images/Temp/default-image.png';

const pledge = (title: string, contained: string, extra: Partial<BuybackPledge> = {}) =>
  ({ id: 1, title, contained, isUpgrade: false, image: PLACEHOLDER, ...extra }) as BuybackPledge;

const hangarPledge = (title: string, extra: Partial<Pledge> = {}) =>
  ({ id: 2, name: title, title, items: [], ...extra }) as unknown as Pledge;

const imageOf = createBuybackImager({
  ships: [
    { id: 244, name: 'Galaxy', msrp: 383, image: 'catalog/galaxy.jpg' },
    { id: 169, name: 'Valkyrie', msrp: 375, image: 'catalog/valkyrie.jpg' },
    { id: 7, name: 'Placeholder Ship', msrp: 50, image: PLACEHOLDER },
  ],
  hangarPledges: [
    hangarPledge('Standalone Ships - Cutlass Black', {
      image: PLACEHOLDER,
      items: [{ title: 'Cutlass Black', kind: 'Ship', image: 'hangar/cutlass.jpg' }],
    }),
    hangarPledge('Paints - Sabre Blue Steel', {
      image: PLACEHOLDER,
      items: [{ title: 'Sabre - Blue Steel Paint', kind: 'Skin', image: 'hangar/sabre-paint.jpg' }],
    }),
    hangarPledge('Upgrade - Arrow to Gladius', {
      upgrade: { matchItems: [], targetItems: [], type: 'R', targetImage: 'hangar/gladius.jpg' },
    }),
  ],
});

const ccu = (title: string, toShipId?: number) =>
  pledge(title, title, {
    isUpgrade: true,
    ...(toShipId && { upgrade: { fromShipId: 169, toShipId, toSkuId: 1 } }),
  });

describe('createBuybackImager', () => {
  it("shows a CCU's target ship by the ship id of its Buy Back button", () => {
    expect(imageOf(ccu('Upgrade - Valkyrie to Galaxy Standard Edition', 244))).toBe(
      'catalog/galaxy.jpg',
    );
  });

  it("finds a CCU's target ship by the name in its title, without the edition", () => {
    expect(imageOf(ccu('Upgrade - Valkyrie to Galaxy Warbond Edition'))).toBe('catalog/galaxy.jpg');
    expect(imageOf(ccu('Upgrade - Galaxy to Cutlass Black Standard Edition'))).toBe(
      'hangar/cutlass.jpg',
    );
  });

  it('prefers the target ship to the CCU image RSI shows', () => {
    expect(imageOf({ ...ccu('Upgrade - Valkyrie to Galaxy', 244), image: 'rsi/ccu.jpg' })).toBe(
      'catalog/galaxy.jpg',
    );
  });

  it('falls back to the same CCU in the hangar, then to a real RSI image', () => {
    expect(imageOf(ccu('Upgrade - Arrow to Gladius'))).toBe('hangar/gladius.jpg');
    expect(imageOf({ ...ccu('Upgrade - Arrow to Unknown'), image: 'rsi/ccu.jpg' })).toBe(
      'rsi/ccu.jpg',
    );
    expect(imageOf(ccu('Upgrade - Arrow to Unknown'))).toBeUndefined();
  });

  it("keeps RSI's image of other pledges if it is a real one", () => {
    const real = pledge('Standalone Ships - Cutlass Black', 'Cutlass Black', {
      image: 'rsi/cutlass.jpg',
    });
    expect(imageOf(real)).toBe('rsi/cutlass.jpg');
  });

  it("takes the hangar's pledge or item of the same title instead of the placeholder", () => {
    expect(imageOf(pledge('Standalone Ships - Cutlass Black', 'Cutlass Black'))).toBe(
      'hangar/cutlass.jpg',
    );
    expect(imageOf(pledge('Paints - Sabre Blue Steel 2', 'Sabre - Blue Steel Paint'))).toBe(
      'hangar/sabre-paint.jpg',
    );
  });

  it('takes the contained ship of a ship pledge', () => {
    expect(imageOf(pledge('Package - Galaxy Starter', 'Galaxy and 3 items'))).toBe(
      'catalog/galaxy.jpg',
    );
  });

  it('never gives the placeholder', () => {
    expect(imageOf(pledge('Gear - Something', 'Something'))).toBeUndefined();
    expect(imageOf(ccu('Upgrade - Valkyrie to Placeholder Ship', 7))).toBeUndefined();
  });
});
