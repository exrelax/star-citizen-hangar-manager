import type { PledgeItem } from '@/hangar/pledge';
import type { Ship } from '@/ships/ships';
import type { DemoCatalog } from './catalog';
import {
  basePledge,
  ccuPledge,
  ccuTargetsOf,
  shipItem,
  usdText,
  warbondDiscount,
  type DemoPledge,
} from './generate-hangar';
import type { DemoRandom } from './random';

/*
 * The groups of the Grouped View in the demo hangar (#450): the same items several times, so each
 * case of the grouped view shows – besides the groups chance makes.
 *
 * - `refund`: two CCUs from a ship RSI always sells (`DEMO_ALWAYS_AVAILABLE_BASES`) to the target of
 *   the hangar's first CCU, a standard and a warbond one, right after the newest pledge: the first
 *   two money-paid pledges, so both can be refunded with different days left ("Base always
 *   available", the refund countdown of several items).
 * - `missing`: three CCUs from a ship nothing in the hangar gives, one of them the third pledge to
 *   refund, in its last week, and two older ones – a standard one, a warbond one and one with a surcharge ("Base ship
 *   missing", the countdown of one item among several, a discount with a surcharge among it).
 * - `gear` and `package`: a copy of the first gear item and of the last game package, neither
 *   giftable nor meltable with their originals.
 * - `extras`: three ships equal to the current ship of an upgraded pledge, with added gear, a Best
 *   in Show paint and other insurances (`withExtrasGroup`), some giftable and meltable.
 */

export type DemoGroupRole = 'refund' | 'missing' | 'gear' | 'package' | 'extras';

/**
 * Ships RSI keeps on sale all the time, by the website's ship facts: the base of the `refund`
 * group, so its CCUs show "Base always available" (#112) where the list has them.
 */
export const DEMO_ALWAYS_AVAILABLE_BASES = [
  'Mustang Alpha',
  'Avenger Titan',
  '300i',
  'Aurora Mk II',
  'Cutlass Black',
  'Freelancer',
];

/**
 * How much more than the price difference the CCU of the `missing` group with a surcharge cost:
 * less than its warbond CCU saves, so the group's sum stays a discount.
 */
const SURCHARGE = 5;

/** The pledges the groups add to the generated hangar's composition, by kind. */
export const DEMO_GROUP_PLEDGES = { ccus: 5, gear: 1, packages: 1 } as const;

/**
 * The base ship of the `missing` group: a ship RSI doesn't always sell with a pricier one to go to,
 * between $150 and $700. The demo hangar and buy back leave it out (`withoutShip`), so nothing gives
 * it.
 */
export function demoMissingBase(random: DemoRandom, catalog: DemoCatalog): Ship | undefined {
  const targets = ccuTargetsOf(catalog.ships);
  const top = Math.max(...targets.map((ship) => ship.msrp));
  return random.pick(
    'group:missingBase',
    targets
      .filter(
        (ship) =>
          ship.msrp >= 150 &&
          ship.msrp <= 700 &&
          ship.msrp + 20 <= top &&
          !DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name),
      )
      .sort((a, b) => a.id - b.id),
  );
}

/** The catalog without `ship`, for the pledges that mustn't give the `missing` group's base. */
export const withoutShip = (catalog: DemoCatalog, ship: Ship): DemoCatalog => ({
  ...catalog,
  ships: catalog.ships.filter((entry) => entry.id !== ship.id),
});

/** The base ship of the `missing` group of a generated hangar. */
export const missingBaseOf = (pledges: readonly DemoPledge[]): number | undefined =>
  pledges.find((pledge) => pledge.demoGroup === 'missing')?.upgrade?.matchItems[0]?.id;

/**
 * The generated hangar with the CCU, gear and package groups (#450): the first two pledges to
 * refund after the newest one, the third one next, the rest at the end of the list (the oldest).
 */
export function withDemoGroups(
  pledges: readonly DemoPledge[],
  catalog: DemoCatalog,
  random: DemoRandom,
  /** The base ship of the `missing` group (`demoMissingBase`). */
  missingBase?: Ship,
): DemoPledge[] {
  const targets = ccuTargetsOf(catalog.ships).sort((a, b) => a.msrp - b.msrp);
  const first = pledges.find((pledge) => pledge.upgrade && !pledge.demoPivot);
  const target = catalog.ships.find((ship) => ship.id === first?.upgrade?.targetItems[0]?.id);
  if (!first || !target) return [...pledges];
  const group = (role: DemoGroupRole) => ({ demoGroup: role });
  const warbond = (from: Ship, to: Ship, label: string) =>
    Math.max(5, to.msrp - from.msrp - warbondDiscount(random, label, to.msrp));

  const refund: DemoPledge[] = [];
  const always = DEMO_ALWAYS_AVAILABLE_BASES.map((name) =>
    catalog.ships.find((ship) => ship.name === name && ship.msrp < target.msrp),
  ).find(Boolean);
  if (always) {
    const price = Math.max(5, target.msrp - always.msrp);
    refund.push(
      ccuPledge(always, target, price, false, group('refund')),
      ccuPledge(always, target, warbond(always, target, 'group:refund'), true, group('refund')),
    );
  }

  // A target at least $20 pricier: its warbond CCU saves more than the surcharge.
  const base = missingBase;
  const to = base && targets.find((ship) => ship.msrp >= base.msrp + 20);
  const missing: DemoPledge[] =
    base && to
      ? [
          ccuPledge(base, to, Math.max(5, to.msrp - base.msrp), false, group('missing')),
          ccuPledge(base, to, warbond(base, to, 'group:missing'), true, group('missing')),
          ccuPledge(
            base,
            to,
            Math.max(5, to.msrp - base.msrp) + SURCHARGE,
            false,
            group('missing'),
          ),
        ]
      : [];

  const copy = (pledge: DemoPledge | undefined, role: DemoGroupRole) =>
    pledge ? [{ ...pledge, ...group(role) }] : [];
  const gear = pledges.find((pledge) => pledge.demoKind === 'gear');
  const packages = pledges.filter((pledge) => pledge.demoKind === 'packages');
  const pack = packages.at(-1);
  const marked = pledges.map((pledge) =>
    pledge === gear
      ? { ...pledge, ...group('gear') }
      : pledge === pack && packages.length > 1
        ? { ...pledge, ...group('package') }
        : pledge,
  );
  const [newest, ...rest] = marked;
  return [
    ...(newest ? [newest] : []),
    ...refund,
    ...missing.slice(0, 1),
    ...rest,
    ...missing.slice(1),
    ...copy(gear, 'gear'),
    ...(packages.length > 1 ? copy(pack, 'package') : []),
  ];
}

/** The insurances of the `extras` group's ships besides the upgraded pledge's. */
const EXTRAS_INSURANCES = ['6 Month Insurance', 'Lifetime Insurance', '120 Month Insurance'];

/**
 * Three ships equal to the current ship of `upgraded` (#450): the first with added gear, the
 * second with a Best in Show paint, the third plain, each with another insurance. With
 * `upgraded`, they form a group whose extras all differ. Their ids follow `lowestId` downwards.
 */
export function extrasGroup(
  upgraded: DemoPledge,
  catalog: DemoCatalog,
  lowestId: number,
): DemoPledge[] {
  const current = upgraded.items.find((item) => item.kind === 'Ship');
  const ship = catalog.ships.find((entry) => entry.name === current?.title);
  if (!ship) return [];
  const gear = catalog.items.find((entry) => entry.category === 'Gear' && entry.price > 0);
  const added: PledgeItem[][] = [
    gear ? [{ title: gear.name, kind: 'FPS Equipment' }] : [{ title: 'Hangar Poster' }],
    [{ title: `${ship.name} - Best in Show 2955 Livery`, kind: 'Skin' }],
    [],
  ];
  return added.map((extra, index) =>
    basePledge(
      `Standalone Ships - ${ship.name}`,
      ship.msrp,
      [shipItem(ship), ...extra, { title: EXTRAS_INSURANCES[index]!, kind: 'Insurance' }],
      'ships',
      ship.msrp,
      {
        id: lowestId - 1 - index,
        category: 'standalone_ship',
        isUpgradeable: true,
        // Some giftable and meltable: the first both, the second meltable, the third giftable.
        isGiftable: index !== 1,
        isExchangeable: index !== 2,
        demoGroup: 'extras',
        value: usdText(ship.msrp),
      },
    ),
  );
}
