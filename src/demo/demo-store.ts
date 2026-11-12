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
import type { Pledge } from '@/hangar/pledge';
import { CCU_TARGET_MAX, warbondDiscount } from './generate-hangar';
import { createRandom } from './random';

/*
 * The warbond CCUs of the demo's Pledge Store tab (#130): offers of its own instead of the
 * Pledge Store's, so the tab shows them on any account and with either source of the demo hangar
 * (#298) – for ships the demo hangar has CCUs to, so own CCUs in the same price range show next to
 * them, else for the most expensive ships of the catalog in range.
 */
export function demoStoreData(
  catalog: DemoCatalog,
  hangar: readonly Pick<Pledge, 'upgrade'>[],
  now = Date.now(),
  events: readonly StarCitizenEvent[] = demoEvents(now),
): StoreData {
  const targets = [
    ...new Set(hangar.flatMap((pledge) => pledge.upgrade?.targetItems[0]?.name ?? [])),
  ]
    .map((name) => catalog.ships.find((ship) => ship.name === name))
    .filter((ship) => ship !== undefined && ship.msrp >= 60 && ship.msrp <= CCU_TARGET_MAX)
    .slice(0, CURRENT_OFFERS) as Ship[];
  // A hangar with fewer CCUs in range (e.g. the own pledges as source, #298): other ships fill up.
  const inRange = (ship: Ship) => ship.msrp >= 60 && ship.msrp <= CCU_TARGET_MAX;
  for (const ship of [...catalog.ships].sort((a, b) => b.msrp - a.msrp || a.id - b.id)) {
    if (targets.length >= CURRENT_OFFERS) break;
    if (inRange(ship) && !targets.includes(ship)) targets.push(ship);
  }
  const random = createRandom('demo-store');
  const offerOf = (ship: Ship): WarbondTarget => ({
    ship,
    skuId: ship.id,
    price: ship.msrp - warbondDiscount(random, `warbond:${ship.id}`, ship.msrp),
  });
  const warbonds = targets.map(offerOf);
  // Other ships for the expired offers of the history (#297), in a fixed order.
  // Spread over the catalog, so they come from several manufacturers for the search.
  const others = catalog.ships
    .filter((ship) => !targets.includes(ship) && inRange(ship))
    .sort((a, b) => a.id - b.id);
  const step = Math.max(1, Math.floor(others.length / EXPIRED_OFFERS));
  const expired = others
    .filter((_, index) => index % step === 0)
    .slice(0, EXPIRED_OFFERS)
    .map(offerOf);
  return {
    ships: [...catalog.ships],
    warbonds,
    history: demoWarbondHistory(warbonds, expired, now, events),
  };
}

const DAY = 24 * 60 * 60 * 1000;

/** The demo's current warbond offers. */
const CURRENT_OFFERS = 3;

/** Expired offers of other ships than the current ones in the demo's history (#297). */
const EXPIRED_OFFERS = 8;

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
 * Expired offers of other ships for the "Warbond CCU History" (#297): three during the running
 * event (or the days before, without one), about 20 days ago at an event, about 45 and 100 days ago
 * without one, about 150 days ago at another event and about 170 days ago without one.
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

  // With the earlier offers of the current ships above (64 and 120 days ago), the expired ones
  // are 3 in the event's period, 6 within 90 days and 10 within 180 days.
  const [during1, during2, during3, recent, older, mid1, mid2, oldest] = expired;
  const duringEvent = (target: WarbondTarget | undefined, from: number, to: number) => {
    if (!target) return;
    sightings.push(
      expo
        ? sighting(target, target.price, sinceExpo * from, sinceExpo * to, running)
        : sighting(target, target.price, 1 + from, 1 + to),
    );
  };
  duringEvent(during1, 1, 0.75);
  duringEvent(during2, 0.8, 0.5);
  duringEvent(during3, 0.6, 0.25);
  if (recent) sightings.push(sighting(recent, recent.price, 21, 17, [DEMO_EVENTS.iae]));
  if (older) sightings.push(sighting(older, higher(older, 5), 46, 44));
  if (mid1) sightings.push(sighting(mid1, higher(mid1, 10), 104, 98));
  if (mid2) sightings.push(sighting(mid2, mid2.price, 152, 143, [DEMO_EVENTS.invictus]));
  if (oldest) sightings.push(sighting(oldest, oldest.price, 172, 166));
  sightings.sort((a, b) => a.firstSeen - b.firstSeen);
  return { version: WARBOND_HISTORY_VERSION, lastReadAt: now, sightings };
}
