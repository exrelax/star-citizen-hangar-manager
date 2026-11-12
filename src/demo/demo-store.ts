import type { StoreData, WarbondTarget } from '@/store/warbond';
import {
  WARBOND_HISTORY_VERSION,
  type SightingEvent,
  type WarbondHistorySnapshot,
  type WarbondSighting,
} from '@/store/warbond-history';
import type { DemoCatalog } from './catalog';
import { CCU_TARGET_MAX, warbondDiscount, type DemoPledge } from './generate-hangar';
import { createRandom } from './random';

/*
 * The warbond CCUs of the demo's Pledge Store tab (#130): offers of its own instead of the
 * Pledge Store's, so the tab shows them on any account – for ships the demo hangar has CCUs to,
 * so own CCUs in the same price range show next to them.
 */
export function demoStoreData(
  catalog: DemoCatalog,
  hangar: readonly DemoPledge[],
  now = Date.now(),
): StoreData {
  const targets = [
    ...new Set(hangar.flatMap((pledge) => pledge.upgrade?.targetItems[0]?.name ?? [])),
  ]
    .map((name) => catalog.ships.find((ship) => ship.name === name))
    .filter((ship) => ship !== undefined && ship.msrp >= 60 && ship.msrp <= CCU_TARGET_MAX)
    .slice(0, 3);
  const random = createRandom('demo-store');
  const warbonds = targets.map((ship) => ({
    ship: ship!,
    skuId: ship!.id,
    price: ship!.msrp - warbondDiscount(random, `warbond:${ship!.id}`, ship!.msrp),
  }));
  return { ships: [...catalog.ships], warbonds, history: demoWarbondHistory(warbonds, now) };
}

const DAY = 24 * 60 * 60 * 1000;

const DEMO_EVENTS = {
  iae: { id: 'demo-iae', name: { en: 'Intergalactic Aerospace Expo' } },
  invictus: { id: 'demo-invictus', name: { en: 'Invictus Launch Week' } },
} satisfies Record<string, SightingEvent>;

/**
 * The demo's history of warbond offers (#4), made up for its offers: the first seen for days during
 * an event, with earlier offers at two events and one without; the second with one earlier offer
 * at another price and no event; the third seen for the first time today, never before.
 */
export function demoWarbondHistory(
  warbonds: readonly WarbondTarget[],
  now: number,
): WarbondHistorySnapshot {
  const sighting = (
    target: WarbondTarget,
    price: number,
    fromDaysAgo: number,
    toDaysAgo: number,
    events?: SightingEvent[],
  ): WarbondSighting => ({
    shipId: target.ship.id,
    skuId: target.skuId,
    shipName: target.ship.name,
    price,
    msrp: target.ship.msrp,
    firstSeen: now - fromDaysAgo * DAY,
    lastSeen: toDaysAgo ? now - toDaysAgo * DAY : now,
    ...(events && { events }),
  });
  /** An earlier, higher warbond price: still below the standard price. */
  const higher = (target: WarbondTarget, by: number) =>
    Math.min(target.price + by, target.ship.msrp - 5);
  const [first, second, third] = warbonds;
  const sightings: WarbondSighting[] = [];
  if (first) {
    sightings.push(
      sighting(first, first.price, 372, 360, [DEMO_EVENTS.iae]),
      sighting(first, higher(first, 10), 190, 181, [DEMO_EVENTS.invictus]),
      sighting(first, higher(first, 5), 64, 62),
      sighting(first, first.price, 3, 0, [DEMO_EVENTS.iae]),
    );
  }
  if (second) {
    sightings.push(
      sighting(second, second.price - 5, 120, 113),
      sighting(second, second.price, 2, 0, [DEMO_EVENTS.iae]),
    );
  }
  if (third) sightings.push(sighting(third, third.price, 0.1, 0));
  sightings.sort((a, b) => a.firstSeen - b.firstSeen);
  return { version: WARBOND_HISTORY_VERSION, lastReadAt: now, sightings };
}
