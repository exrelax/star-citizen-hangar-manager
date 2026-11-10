import type { StoreData } from '@/store/warbond';
import type { DemoCatalog } from './catalog';
import { CCU_TARGET_MAX, warbondDiscount, type DemoPledge } from './generate-hangar';
import { createRandom } from './random';

/*
 * The warbond CCUs of the demo's Pledge Store tab (#130): offers of its own instead of the
 * Pledge Store's, so the tab shows them on any account – for ships the demo hangar has CCUs to,
 * so own CCUs in the same price range show next to them.
 */
export function demoStoreData(catalog: DemoCatalog, hangar: readonly DemoPledge[]): StoreData {
  const targets = [
    ...new Set(hangar.flatMap((pledge) => pledge.upgrade?.targetItems[0]?.name ?? [])),
  ]
    .map((name) => catalog.ships.find((ship) => ship.name === name))
    .filter((ship) => ship !== undefined && ship.msrp >= 60 && ship.msrp <= CCU_TARGET_MAX)
    .slice(0, 3);
  const random = createRandom('demo-store');
  return {
    ships: [...catalog.ships],
    warbonds: targets.map((ship) => ({
      ship: ship!,
      skuId: ship!.id,
      price: ship!.msrp - warbondDiscount(random, `warbond:${ship!.id}`, ship!.msrp),
    })),
  };
}
