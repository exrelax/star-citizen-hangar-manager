import { describe, expect, it } from 'vitest';
import { parseStoreResponse } from './fetch-store';

const media = (key: string) => ({ productThumbMediumAndSmall: `https://media/${key}.jpg` });

describe('parseStoreResponse', () => {
  it('reads the ships and the available warbond SKUs, with prices in USD', () => {
    const data = parseStoreResponse({
      data: {
        from: {
          ships: [
            { id: 1, name: 'Aurora Mk I ES ', msrp: 2000, medias: media('aurora') },
            { id: 130, name: 'Eclipse', msrp: 30000, medias: null },
          ],
        },
        to: {
          ships: [
            {
              id: 130,
              name: 'Eclipse',
              msrp: 30000,
              medias: media('eclipse'),
              skus: [
                { id: 19395, title: 'Warbond Edition', price: 27000, available: true },
                { id: 13076, title: 'Standard Edition', price: 30000, available: true },
              ],
            },
            {
              id: 165,
              name: 'Vulture',
              msrp: 17500,
              skus: [{ id: 16688, title: 'Warbond Edition', price: 16500, available: false }],
            },
            {
              id: 200,
              name: 'Hornet',
              msrp: 10000,
              skus: [{ id: 1, title: 'Standard Edition', price: 10000, available: true }],
            },
          ],
        },
      },
    });

    expect(data.ships).toEqual([
      { id: 1, name: 'Aurora Mk I ES', msrp: 20, image: 'https://media/aurora.jpg' },
      { id: 130, name: 'Eclipse', msrp: 300, image: undefined },
    ]);
    expect(data.warbonds).toEqual([
      {
        ship: { id: 130, name: 'Eclipse', msrp: 300, image: 'https://media/eclipse.jpg' },
        skuId: 19395,
        price: 270,
      },
    ]);
  });

  it('fails on errors and on answers without ships', () => {
    expect(() => parseStoreResponse({ errors: [{ message: 'denied' }] })).toThrow('denied');
    expect(() => parseStoreResponse({ data: { from: { ships: [] } } })).toThrow('no ships');
  });
});
