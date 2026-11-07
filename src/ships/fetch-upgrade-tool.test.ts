import { describe, expect, it } from 'vitest';
import { parseUpgradeTool } from './fetch-upgrade-tool';

const media = (key: string) => ({ productThumbMediumAndSmall: `https://media/${key}.jpg` });

describe('parseUpgradeTool', () => {
  it('reads every ship once, the SKUs on sale and the warbond editions, in USD', () => {
    const data = parseUpgradeTool({
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
              link: '/pledge/ships/eclipse/Eclipse',
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
          ],
        },
      },
    });

    expect(data.ships).toEqual([
      { id: 1, name: 'Aurora Mk I ES', msrp: 20, image: 'https://media/aurora.jpg' },
      // The target fills in what the ship to start from lacks.
      {
        id: 130,
        name: 'Eclipse',
        msrp: 300,
        image: 'https://media/eclipse.jpg',
        link: '/pledge/ships/eclipse/Eclipse',
      },
      { id: 165, name: 'Vulture', msrp: 175 },
    ]);
    expect(data.buyable).toEqual([
      { shipId: 130, skuId: 19395, title: 'Warbond Edition', price: 270 },
      { shipId: 130, skuId: 13076, title: 'Standard Edition', price: 300 },
    ]);
    expect(data.warbonds).toEqual([{ shipId: 130, skuId: 19395, price: 270 }]);
  });

  it('fails on errors and on answers without ships', () => {
    expect(() => parseUpgradeTool({ errors: [{ message: 'denied' }] })).toThrow('denied');
    expect(() => parseUpgradeTool({ data: { from: { ships: [] } } })).toThrow('no ships');
  });
});
