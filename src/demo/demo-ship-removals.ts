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
 *   of the demo's warbond offers ("Warbond upgrade" next to "Ship upgrade", #392);
 * - on the later day also a ship on sale with CCUs from it in the hangar and nothing else giving
 *   it: the CCU Consultant's "Soon without base ship" (#454);
 * - the base ships of two of the CCU Consultant's cases (#425, `demo-ccu-cases.ts`): one always
 *   available today with CCUs from it and nothing giving it ("Soon without base ship" too), and one
 *   the buy back gives as often as the hangar has CCUs from it, which the section leaves out.
 * - one of Melt and Rebuy's ships (#532), a standalone ship of the hangar on a day of its own.
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
  /**
   * The base ships of the CCU Consultant's cases (#425): two that leave too, and the others, which
   * stay so their groups keep showing.
   */
  ccuCases?: { leaving?: number; covered?: number; stay?: readonly number[] };
  /**
   * The ships of Melt and Rebuy's cases (#532): one that leaves on a day of its own, the others
   * stay.
   */
  rebuy?: { leaving?: number; stay?: readonly number[] };
  now: number;
}

export interface DemoShipRemovals {
  removals: ShipRemoval[];
  /** The ships on sale now but not always available (#293). */
  limited: ReadonlySet<number>;
  /** The ships of `removals` on sale now (#454): all but the one alone, while it is known. */
  onSale: ReadonlySet<number>;
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
  const used = new Set<number>(
    [
      input.ccuCases?.leaving,
      input.ccuCases?.covered,
      ...(input.ccuCases?.stay ?? []),
      input.rebuy?.leaving,
      ...(input.rebuy?.stay ?? []),
    ].filter((id) => id !== undefined),
  );
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
  // On sale, with CCUs from it in the hangar and nothing else giving it – no ship, no CCU to it:
  // the CCU Consultant's "Soon without base ship" (#454).
  const owned = new Set(
    [
      ...input.hangar.flatMap((pledge) =>
        pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title),
      ),
      ...input.buyback.flatMap((pledge) => pledge.ships.map((ship) => ship.name)),
    ].map((name) => name.toLowerCase()),
  );
  const uncovered = pick(
    (entry) =>
      from(entry) > 0 &&
      !entry.to.length &&
      onSale(entry) &&
      !owned.has(entry.removal.ship.name.toLowerCase()),
  );

  const removal = (entry: RemovalCcus | undefined, removedAt: DayOrTime): ShipRemoval[] =>
    entry ? [{ ...entry.removal, removedAt }] : [];
  const byShip = (id: number | undefined) =>
    candidates.find((entry) => entry.removal.ship.id === id);
  const leaving = byShip(input.ccuCases?.leaving);
  const covered = byShip(input.ccuCases?.covered);
  const rebuy = byShip(input.rebuy?.leaving);
  // On the hour of a fixed time of day, so a notification closed with × stays closed that day.
  const soon = { at: day(now, 4).at + 18 * HOUR };
  const next = day(now, 18);
  const later = day(now, 40);
  // A day of its own, so the other cases' days keep their ships.
  const rebuyDay = day(now, 25);
  return {
    removals: [
      ...removal(alone, soon),
      ...removal(warning, next),
      ...removal(standard, next),
      ...removal(leaving, next),
      ...removal(uncovered, later),
      ...removal(critical, later),
      ...removal(warbond, later),
      ...removal(covered, later),
      ...removal(rebuy, rebuyDay),
    ],
    limited: new Set(warning ? [warning.removal.ship.id] : []),
    onSale: new Set(
      [warning, standard, uncovered, critical, warbond, leaving, covered, rebuy].flatMap((entry) =>
        entry && onSale(entry) ? [entry.removal.ship.id] : [],
      ),
    ),
  };
}
