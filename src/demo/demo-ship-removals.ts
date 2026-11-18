import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { hangarCcus, removalCcus, type RemovalCcus } from '@/ship-removals/removal-ccus';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { DayOrTime } from '@/site-data/site-data';
import type { Ship } from '@/ships/ships';

/*
 * The ships leaving the Pledge Store in the demo (#292, part of Ship Removals #285) instead of the
 * website's file: picked from the catalog by the CCUs of the shown demo hangar and buy back, with
 * dates relative to now, so every case shows:
 * - one ship alone on a date with a time, without CCUs from it in the hangar (and preferably none
 *   to it), not on sale (no "Ship upgrade", #391): the sidebar notification without a warning;
 * - two ships on a day: one with CCUs from it in the hangar and as many CCUs to it (the
 *   yellow-orange warning, #287), also on sale now but not always available (#293, with the demo's
 *   event if one runs), and one without CCUs (#380), on sale ("Ship upgrade" alone);
 * - two ships on a later day: one with fewer CCUs to it than from it in the hangar (red), and one
 *   of the demo's warbond offers ("Warbond upgrade" next to "Ship upgrade", #392).
 * Ships with a price increase of the demo are avoided while others fit. A case the demo hangar
 * can't give (e.g. without CCUs) is left out.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** The source of the demo's removals: RSI's Comm-Link, no real post. */
export const DEMO_REMOVAL_SOURCE = 'https://robertsspaceindustries.com/comm-link';

/** A day (UTC), `days` days from now. */
const day = (now: number, days: number): DayOrTime => ({
  at: Date.parse(new Date(now + days * DAY).toISOString().slice(0, 10)),
  dayOnly: true,
});

export interface DemoShipRemovalsInput {
  /** The catalog's ships (the upgrade tool's ids). */
  ships: readonly Ship[];
  hangar: readonly PledgeView[];
  buyback: readonly BuybackView[];
  /** The ships RSI sells CCUs to, if known. */
  buyable?: ReadonlySet<number>;
  /** The ships of the demo's current warbond offers. */
  warbondShips: ReadonlySet<number>;
  /** The ships of the demo's price increases, avoided while others fit. */
  avoid: ReadonlySet<number>;
  now: number;
}

export interface DemoShipRemovals {
  removals: ShipRemoval[];
  /** The ships on sale now but not always available (#293). */
  limited: ReadonlySet<number>;
}

export function demoShipRemovals(input: DemoShipRemovalsInput): DemoShipRemovals {
  const { now } = input;
  // Every ship as a candidate, to count the CCUs from and to it as #287 does.
  const candidates = removalCcus({
    removals: input.ships.map((ship) => ({
      ship: { id: ship.id, name: ship.name },
      removedAt: { at: now + 365 * DAY },
      source: DEMO_REMOVAL_SOURCE,
    })),
    ships: input.ships,
    hangar: input.hangar,
    buyback: input.buyback,
    now,
  });
  const used = new Set<number>();
  const onSale = (entry: RemovalCcus) => !input.buyable || input.buyable.has(entry.removal.ship.id);
  /** The first entry that fits, preferring ships without a price increase. */
  const pick = (fits: (entry: RemovalCcus) => boolean, order = candidates) => {
    const free = order.filter((entry) => !used.has(entry.removal.ship.id) && fits(entry));
    const entry = free.find((candidate) => !input.avoid.has(candidate.removal.ship.id)) ?? free[0];
    if (entry) used.add(entry.removal.ship.id);
    return entry;
  };
  const from = (entry: RemovalCcus) => hangarCcus(entry.from);
  const none = (entry: RemovalCcus) => !entry.from.length && !entry.to.length;

  // The biggest shortage first: red.
  const critical = pick(
    (entry) => entry.level === 'critical',
    [...candidates].sort((a, b) => from(b) - b.to.length - (from(a) - a.to.length)),
  );
  const warning = pick((entry) => entry.level === 'warning');
  // Without CCUs from it in the hangar: no warning, preferably none to it either.
  const quiet = (fits: (entry: RemovalCcus) => boolean) =>
    pick((entry) => none(entry) && fits(entry)) ?? pick((entry) => !entry.level && fits(entry));
  const isWarbond = (entry: RemovalCcus) => input.warbondShips.has(entry.removal.ship.id);
  const warbond =
    pick((entry) => isWarbond(entry) && !entry.level && onSale(entry)) ??
    pick((entry) => isWarbond(entry) && onSale(entry));
  const standard = quiet((entry) => onSale(entry) && !isWarbond(entry));
  // Not on sale while it is known which ships are.
  const alone = quiet((entry) => !input.buyable?.size || !input.buyable.has(entry.removal.ship.id));

  const removal = (entry: RemovalCcus | undefined, removedAt: DayOrTime): ShipRemoval[] =>
    entry ? [{ ...entry.removal, removedAt }] : [];
  // On the hour of a fixed time of day, so a notification closed with × stays closed that day.
  const soon = { at: day(now, 4).at + 18 * HOUR };
  const next = day(now, 18);
  const later = day(now, 40);
  return {
    removals: [
      ...removal(alone, soon),
      ...removal(warning, next),
      ...removal(standard, next),
      ...removal(critical, later),
      ...removal(warbond, later),
    ],
    limited: new Set(warning ? [warning.removal.ship.id] : []),
  };
}
