import type { BuybackPledge } from '@/buyback/buyback';
import { chainCoverage } from '@/ccu-consultant/chain-coverage';
import type { CcuCoverage } from '@/ccu-consultant/coverage';
import { createShipFactsLookup } from '@/ships/ship-facts';
import type { Ship } from '@/ships/ships';
import { bundledShipFacts } from '@/ships/sync-ship-facts';
import type { DemoCatalog } from './catalog';
import { DEMO_ALWAYS_AVAILABLE_BASES } from './demo-groups';
import { ccuPledge as buybackCcu } from './generate-buyback';
import {
  basePledge,
  ccuPledge,
  ccuTargetsOf,
  shipItem,
  warbondDiscount,
  type DemoPledge,
} from './generate-hangar';
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
 * - `covered`: two of the same CCU from a ship the hangar and the buy back give once each, as a
 *   standalone ship: a group covered fully by a hangar ship and a buy back ship (#575, for #574).
 * - `partial`: five of the same CCU from a ship the hangar gives twice: "2 of 5 covered" (#575).
 * - `chainStart` and `chainLink`: a CCU from a ship nothing gives and RSI doesn't sell now (if
 *   known, else the `unavailable` case's ship) to another ship, and a CCU from that one on: the
 *   simple view counts the second covered by the first, the deep view (#563) follows the chain and
 *   finds both short of a way – "Found by the deep view" and a base ship not on sale.
 * - `buybackBase`, `linkOnSale` and `linkOffSale` (#651): four CCUs from `buybackBase`, and in the
 *   buy back two CCUs to it from each link, a ship the hangar has once, one RSI sells now and one
 *   it doesn't (if known). RSI doesn't sell `buybackBase` now (if known), so its secure panel
 *   offers the links. The simple view counts the four CCUs covered by the buy back's; the
 *   deep view follows them to their links and counts one of each: two short, "Found by the deep
 *   view", and the links in the secure panel on sale and not.
 *
 * The hangar, the buy back and the upgraded pledges leave these base ships out; the buy back gets
 * its pledges for them from `buybackCases`, also CCU groups of its own (#575): from the `covered`,
 * `partial` and `always` base ships and from the Grouped View's base ship without coverage, so a
 * group of each coverage shows in the buy back, too.
 */

export type DemoCcuCase =
  | 'always'
  | 'buyback'
  | 'unavailable'
  | 'leaving'
  | 'covered'
  | 'partial'
  | 'chainStart'
  | 'chainLink'
  | 'buybackBase'
  | 'linkOnSale'
  | 'linkOffSale';

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
  const pick = (role: DemoCcuCase, fits: (ship: Ship) => boolean, onSale = true) => {
    const ship = random.pick(
      `ccuCases:${role}`,
      sorted.filter(
        (entry) =>
          !used.has(entry.id) &&
          entry.msrp + 20 <= top &&
          (!buyable || buyable.has(entry.id) === onSale) &&
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
  const covered = pick('covered', limited);
  const partial = pick('partial', limited);
  // Only by the facts: the list's ships may be the `refund` group's.
  const leaving = pick(
    'leaving',
    (ship) => isAlways(ship) === true && !DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name),
  );
  // The chain of the deep view (#563): its start a ship RSI doesn't sell now, if that is known,
  // else the `unavailable` case's ship, which nothing gives either.
  const chainStart =
    (buyable && pick('chainStart', (ship) => limited(ship) && ship.msrp + 40 <= top, false)) ||
    unavailable;
  const chainLink =
    chainStart && pick('chainLink', (ship) => limited(ship) && ship.msrp >= chainStart.msrp + 20);
  // The links of the buy back's CCUs (#651), one on sale and one not (if known), and the base ship
  // they lead to, at least $20 pricier than both.
  const linkOnSale = pick('linkOnSale', (ship) => limited(ship) && ship.msrp + 40 <= top);
  const linkOffSale =
    linkOnSale && pick('linkOffSale', (ship) => limited(ship) && ship.msrp + 40 <= top, !buyable);
  const buybackBase =
    linkOnSale &&
    linkOffSale &&
    pick(
      'buybackBase',
      (ship) => limited(ship) && ship.msrp >= Math.max(linkOnSale.msrp, linkOffSale.msrp) + 20,
      // Not on sale (if known): its secure panel offers the links only then.
      !buyable,
    );
  return {
    ...(always && { always }),
    ...(buyback && { buyback }),
    ...(unavailable && { unavailable }),
    ...(leaving && { leaving }),
    ...(covered && { covered }),
    ...(partial && { partial }),
    ...(chainStart && chainLink && { chainStart, chainLink }),
    ...(linkOnSale && linkOffSale && buybackBase && { linkOnSale, linkOffSale, buybackBase }),
  };
}

/** The base ship ids of the cases, which no other pledge may give. */
export const reservedShips = (bases: DemoCcuBases): number[] =>
  Object.values(bases).map((ship) => ship.id);

/** The cases' base ships of a generated hangar, by its CCUs. */
export function ccuCaseBasesOf(pledges: readonly DemoPledge[], catalog: DemoCatalog): DemoCcuBases {
  const bases: DemoCcuBases = {};
  for (const pledge of pledges) {
    if (!pledge.demoCcuCase) continue;
    // A CCU by its base ship; a ship of a case (the links of #651 have no CCU from them) by name.
    const id = pledge.upgrade?.matchItems[0]?.id;
    const name = pledge.upgrade ? undefined : pledge.items.find((item) => item.kind === 'Ship');
    const ship = catalog.ships.find((entry) =>
      id !== undefined ? entry.id === id : entry.name === name?.title,
    );
    if (ship) bases[pledge.demoCcuCase] ??= ship;
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
  /** `discount`: bought that much below today's price difference. */
  const ccus = (role: DemoCcuCase, count: 1 | 2 | 3 | 4 | 5, discount = 0): DemoPledge[] => {
    const base = bases[role];
    const to = base && sorted.find((ship) => ship.msrp >= base.msrp + 20);
    if (!base || !to) return [];
    const price = Math.max(5, to.msrp - base.msrp - discount);
    const extra = { demoCcuCase: role };
    const standard = ccuPledge(base, to, price, false, extra);
    if (count === 1) return [standard];
    if (count !== 3) return Array.from({ length: count }, () => ({ ...standard }));
    const warbond = Math.max(5, price - warbondDiscount(random, `ccuCases:${role}`, to.msrp));
    return [standard, { ...standard }, ccuPledge(base, to, warbond, true, extra)];
  };
  return [
    ...ccus('always', 3),
    ...ccus('buyback', 2),
    ...ccus('unavailable', 1),
    ...ccus('leaving', 2),
    ...ccus('covered', 2),
    ...ships('covered', 1, bases),
    ...ccus('partial', 5),
    ...ships('partial', 2, bases),
    ...chain(bases, sorted),
    ...(bases.linkOnSale && bases.linkOffSale ? ccus('buybackBase', 4, DISCOUNT) : []),
    ...ships('linkOnSale', 1, bases),
    ...ships('linkOffSale', 1, bases),
  ];
}

/**
 * The deep view's chain (#563): a CCU from `chainStart` to `chainLink`, and one from `chainLink` to
 * the next ship at least $20 pricier.
 */
function chain(bases: DemoCcuBases, sorted: readonly Ship[]): DemoPledge[] {
  const { chainStart, chainLink } = bases;
  const to = chainLink && sorted.find((ship) => ship.msrp >= chainLink.msrp + 20);
  if (!chainStart || !chainLink || !to) return [];
  // Bought before a price increase, below today's price difference: the deep view needs a way for
  // both (#651).
  return [
    ccuPledge(chainStart, chainLink, chainLink.msrp - chainStart.msrp - DISCOUNT, false, {
      demoCcuCase: 'chainStart',
    }),
    ccuPledge(chainLink, to, to.msrp - chainLink.msrp - DISCOUNT, false, {
      demoCcuCase: 'chainLink',
    }),
  ];
}

/** What the CCUs of the deep view's cases were bought for below today's price difference. */
const DISCOUNT = 10;

/** `count` standalone ships of a case's base ship, as the hangar's ships that cover its CCUs. */
function ships(role: DemoCcuCase, count: number, bases: DemoCcuBases): DemoPledge[] {
  const ship = bases[role];
  if (!ship) return [];
  return Array.from({ length: count }, () =>
    basePledge(
      `Standalone Ships - ${ship.name}`,
      ship.msrp,
      [shipItem(ship), { title: '120 Month Insurance', kind: 'Insurance' }],
      'ships',
      ship.msrp,
      // Marked as the case's, so no demo state upgrades it to another ship.
      { category: 'standalone_ship', isUpgradeable: true, demoCcuCase: role },
    ),
  );
}

/**
 * The buy back's pledges of the cases: the `buyback` base ship as a ship and a CCU to it from the
 * next cheaper ship, a CCU to the `unavailable` base ship from one as pricey or pricier, which
 * RSI can't sell again, and the `covered` base ship as a ship. Its CCU groups (#575): two CCUs from
 * the `covered` base ship (covered fully), three from the `partial` one ("2 of 3 covered"), two
 * from the `always` one ("Base always available") and two from `missing` (none). None of them to
 * another base ship of the cases, but two CCUs from each link to `buybackBase` (#651).
 */
export function buybackCases(
  bases: DemoCcuBases,
  catalog: DemoCatalog,
  more: {
    /** The base ship of the Grouped View's `missing` group, if known. */
    missing?: Ship;
    /** Ships the CCU groups mustn't go to, e.g. those RSI sells no CCUs to (#311). */
    avoid?: ReadonlySet<number>;
  } = {},
): Omit<BuybackPledge, 'id'>[] {
  const { missing, avoid = new Set() } = more;
  const sorted = sortedTargets(catalog);
  const reserved = new Set([...reservedShips(bases), ...(missing ? [missing.id] : [])]);
  const free = (ship: Ship) => !reserved.has(ship.id);
  const pledges: Omit<BuybackPledge, 'id'>[] = [];
  const { buyback, unavailable } = bases;
  const group = (base: Ship | undefined, count: number) => {
    const to =
      base &&
      sorted.find((ship) => ship.msrp >= base.msrp + 20 && free(ship) && !avoid.has(ship.id));
    if (base && to) pledges.push(...Array.from({ length: count }, () => buybackCcu(base, to)));
  };
  if (bases.covered) pledges.push(buybackShip(bases.covered));
  group(bases.covered, 2);
  group(bases.partial, 3);
  group(bases.always, 2);
  group(missing, 2);
  if (buyback) {
    pledges.push(buybackShip(buyback));
    const from = sorted.findLast((ship) => ship.msrp < buyback.msrp && free(ship));
    if (from) pledges.push(buybackCcu(from, buyback));
  }
  if (unavailable) {
    const from = sorted.find((ship) => ship.msrp >= unavailable.msrp && free(ship));
    if (from) pledges.push(buybackCcu(from, unavailable));
  }
  const { buybackBase, linkOnSale, linkOffSale } = bases;
  if (buybackBase && linkOnSale && linkOffSale) {
    for (const link of [linkOnSale, linkOffSale]) {
      pledges.push(buybackCcu(link, buybackBase), buybackCcu(link, buybackBase));
    }
  }
  return pledges;
}

/** A ship of the buy back as RSI lists a melted standalone ship. */
function buybackShip(ship: Pick<Ship, 'name'>): Omit<BuybackPledge, 'id'> {
  return {
    title: `Standalone Ships - ${ship.name} - LTI`,
    contained: `${ship.name} and 2 items`,
    items: [ship.name, 'Lifetime Insurance', 'Self-Land Hangar'],
    isUpgrade: false,
    category: 'standalone_ship',
  };
}

/**
 * Ships for the buy back so every CCU of the hangar has a base ship (#425, demo setting "CCUs
 * without base ship coverage" off): for each base ship as many as its CCUs lack, counting the
 * hangar's ships, its CCUs to it whose own base ship has a way (the deep view's chain rule, #563)
 * and the buy back's ships – nothing without base ship then, nothing soon without one and no base
 * ship with too few ways in either view (#113, #115, #454). A ship short only because a CCU to it
 * lacks its own base ship gets that one's fillers first.
 */
export function coverageFillers(
  hangar: readonly DemoPledge[],
  buyback: readonly Omit<BuybackPledge, 'id'>[],
): Omit<BuybackPledge, 'id'>[] {
  const match = (source: 'hangar' | 'buyback', kind: 'ship' | 'ccu', id: number) =>
    ({ source, kind, id, title: '' }) as const;
  const ccus = hangar.flatMap((pledge, id) => {
    const from = pledge.upgrade?.matchItems[0]?.name;
    const to = pledge.upgrade?.targetItems[0]?.name;
    return pledge.upgrade && from ? [{ id, from, to }] : [];
  });
  const owned = (pledges: readonly { items: readonly string[] }[], name: string) =>
    pledges.flatMap((pledge, id) => (pledge.items.includes(name) ? [id] : []));
  const hangarShips = hangar.map((pledge) => ({
    // Each ship once per pledge.
    items: pledge.upgrade
      ? []
      : [...new Set(pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title))],
  }));
  const buybackShips = buyback.map((pledge) => ({
    items:
      pledge.category === 'standalone_ship' || pledge.category === 'game_package'
        ? (pledge.items ?? []).slice(0, 1)
        : [],
  }));
  const fillers: Omit<BuybackPledge, 'id'>[] = [];
  const coverages = () =>
    ccus.map((ccu): CcuCoverage => {
      const given = [
        ...owned(buybackShips, ccu.from),
        ...fillers.flatMap((filler, index) =>
          filler.items?.[0] === ccu.from ? [buyback.length + index] : [],
        ),
      ];
      return {
        id: ccu.id,
        baseShip: { name: ccu.from },
        hangar: {
          ships: owned(hangarShips, ccu.from).map((id) => match('hangar', 'ship', id)),
          ccus: ccus
            .filter((other) => other.to === ccu.from && other.id !== ccu.id)
            .map((other) => match('hangar', 'ccu', other.id)),
        },
        buyback: { ships: given.map((id) => match('buyback', 'ship', id)), ccus: [] },
        covered: true,
      };
    });
  // One base ship at a time, those short of their own ways first, until none is short.
  for (let round = 0; round <= ccus.length; round++) {
    const { tooFew } = chainCoverage(coverages(), undefined);
    const next = tooFew.find((ship) => !ship.blocked.length) ?? tooFew[0];
    if (!next?.name) break;
    fillers.push(...Array.from({ length: next.short }, () => buybackShip({ name: next.name! })));
  }
  return fillers;
}
