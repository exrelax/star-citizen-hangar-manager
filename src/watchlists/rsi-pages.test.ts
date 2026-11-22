// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { StoreItem } from '@/store/items/store-items';
import { chosenUpgrade, isPaintPage, paintOfPage, storePath } from './rsi-pages';

const paint = (id: number, name: string, link?: string): StoreItem => ({
  id,
  name,
  category: 'Paints',
  price: 10,
  isWarbond: false,
  available: true,
  ...(link && { link }),
});

describe('RSI’s pages with store items (#471)', () => {
  it('knows a paint’s page with and without locale', () => {
    expect(storePath('/en/pledge/Paint/Marauder-Bloodlet-Paint/')).toBe(
      '/pledge/paint/marauder-bloodlet-paint',
    );
    expect(isPaintPage('/en/pledge/Paint/Marauder-Bloodlet-Paint')).toBe(true);
    expect(isPaintPage('/pledge/Paints/X')).toBe(true);
    expect(isPaintPage('/en/pledge/Standalone-Ships/Hy-n-Warbond')).toBe(false);
  });

  it('finds the paint by its link, else by the page title', () => {
    const items = [
      paint(1, 'Marauder - Bloodlet Paint', '/pledge/Paint/Marauder-Bloodlet-Paint'),
      paint(2, 'Hyūn - Suii Paint'),
    ];
    expect(paintOfPage('/en/pledge/Paint/Marauder-Bloodlet-Paint', '', items)?.id).toBe(1);
    expect(
      paintOfPage(
        '/en/pledge/Paint/Hy-n-Suii-Paint',
        'Buy Hyūn - Suii Paint - Paints | Star',
        items,
      )?.id,
    ).toBe(2);
    expect(paintOfPage('/en/pledge/Paint/Other', 'Buy Other - Paints', items)).toBeUndefined();
  });

  it('reads the CCU of the ship upgrade dialog once both ships are chosen', () => {
    const side = (cls: string, ships: [number, string][]) =>
      `<div class="ShipSelector ${cls}">${ships
        .map(
          ([id, name]) =>
            `<div class="ShipItem" data-store-action-label="Select ${name} (id: ${id}) as ${cls} ship"><span class="ShipItem-general-information-name">${name}</span></div>`,
        )
        .join('')}</div>`;
    const modal = document.createElement('div');
    modal.innerHTML = side('from', [[92, 'P-52 Merlin']]) + side('to', [[65, 'Mustang Alpha']]);
    expect(chosenUpgrade(modal)).toEqual({
      from: { id: 92, name: 'P-52 Merlin' },
      to: { id: 65, name: 'Mustang Alpha' },
    });
    modal.innerHTML =
      side('from', [[92, 'P-52 Merlin']]) +
      side('to', [
        [65, 'Mustang Alpha'],
        [66, 'Aurora'],
      ]);
    expect(chosenUpgrade(modal)).toBeUndefined();
  });
});
