import type { BuybackPledge } from '@/buyback/buyback';
import { createShipFactsLookup } from '@/ships/ship-facts';
import type { Ship } from '@/ships/ships';
import { bundledShipFacts } from '@/ships/sync-ship-facts';
import type { DemoCatalog } from './catalog';
import { DEMO_ALWAYS_AVAILABLE_BASES } from './demo-groups';
import { ccuPledge as buybackCcu } from './generate-buyback';
import { ccuPledge, ccuTargetsOf, warbondDiscount, type DemoPledge } from './generate-hangar';
import type { DemoRandom } from './random';

/*
 * The CCU Consultant's cases in the demo (#425, part of #106): CCUs whose base ship only the demo
 * decides, so each group of the consultant and each kind of base ship coverage (#108) shows on
 * every demo hangar – besides the ones chance makes:
 *
 * - `always`: three CCUs (two the same, one warbond) from a ship RSI always sells that nothing
 *   else gives: the group "Base always available" (#113) and its label without coverage (#112);
 *   with the setting off, "Base ship missing" without the availability part (#114).
 * - `buyback`: two of the same CCU from a ship only the buy back gives, as a ship and as a CCU to
 *   it: the group "Only via buy back" and both kinds of buy back coverage. The ship also leaves the
 *   Pledge Store (`demo-ship-removals.ts`), but with as many ways to it as CCUs from it, it isn't
 *   "Soon without base ship" (#454).
 * - `unavailable`: a CCU from a ship nothing gives but a buy back CCU RSI can't sell again (#207),
 *   which doesn't count: "Base ship missing". The demo gives this ship no Pledge Store page
 *   (`DemoContext.withoutStoreLink`), so a base ship without a link shows too.
 * - `leaving`: two of the same CCU from another ship RSI always sells that nothing gives, leaving
 *   the Pledge Store (`demo-ship-removals.ts`): counted as always available today, "Soon without
 *   base ship" (#454). Only with a second always available ship.
 *
 * The hangar, the buy back and the upgraded pledges leave these base ships out; the buy back gets
 * its pledges for them from `buybackCases`.
 */

export type DemoCcuCase = 'always' | 'buyback' | 'unavailable' | 'leaving';

/** The base ship of each case. */
export type DemoCcuBases = Partial<Record<DemoCcuCase, Ship>>;

const sortedTargets = (catalog: DemoCatalog) =>
  ccuTargetsOf(catalog.ships).sort((a, b) => a.msrp - b.msrp || a.id - b.id);

/**
 * The base ship of each case, none of them in `taken` (e.g. the base of the Grouped View's
 * `missing` group), each with a ship at least $20 pricier for its CCUs to go to. Always available
 * by the website's ship facts as bundled, or not.
 */
export function demoCcuBases(
  random: DemoRandom,
  catalog: DemoCatalog,
  taken: ReadonlySet<number>,
  /**
   * The ships RSI sells CCUs to, if known: the base ships are among them, so the ships it doesn't
   * sell stay free for the Ship Removals' cases (`demo-ship-removals.ts`).
   */
  buyable?: ReadonlySet<number>,
): DemoCcuBases {
  const facts = bundledShipFacts();
  const lookup = facts && createShipFactsLookup(facts);
  const isAlways = (ship: Ship) => lookup?.isAlwaysAvailable(ship.id);
  const sorted = sortedTargets(catalog);
  const top = sorted.at(-1)?.msrp ?? 0;
  const used = new Set(taken);
  const pick = (role: DemoCcuCase, fits: (ship: Ship) => boolean) => {
    const ship = random.pick(
      `ccuCases:${role}`,
      sorted.filter(
        (entry) =>
          !used.has(entry.id) &&
          entry.msrp + 20 <= top &&
          (!buyable || buyable.has(entry.id)) &&
          fits(entry),
      ),
    );
    if (ship) used.add(ship.id);
    return ship;
  };
  // Not always available, in the middle of the prices, with a cheaper ship for a CCU to it.
  const limited = (ship: Ship) =>
    ship.msrp >= 60 &&
    ship.msrp <= 600 &&
    !DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name) &&
    isAlways(ship) !== true;
  // Always available by the facts, not one of the Grouped View's `refund` group; else by the list.
  const always =
    pick(
      'always',
      (ship) => isAlways(ship) === true && !DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name),
    ) ?? pick('always', (ship) => DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name));
  const buyback = pick('buyback', limited);
  const unavailable = pick('unavailable', limited);
  // Only by the facts: the list's ships may be the `refund` group's.
  const leaving = pick(
    'leaving',
    (ship) => isAlways(ship) === true && !DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name),
  );
  return {
    ...(always && { always }),
    ...(buyback && { buyback }),
    ...(unavailable && { unavailable }),
    ...(leaving && { leaving }),
  };
}

/** The base ship ids of the cases, which no other pledge may give. */
export const reservedShips = (bases: DemoCcuBases): number[] =>
  Object.values(bases).map((ship) => ship.id);

/** The cases' base ships of a generated hangar, by its CCUs. */
export function ccuCaseBasesOf(pledges: readonly DemoPledge[], catalog: DemoCatalog): DemoCcuBases {
  const bases: DemoCcuBases = {};
  for (const pledge of pledges) {
    const id = pledge.upgrade?.matchItems[0]?.id;
    const ship = catalog.ships.find((entry) => entry.id === id);
    if (pledge.demoCcuCase && ship) bases[pledge.demoCcuCase] ??= ship;
  }
  return bases;
}

/**
 * The hangar's CCUs of the cases: from each base ship to the next ship at least $20 pricier of
 * `catalog` – one without the ships nothing may give, as a CCU to one gives it.
 */
export function hangarCases(
  bases: DemoCcuBases,
  catalog: DemoCatalog,
  random: DemoRandom,
): DemoPledge[] {
  const sorted = sortedTargets(catalog);
  const ccus = (role: DemoCcuCase, count: 1 | 2 | 3): DemoPledge[] => {
    const base = bases[role];
    const to = base && sorted.find((ship) => ship.msrp >= base.msrp + 20);
    if (!base || !to) return [];
    const price = Math.max(5, to.msrp - base.msrp);
    const extra = { demoCcuCase: role };
    const standard = ccuPledge(base, to, price, false, extra);
    if (count === 1) return [standard];
    if (count === 2) return [standard, { ...standard }];
    const warbond = Math.max(5, price - warbondDiscount(random, `ccuCases:${role}`, to.msrp));
    return [standard, { ...standard }, ccuPledge(base, to, warbond, true, extra)];
  };
  return [
    ...ccus('always', 3),
    ...ccus('buyback', 2),
    ...ccus('unavailable', 1),
    ...ccus('leaving', 2),
  ];
}

/**
 * The buy back's pledges of the cases: the `buyback` base ship as a ship and a CCU to it from the
 * next cheaper ship, and a CCU to the `unavailable` base ship from one as pricey or pricier, which
 * RSI can't sell again. None of them from or to another base ship of the cases.
 */
export function buybackCases(
  bases: DemoCcuBases,
  catalog: DemoCatalog,
): Omit<BuybackPledge, 'id'>[] {
  const sorted = sortedTargets(catalog);
  const reserved = new Set(reservedShips(bases));
  const free = (ship: Ship) => !reserved.has(ship.id);
  const pledges: Omit<BuybackPledge, 'id'>[] = [];
  const { buyback, unavailable } = bases;
  if (buyback) {
    pledges.push(buybackShip(buyback));
    const from = sorted.findLast((ship) => ship.msrp < buyback.msrp && free(ship));
    if (from) pledges.push(buybackCcu(from, buyback));
  }
  if (unavailable) {
    const from = sorted.find((ship) => ship.msrp >= unavailable.msrp && free(ship));
    if (from) pledges.push(buybackCcu(from, unavailable));
  }
  return pledges;
}

/** A ship of the buy back as RSI lists a melted standalone ship. */
function buybackShip(ship: Pick<Ship, 'name'>): Omit<BuybackPledge, 'id'> {
  return {
    title: `Standalone Ships - ${ship.name} - LTI`,
    contained: `${ship.name} and 2 items`,
    items: [ship.name, 'Lifetime Insurance', 'Hangar Decoration'],
    isUpgrade: false,
    category: 'standalone_ship',
  };
}

/**
 * Ships for the buy back so every CCU of the hangar has a base ship (#425, demo setting "CCUs
 * without base ship coverage" off): for each base ship as many as its CCUs lack, counting the
 * hangar's ships and CCUs to it and the buy back's ships – nothing without base ship then, nothing
 * soon without one and no base ship with too few ways (#113, #115, #454).
 */
export function coverageFillers(
  hangar: readonly DemoPledge[],
  buyback: readonly Omit<BuybackPledge, 'id'>[],
): Omit<BuybackPledge, 'id'>[] {
  const ccus = new Map<string, number>();
  const ways = new Map<string, number>();
  const add = (map: Map<string, number>, name: string | undefined) => {
    if (name) map.set(name, (map.get(name) ?? 0) + 1);
  };
  for (const pledge of hangar) {
    if (pledge.upgrade) {
      add(ccus, pledge.upgrade.matchItems[0]?.name);
      add(ways, pledge.upgrade.targetItems[0]?.name);
      continue;
    }
    // Each ship once per pledge.
    const names = new Set(
      pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title),
    );
    for (const name of names) add(ways, name);
  }
  for (const pledge of buyback) {
    if (pledge.category === 'standalone_ship' || pledge.category === 'game_package') {
      add(ways, pledge.items?.[0]);
    }
  }
  return [...ccus].flatMap(([name, count]) =>
    Array.from({ length: Math.max(0, count - (ways.get(name) ?? 0)) }, () => buybackShip({ name })),
  );
}
