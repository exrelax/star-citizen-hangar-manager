import type { StarCitizenEvent } from '@/events/events';
import type { Ship } from '@/ships/ships';
import type { StoreData, WarbondTarget } from '@/store/warbond';
import {
  WARBOND_HISTORY_VERSION,
  type SightingEvent,
  type WarbondHistorySnapshot,
  type WarbondSighting,
} from '@/store/warbond-history';
import type { DemoCatalog } from './catalog';
import { demoEvents } from './demo-events';
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
  events: readonly StarCitizenEvent[] = demoEvents(now),
): StoreData {
  const targets = [
    ...new Set(hangar.flatMap((pledge) => pledge.upgrade?.targetItems[0]?.name ?? [])),
  ]
    .map((name) => catalog.ships.find((ship) => ship.name === name))
    .filter((ship) => ship !== undefined && ship.msrp >= 60 && ship.msrp <= CCU_TARGET_MAX)
    .slice(0, 3) as Ship[];
  const random = createRandom('demo-store');
  const offerOf = (ship: Ship): WarbondTarget => ({
    ship,
    skuId: ship.id,
    price: ship.msrp - warbondDiscount(random, `warbond:${ship.id}`, ship.msrp),
  });
  const warbonds = targets.map(offerOf);
  // Other ships for the expired offers of the history (#297), in a fixed order.
  const expired = catalog.ships
    .filter((ship) => !targets.includes(ship) && ship.msrp >= 60 && ship.msrp <= CCU_TARGET_MAX)
    .sort((a, b) => a.id - b.id)
    .slice(0, 4)
    .map(offerOf);
  return {
    ships: [...catalog.ships],
    warbonds,
    history: demoWarbondHistory(warbonds, expired, now, events),
  };
}

const DAY = 24 * 60 * 60 * 1000;

const DEMO_EVENTS = {
  iae: { id: 'demo-iae', name: { en: 'Intergalactic Aerospace Expo' } },
  invictus: { id: 'demo-invictus', name: { en: 'Invictus Launch Week' } },
} satisfies Record<string, SightingEvent>;

/**
 * The demo's history of warbond offers (#4), made up for its offers: the first seen since the
 * demo's running event began, with earlier offers at two events and one without; the second seen
 * for two days without an event, with one earlier offer at another price; the third seen for the
 * first time during the event, never before.
 *
 * Expired offers of other ships for the "Warbond CCU History" (#297), one in each period: during
 * the running event (or the day before, without one), about 20 days ago at an event, about 45 days
 * ago without one, and about 150 days ago at another event.
 */
export function demoWarbondHistory(
  warbonds: readonly WarbondTarget[],
  expired: readonly WarbondTarget[],
  now: number,
  events: readonly StarCitizenEvent[],
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
  // The demo's running event, as the Pledge Store tab shows it.
  const expo = events.find((event) => event.eventStart <= now && now < event.eventEnd);
  const running = expo && [{ id: expo.id, name: expo.name }];
  const sinceExpo = expo ? (now - expo.eventStart) / DAY : 0.04;
  const [first, second, third] = warbonds;
  const sightings: WarbondSighting[] = [];
  if (first) {
    sightings.push(
      sighting(first, first.price, 372, 360, [DEMO_EVENTS.iae]),
      sighting(first, higher(first, 10), 190, 181, [DEMO_EVENTS.invictus]),
      sighting(first, higher(first, 5), 64, 62),
      sighting(first, first.price, sinceExpo, 0, running),
    );
  }
  if (second) {
    sightings.push(
      sighting(second, second.price - 5, 120, 113),
      sighting(second, second.price, 2, 0),
    );
  }
  if (third) sightings.push(sighting(third, third.price, sinceExpo / 2, 0, running));

  const [duringEvent, recent, older, oldest] = expired;
  if (duringEvent) {
    sightings.push(
      expo
        ? sighting(duringEvent, duringEvent.price, sinceExpo, sinceExpo / 4, running)
        : sighting(duringEvent, duringEvent.price, 1.5, 0.5),
    );
  }
  if (recent) sightings.push(sighting(recent, recent.price, 21, 17, [DEMO_EVENTS.iae]));
  if (older) sightings.push(sighting(older, higher(older, 5), 46, 44));
  if (oldest) sightings.push(sighting(oldest, oldest.price, 152, 143, [DEMO_EVENTS.invictus]));
  sightings.sort((a, b) => a.firstSeen - b.firstSeen);
  return { version: WARBOND_HISTORY_VERSION, lastReadAt: now, sightings };
}
