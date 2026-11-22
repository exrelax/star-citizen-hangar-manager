import { describe, expect, it } from 'vitest';
import { isPaintItem } from '@/hangar/pledge-view';
import { isForOwnedShip, ownedShips } from '@/hangar/paint-ships';
import type { StoreItem } from '@/store/items/store-items';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { demoPaintCases, PAINT_CASES, paintCaseShips } from './demo-paint-cases';

const paint = (id: number, name: string): StoreItem => ({
  id,
  category: 'Paints',
  name,
  price: 10,
  isWarbond: false,
  available: true,
});

describe('the demo’s paints by owned ships (#336, #337)', () => {
  it('chooses a different paint of the store for each case', () => {
    const cases = demoPaintCases(
      [
        paint(1, 'Polaris - Black Ice Paint'),
        paint(2, 'Sabre - Blue Steel Paint'),
        paint(3, 'Nova - Tundra Paint'),
        paint(4, 'Galaxy - Polar Paint'),
        paint(5, 'Hercules - Polar Paint'),
        paint(6, 'Valkyrie - Stormbringer Paint'),
        paint(7, 'Invictus Paint Pack'),
      ],
      {
        standalone: ['Sabre Comet'],
        package: ['Nova'],
        upgraded: ['Galaxy'],
        other: [],
        ccuBases: ['Valkyrie'],
        catalog: ['Sabre Comet', 'Nova', 'Galaxy', 'C2 Hercules', 'M2 Hercules', 'Valkyrie'],
      },
    );
    expect(Object.fromEntries([...cases].map(([name, entry]) => [name, entry.name]))).toEqual({
      standalone: 'Sabre - Blue Steel Paint',
      package: 'Nova - Tundra Paint',
      upgraded: 'Galaxy - Polar Paint',
      // No Hercules in the hangar: no series case.
      ccuBase: 'Valkyrie - Stormbringer Paint',
      notOwned: 'Polaris - Black Ice Paint',
      unmatched: 'Invictus Paint Pack',
    });
  });

  it('shows the cases in the generated hangar and buy back', () => {
    const { pledges, buyback, account } = generatedDemo(FALLBACK_CATALOG, 'test-key');
    const owned = ownedShips(
      account.pledges.flatMap((p) => p.items.filter((i) => i.kind === 'Ship').map((i) => i.title)),
    );
    const hangarPaints = pledges.filter((p) => p.isPaint);
    const titlesOf = (p: (typeof hangarPaints)[number]) => [
      p.title,
      ...p.items.filter(isPaintItem).map((i) => i.title),
    ];
    const ownedPaints = hangarPaints.filter((p) => isForOwnedShip(titlesOf(p), owned));
    expect(ownedPaints.length).toBeGreaterThan(0);
    expect(ownedPaints.length).toBeLessThan(hangarPaints.length);

    const cases = demoPaintCases(
      FALLBACK_CATALOG.items.filter((i) => i.category === 'Paints'),
      // The ships the demo itself chooses the cases by.
      paintCaseShips(account.pledges, FALLBACK_CATALOG),
    );
    const names = [...cases.values()].map((entry) => `Paints - ${entry.name}`);
    // Every chosen paint is in the hangar and the buy back.
    for (const name of names) {
      expect(pledges.some((p) => p.title === name)).toBe(true);
      expect(buyback.some((p) => p.title === name)).toBe(true);
    }
    // The cases that the bundled catalog allows.
    expect([...cases.keys()].filter((name) => PAINT_CASES.includes(name)).length).toBeGreaterThan(
      2,
    );
  });
});
