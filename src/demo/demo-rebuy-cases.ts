import type { PledgeItem } from '@/hangar/pledge';
import { createShipFactsLookup } from '@/ships/ship-facts';
import type { Ship } from '@/ships/ships';
import { bundledShipFacts } from '@/ships/sync-ship-facts';
import { storeNameOf } from '@/store/items/item-prices';
import type { StoreItem } from '@/store/items/store-items';
import type { DemoCatalog } from './catalog';
import {
  basePledge,
  ccuPledge,
  ccuTargetsOf,
  GAME_ITEMS,
  shipItem,
  storeTitle,
  warbondDiscount,
  type DemoPledge,
} from './generate-hangar';
import type { DemoRandom } from './random';

/*
 * The cases of Melt and Rebuy in the demo (#532, part of #527): pledges whose ships, paints and
 * store items only the demo decides, so each case of the rules (`rebuyable.ts`, #528) shows on
 * every demo hangar – besides the ones chance makes. Nothing of the real account: the ships of the
 * catalog, the paints of the Pledge Store and store items made up for the ships.
 *
 * The ships, each with a role (`DemoRebuyShips`): `base` and `target` of the CCUs, a ship whose
 * price rises (`increase`, `demo-price-increases.ts`), one leaving the Pledge Store (`removal`,
 * `demo-ship-removals.ts`), one not always available (`limited`) and one without facts
 * (`unknown`). The demo's own facts (`demoRebuyFacts`) say which are always available, and the
 * demo's Pledge Store (`demo-rebuy-store.ts`) sells each as a standalone ship with an insurance in
 * its name ("Avenger Titan - 10 Year"), instead of the store's real standalone ships.
 *
 * Rebuyable (left out with the demo setting "Rebuyable pledges" off):
 * - `paint`: a paint of the store at its price;
 * - `higherValue`: the same paint bought at an older, higher price – worth more than its price now,
 *   and with `paint` an item counted twice on a watchlist;
 * - `ship`: the `base` ship with 120 months of insurance, sold as "<ship> - 10 Year";
 * - `ccu`: a standard CCU from `base` to `target`;
 * - `paintVolume`: a paint bought at 25 % (a volume discount tier), rebuyable at that tier with the
 *   hint that it needs 5 paints in one cart (#593).
 *
 * Not rebuyable, one reason each:
 * - `giftable`: a giftable paint;
 * - `discount`: a warbond CCU from `base` to `target`;
 * - `upgraded`: a `base` ship upgraded to `target` (with the demo state "upgraded" only);
 * - `package`: a game package with `base`; `extraItems`: `base` with gear;
 * - `notOnSale`: a Best in Show paint of `base` the store doesn't sell;
 * - `insurance`: `base` with LTI, while the store sells it with 10 years only;
 * - `priceIncrease`, `removal`, `notAlwaysAvailable` and `unknown` (availability not known): the
 *   ships of these roles, sold with their insurance;
 * - `refund`: `base` paid with money, still refundable – placed among the first pledges, so it is
 *   the fourth one to refund (`REBUY_REFUND_DAYS_LEFT`);
 * - `several`: the `increase` ship, giftable and bought at a discount – three reasons at once.
 * The newest pledge, a paint bought a few hours ago (`generate-states.ts`), is the case "bought
 * less than 24 hours ago".
 */

export const REBUYABLE_CASES = ['paint', 'higherValue', 'ship', 'ccu', 'paintVolume'] as const;
export const NOT_REBUYABLE_CASES = [
  'giftable',
  'discount',
  'upgraded',
  'package',
  'extraItems',
  'notOnSale',
  'insurance',
  'priceIncrease',
  'removal',
  'notAlwaysAvailable',
  'unknown',
  'refund',
  'several',
] as const;
export type DemoRebuyCase = (typeof REBUYABLE_CASES)[number] | (typeof NOT_REBUYABLE_CASES)[number];

/** The cases that are giftable; all others aren't. */
const GIFTABLE_CASES: readonly DemoRebuyCase[] = ['giftable', 'several'];
/** The cases paid with money; all others with store credit. */
const MONEY_CASES: readonly DemoRebuyCase[] = ['refund', 'discount'];

export const isGiftableCase = (role: DemoRebuyCase) => GIFTABLE_CASES.includes(role);
export const isMoneyCase = (role: DemoRebuyCase) => MONEY_CASES.includes(role);

/** Days left to refund of the case `refund`: the fourth pledge to refund, after `DEMO`'s three. */
export const REBUY_REFUND_DAYS_LEFT = 2;

/** The ships of the cases, by their roles. */
export interface DemoRebuyShips {
  base?: Ship;
  target?: Ship;
  increase?: Ship;
  removal?: Ship;
  limited?: Ship;
  unknown?: Ship;
}

export type DemoRebuyShipRole = keyof DemoRebuyShips;

/** Whether the demo counts the ship of a role as always available; `undefined`: not known. */
const ALWAYS_AVAILABLE: Record<DemoRebuyShipRole, boolean | undefined> = {
  base: true,
  target: true,
  increase: true,
  removal: true,
  limited: false,
  unknown: undefined,
};

/** The insurance each ship is sold with in the demo's Pledge Store. */
const STORE_INSURANCE: Partial<Record<DemoRebuyShipRole, string>> = {
  base: '10 Year',
  increase: 'LTI',
  removal: '10 Year',
  limited: 'LTI',
  unknown: '10 Year',
};

/** Made-up SKUs of the demo's standalone ship items, far from RSI's. */
const SKU_BASE = 980_000_000;

const insurance = (title: string): PledgeItem => ({ title, kind: 'Insurance' });
const LTI = 'Lifetime Insurance';
const TEN_YEARS = '120 Month Insurance';

export interface DemoRebuyInput {
  /** The catalog the cases' ships come from: without the ships other cases keep for themselves. */
  catalog: DemoCatalog;
  /** The full catalog, for the paints and the gear. */
  items: readonly StoreItem[];
  /** The hangar's pledges so far: ships they have are only taken while no other fits. */
  hangar: readonly DemoPledge[];
  /** The ships RSI sells CCUs to, if known. */
  buyable?: ReadonlySet<number>;
  /** Ships the cases leave out, e.g. those of the demo's watchlists. */
  avoid: ReadonlySet<number>;
  /** Whether the rebuyable cases are made (demo setting "Rebuyable pledges"). */
  rebuyable: boolean;
  /** Whether the upgraded case is made (demo state "upgraded"). */
  upgraded: boolean;
  /** Which kinds the composition has: a case of a kind it lacks is left out. */
  kinds: { ships: boolean; paints: boolean; ccus: boolean; packages: boolean };
}

/** The ships of the cases (see the roles above); a role without a fitting ship is left out. */
export function demoRebuyShips(random: DemoRandom, input: DemoRebuyInput): DemoRebuyShips {
  const facts = bundledShipFacts();
  const lookup = facts && createShipFactsLookup(facts);
  const isAlways = (ship: Ship) => lookup?.isAlwaysAvailable(ship.id);
  const touched = new Set<string>();
  const bases = new Set<number>();
  for (const pledge of input.hangar) {
    for (const item of pledge.items) if (item.kind === 'Ship') touched.add(item.title);
    for (const item of [
      ...(pledge.upgrade?.matchItems ?? []),
      ...(pledge.upgrade?.targetItems ?? []),
    ]) {
      touched.add(item.name);
    }
    for (const item of pledge.upgrade?.matchItems ?? []) bases.add(item.id);
  }
  const candidates = ccuTargetsOf(input.catalog.ships)
    .filter((ship) => (!input.buyable || input.buyable.has(ship.id)) && !input.avoid.has(ship.id))
    .sort((a, b) => a.msrp - b.msrp || a.id - b.id);
  const used = new Set<number>();
  /** The first group of the preferences that has a ship, untouched by the hangar first. */
  const pick = (
    role: DemoRebuyShipRole,
    fits: (ship: Ship) => boolean,
    prefer: (ship: Ship) => boolean,
  ) => {
    const free = candidates.filter((ship) => !used.has(ship.id) && fits(ship));
    const untouched = (ship: Ship) => !touched.has(ship.name);
    const ship = [
      free.filter((entry) => untouched(entry) && prefer(entry)),
      free.filter(prefer),
      free.filter(untouched),
      free,
    ]
      .map((list) => random.pick(`rebuy:${role}`, list))
      .find((entry) => entry !== undefined);
    if (ship) used.add(ship.id);
    return ship;
  };
  const always = (ship: Ship) => isAlways(ship) === true;
  const top = candidates.at(-1)?.msrp ?? 0;
  const base = pick('base', (ship) => ship.msrp >= 20 && ship.msrp + 20 <= top, always);
  const target = base ? pick('target', (ship) => ship.msrp >= base.msrp + 20, always) : undefined;
  // Never a base ship of the hangar's CCUs: without "CCUs with their discount at risk" its price
  // increase would go (`generatedDemo`).
  const increase = pick('increase', (ship) => !bases.has(ship.id), always);
  const removal = pick('removal', () => true, always);
  const limited = pick(
    'limited',
    () => true,
    (ship) => isAlways(ship) === false,
  );
  const unknown = pick(
    'unknown',
    () => true,
    (ship) => isAlways(ship) === undefined,
  );
  return {
    ...(base && { base }),
    ...(target && { target }),
    ...(increase && { increase }),
    ...(removal && { removal }),
    ...(limited && { limited }),
    ...(unknown && { unknown }),
  };
}

/** The paints of the cases: in stock, at their standard price, of a name the store has once. */
function rebuyPaints(random: DemoRandom, input: DemoRebuyInput): StoreItem[] {
  const paints = input.items.filter((item) => item.category === 'Paints');
  const count = new Map<string, number>();
  for (const item of input.items) {
    const key = storeNameOf(item.name);
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const owned = new Set(
    input.hangar.flatMap((pledge) => pledge.items.map((item) => storeNameOf(item.title))),
  );
  const fit = paints.filter(
    (item) =>
      item.available &&
      !item.isWarbond &&
      item.discountedPrice === undefined &&
      item.price >= 5 &&
      count.get(storeNameOf(item.name)) === 1,
  );
  const shuffled = random.shuffle('rebuy:paints', fit, (item) => item.id);
  // Paints the hangar doesn't have first.
  return [
    ...shuffled.filter((item) => !owned.has(storeNameOf(item.name))),
    ...shuffled.filter((item) => owned.has(storeNameOf(item.name))),
  ].slice(0, 3);
}

/** A Best in Show paint of `ship` the store doesn't sell: of an earlier year than any it has. */
function retiredPaintName(ship: Ship, items: readonly StoreItem[]): string | undefined {
  const names = new Set(items.map((item) => storeNameOf(item.name)));
  return [2951, 2952, 2953, 2954]
    .map((year) => `${ship.name} - Best in Show ${year} Livery`)
    .find((name) => !names.has(storeNameOf(name)));
}

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * The cases' pledges: `refund` to place among the first pledges, `rest` at the end of the list
 * (the oldest), each marked with its case.
 */
export function demoRebuyCases(
  random: DemoRandom,
  input: DemoRebuyInput,
): { refund?: DemoPledge; rest: DemoPledge[] } {
  const ships = input.kinds.ships || input.kinds.ccus ? demoRebuyShips(random, input) : {};
  const { base, target, increase, removal, limited, unknown } = ships;
  const wanted = (role: DemoRebuyCase) =>
    input.rebuyable || !(REBUYABLE_CASES as readonly string[]).includes(role);
  const cases = new Map<DemoRebuyCase, DemoPledge>();
  const add = (role: DemoRebuyCase, pledge: DemoPledge | undefined) => {
    if (pledge && wanted(role)) cases.set(role, { ...pledge, demoRebuyCase: role });
  };
  const ship = (of: Ship, value: number, insuranceTitle: string, extra: PledgeItem[] = []) =>
    basePledge(
      `Standalone Ships - ${of.name}`,
      value,
      [shipItem(of), insurance(insuranceTitle), ...extra],
      'ships',
      of.msrp,
      { category: 'standalone_ship', isUpgradeable: true },
    );
  const paint = (item: StoreItem, value: number) =>
    basePledge(
      storeTitle('Paints', item.name),
      value,
      [{ title: item.name, kind: 'Skin', ...(item.image && { image: item.image }) }],
      'paints',
      item.price,
    );

  if (input.kinds.paints) {
    const [first, giftable, volume] = rebuyPaints(random, input);
    if (first) {
      add('paint', paint(first, first.price));
      add('higherValue', paint(first, cents(first.price * 1.2)));
    }
    if (giftable) add('giftable', paint(giftable, giftable.price));
    if (volume) add('paintVolume', paint(volume, cents(volume.price * 0.75)));
    const retired = base && retiredPaintName(base, input.items);
    if (retired) {
      add(
        'notOnSale',
        basePledge(`Paints - ${retired}`, 15, [{ title: retired, kind: 'Skin' }], 'paints', 15),
      );
    }
  }
  if (input.kinds.ships && base) {
    add('ship', ship(base, base.msrp, TEN_YEARS));
    add('refund', ship(base, base.msrp, TEN_YEARS));
    add('insurance', ship(base, base.msrp, LTI));
    const gear = input.items.find((item) => item.category === 'Gear' && item.price > 0);
    add(
      'extraItems',
      ship(base, base.msrp, TEN_YEARS, [
        gear
          ? { title: gear.name, kind: 'FPS Equipment' }
          : { title: `${base.name} - Best in Show 2955 Livery`, kind: 'Skin' },
      ]),
    );
    if (target && input.upgraded) {
      add(
        'upgraded',
        basePledge(
          `Standalone Ships - ${base.name}`,
          target.msrp,
          [shipItem(target), insurance(TEN_YEARS)],
          'ships',
          target.msrp,
          { category: 'standalone_ship', isUpgradeable: true, isUpgraded: true },
        ),
      );
    }
  }
  if (input.kinds.packages && base) {
    const price = base.msrp + 20;
    add(
      'package',
      basePledge(
        `Package - ${base.name} Starter Pack`,
        price,
        [shipItem(base), ...GAME_ITEMS, insurance('6 Month Insurance')],
        'packages',
        price,
        { category: 'game_package', isUpgradeable: true },
      ),
    );
  }
  if (input.kinds.ccus && base && target) {
    const price = target.msrp - base.msrp;
    add('ccu', ccuPledge(base, target, price, false));
    const discount = warbondDiscount(random, 'rebuy:discount', target.msrp);
    add('discount', ccuPledge(base, target, Math.max(5, price - discount), true));
  }
  if (input.kinds.ships) {
    if (increase) {
      add('priceIncrease', ship(increase, increase.msrp, LTI));
      // Giftable and below its price, too (`isGiftableCase`).
      const value = Math.max(5, Math.round((increase.msrp * 0.85) / 5) * 5);
      if (value < increase.msrp) add('several', ship(increase, value, LTI));
    }
    if (removal) add('removal', ship(removal, removal.msrp, TEN_YEARS));
    if (limited) add('notAlwaysAvailable', ship(limited, limited.msrp, LTI));
    if (unknown) add('unknown', ship(unknown, unknown.msrp, TEN_YEARS));
  }
  const ORDER: DemoRebuyCase[] = [
    'ship',
    'ccu',
    'paint',
    'higherValue',
    'giftable',
    'paintVolume',
    'discount',
    'upgraded',
    'package',
    'extraItems',
    'notOnSale',
    'insurance',
    'priceIncrease',
    'several',
    'removal',
    'notAlwaysAvailable',
    'unknown',
  ];
  const refund = cases.get('refund');
  return {
    ...(refund && { refund }),
    rest: ORDER.flatMap((role) => cases.get(role) ?? []),
  };
}

/** The ships of a generated hangar's cases, by the ship items of their pledges. */
export function rebuyShipsOf(pledges: readonly DemoPledge[], catalog: DemoCatalog): DemoRebuyShips {
  const byName = (name: string | undefined) =>
    name === undefined ? undefined : catalog.ships.find((ship) => ship.name === name);
  const shipOf = (role: DemoRebuyCase) =>
    byName(
      pledges
        .find((pledge) => pledge.demoRebuyCase === role)
        ?.items.find((item) => item.kind === 'Ship')?.title,
    );
  const ccu = pledges.find(
    (pledge) => pledge.demoRebuyCase === 'discount' || pledge.demoRebuyCase === 'ccu',
  );
  const base = shipOf('insurance') ?? byName(ccu?.upgrade?.matchItems[0]?.name);
  const target = byName(ccu?.upgrade?.targetItems[0]?.name) ?? shipOf('upgraded');
  const increase = shipOf('priceIncrease');
  const removal = shipOf('removal');
  const limited = shipOf('notAlwaysAvailable');
  const unknown = shipOf('unknown');
  return {
    ...(base && { base }),
    ...(target && { target }),
    ...(increase && { increase }),
    ...(removal && { removal }),
    ...(limited && { limited }),
    ...(unknown && { unknown }),
  };
}

/** The ship ids of the cases. */
export const rebuyShipIds = (ships: DemoRebuyShips): number[] =>
  Object.values(ships).map((ship) => ship.id);

/** What the demo knows of the cases' ships: always available, not, or not known (`undefined`). */
export function demoRebuyFacts(ships: DemoRebuyShips): Map<number, boolean | undefined> {
  return new Map(
    (Object.entries(ships) as [DemoRebuyShipRole, Ship][]).map(([role, ship]) => [
      ship.id,
      ALWAYS_AVAILABLE[role],
    ]),
  );
}

/** The demo's standalone ship items for the cases' ships, each with the insurance in its name. */
export function demoRebuyShipItems(ships: DemoRebuyShips): StoreItem[] {
  return (Object.entries(ships) as [DemoRebuyShipRole, Ship][]).flatMap(([role, ship]) => {
    const named = STORE_INSURANCE[role];
    if (!named) return [];
    return [
      {
        id: SKU_BASE + ship.id,
        category: 'Standalone Ships',
        name: `${ship.name} - ${named}`,
        price: ship.msrp,
        isWarbond: false,
        available: true,
        ...(ship.image && { image: ship.image }),
      },
    ];
  });
}

/** What the demo's watchlist of pledges to rebuy holds (`demo-watchlists.ts`, #532). */
export interface DemoRebuyWatchlistCases {
  base?: Ship;
  target?: Ship;
  /** The store paint of the case `paint` (or `higherValue`). */
  paint?: StoreItem;
  /** The name of the Best in Show paint the store doesn't sell (`notOnSale`). */
  retired?: string;
}

export function rebuyWatchlistCases(
  pledges: readonly DemoPledge[],
  ships: DemoRebuyShips,
  catalog: DemoCatalog,
): DemoRebuyWatchlistCases {
  const itemOf = (...roles: DemoRebuyCase[]) =>
    pledges.find((pledge) => pledge.demoRebuyCase && roles.includes(pledge.demoRebuyCase))?.items[0]
      ?.title;
  const paintName = itemOf('paint', 'higherValue', 'giftable');
  const paint = catalog.items.find((item) => item.name === paintName);
  const retired = itemOf('notOnSale');
  return {
    ...(ships.base && { base: ships.base }),
    ...(ships.target && { target: ships.target }),
    ...(paint && { paint }),
    ...(retired && { retired }),
  };
}
