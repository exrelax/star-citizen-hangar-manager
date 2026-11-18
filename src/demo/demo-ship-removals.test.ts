import { describe, expect, it } from 'vitest';
import { hangarCcus, removalCcus } from '@/ship-removals/removal-ccus';
import { removalNotes } from '@/ship-removals/removal-notes';
import { removalsByDate } from '@/ship-removals/ship-removals';
import { ccusToSecure } from '@/price-increases/ccus-to-secure';
import { standardSku, warbondSku, type ShipSku } from '@/ships/ships';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { demoShipRemovals } from './demo-ship-removals';
import { demoStoreData } from './demo-store';
import { ccuTargetsOf } from './generate-hangar';

/* The demo's ships leaving the Pledge Store (#292): every case of Ship Removals (#285). */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
// The catalog with more ships, as the upgrade tool's: some have no CCUs from or to them.
const ships = [
  ...FALLBACK_CATALOG.ships,
  ...Array.from({ length: 40 }, (_, index) => ({
    id: 9000 + index,
    name: `Demo Ship ${index + 1}`,
    msrp: 60 + index * 20,
  })),
];
const catalog = { ...FALLBACK_CATALOG, ships };
// RSI sells CCUs to most ships, not to every tenth made-up one.
const notOnSale = new Set(
  ships.filter((ship) => ship.id >= 9000 && ship.id % 10 === 0).map((ship) => ship.id),
);
const buyable = new Set(ships.map((ship) => ship.id).filter((id) => !notOnSale.has(id)));
const skus: ShipSku[] = [...buyable].map((id) => ({
  shipId: id,
  skuId: 100_000 + id,
  title: 'Standard Edition',
  price: 1,
}));

describe.each(['key-a', 'key-b', 'key-c'])('the ship removals of the demo %s', (key) => {
  const demo = generatedDemo(catalog, key, TODAY, NOW, undefined, buyable);
  const store = demoStoreData(catalog, demo.pledges, NOW);
  const warbonds = store.warbonds.map((offer) => ({
    shipId: offer.ship.id,
    skuId: offer.skuId,
    price: offer.price,
  }));
  const { removals, limited } = demoShipRemovals({
    ships,
    hangar: demo.pledges,
    buyback: demo.buyback,
    buyable,
    warbondShips: new Set(warbonds.map((warbond) => warbond.shipId)),
    avoid: new Set(demo.priceIncreases.map((increase) => increase.ship.id)),
    now: NOW,
  });
  const list = removalCcus({
    removals,
    ships,
    hangar: demo.pledges,
    buyback: demo.buyback,
    now: NOW,
  });
  const entryOf = (id: number) => list.find((entry) => entry.removal.ship.id === id)!;

  it('has several ships on a day and one alone with a time, all ahead', () => {
    const groups = removalsByDate(removals, NOW);
    expect(groups.map((group) => group.removals.length)).toEqual([1, 2, 2]);
    expect(groups[0]!.removedAt.dayOnly).toBeUndefined();
    expect(groups.slice(1).every((group) => group.removedAt.dayOnly)).toBe(true);
    expect(removals.every((removal) => removal.removedAt.at > NOW)).toBe(true);
    expect(new Set(removals.map((removal) => removal.ship.id)).size).toBe(removals.length);
  });

  it('expands ships with enough CCUs to them, with too few and with none at all (#380)', () => {
    const critical = list.find((entry) => entry.level === 'critical')!;
    expect(critical.to.length).toBeLessThan(hangarCcus(critical.from));
    const warning = list.find((entry) => entry.level === 'warning')!;
    expect(warning.to.length).toBeGreaterThanOrEqual(hangarCcus(warning.from));
    expect(list.some((entry) => !entry.from.length && !entry.to.length)).toBe(true);
  });

  it('warns on CCUs in My Hangar, yellow-orange and red (#289)', () => {
    const levels = demo.pledges.flatMap((pledge) => {
      const entry = list.find((candidate) =>
        candidate.from.some((ccu) => ccu.source === 'hangar' && ccu.id === pledge.id),
      );
      return entry?.level ?? [];
    });
    expect(levels).toContain('warning');
    expect(levels).toContain('critical');
  });

  it('gives the sidebar a notification without CCUs, a yellow-orange and a red one (#290)', () => {
    expect(removalNotes(list, NOW, []).map((note) => note.level)).toEqual([
      undefined,
      'warning',
      'critical',
    ]);
  });

  it('has a ship on sale but not always available, with CCUs from it in the hangar (#293)', () => {
    expect(limited.size).toBe(1);
    const [id] = limited;
    expect(entryOf(id!).level).toBe('warning');
  });

  it('has a leaving ship with both upgrade buttons, one with only "Ship upgrade" and one without (#391, #392)', () => {
    const buttons = removals.map((removal) => [
      !!warbondSku(warbonds, removal.ship.id),
      !!standardSku({ buyable: skus, warbonds }, removal.ship.id),
    ]);
    expect(buttons).toContainEqual([true, true]);
    expect(buttons).toContainEqual([false, true]);
    expect(buttons).toContainEqual([false, false]);
  });

  it('has ships to secure with and without "Warbond upgrade" (#392)', () => {
    const secure = ccusToSecure({
      increases: demo.priceIncreases,
      ships,
      buyable: skus,
      warbonds,
      holdings: new Map(),
      buyback: demo.buyback,
      now: NOW,
    }).filter((offer) => offer.skuId !== undefined);
    expect(secure.some((offer) => offer.warbondSkuId !== undefined)).toBe(true);
    expect(secure.some((offer) => offer.warbondSkuId === undefined)).toBe(true);
  });
});

describe('the ship removals of a demo without CCUs', () => {
  it('still has ships without CCUs, and no warning', () => {
    const { removals, limited } = demoShipRemovals({
      ships: ccuTargetsOf(ships),
      hangar: [],
      buyback: [],
      warbondShips: new Set(),
      avoid: new Set(),
      now: NOW,
    });
    expect(removals.length).toBe(2);
    expect(limited.size).toBe(0);
  });
});
