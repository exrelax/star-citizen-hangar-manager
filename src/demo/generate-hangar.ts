import { DEMO } from '@/config';
import type { Pledge, PledgeItem } from '@/hangar/pledge';
import type { Ship } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import type { DemoCatalog } from './catalog';
import { demoCcuBases, hangarCases, reservedShips, type DemoCcuCase } from './demo-ccu-cases';
import { demoMissingBase, withDemoGroups, type DemoGroupRole } from './demo-groups';
import { demoRebuyCases, type DemoRebuyCase } from './demo-rebuy-cases';
import { demoWatchlistShips } from './demo-watchlists';
import { createRandom, type DemoRandom } from './random';

/*
 * The generated demo hangar (#175): pledges made up from the public catalog only – the ships of
 * the upgrade tool and the items of the Pledge Store (`catalog.ts`). Nothing comes from the real
 * hangar: not the items, not their number, not the value. The pledges look like RSI's, as the
 * parser produces them (`parse-pledges.ts`), so every view, filter, tag, search, sorting and the
 * summary work on them unchanged. Everything is random but fixed by the demo key.
 *
 * Their ids are made up too, far above RSI's (`DEMO.idBase`), and the views show them only as
 * made-up display ids (`demo.ts`), so they can't be mistaken for real ones.
 */

/** How many pledges of each kind the generated hangar has (the demo settings, #178). */
export interface DemoComposition {
  ships: number;
  packages: number;
  ccus: number;
  paints: number;
  gear: number;
  addOns: number;
  packs: number;
  rewards: number;
}

export type DemoPledgeKind = keyof DemoComposition;

/** A generated pledge with what the demo needs to know about it besides RSI's fields. */
export interface DemoPledge extends Pledge {
  demoKind: DemoPledgeKind;
  /** The standard price of what it contains, for plausible values and states. */
  standardPrice: number;
  /**
   * Its part in the Price Increase Advisor's chain (#255, `demoPivotShip`): the ship, the CCU to
   * it, the CCU from it.
   */
  demoPivot?: 'ship' | 'ccuTo' | 'ccuFrom';
  /** Its part in the groups of the Grouped View (#450, `demo-groups.ts`). */
  demoGroup?: DemoGroupRole;
  /** Its part in the CCU Consultant's cases (#425, `demo-ccu-cases.ts`). */
  demoCcuCase?: DemoCcuCase;
  /** Its case of Melt and Rebuy (#532, `demo-rebuy-cases.ts`). */
  demoRebuyCase?: DemoRebuyCase;
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
/** RSI's way of writing a value: "$1,234.50 USD". */
export const usdText = (value: number) => `${USD.format(value)} USD`;

/** Rounded to RSI's typical prices: whole dollars, or halves for small ones. */
export const roundPrice = (value: number) =>
  value < 20 ? Math.round(value * 2) / 2 : Math.max(5, Math.round(value / 5) * 5);

/** A pledge with RSI's defaults, as the parser leaves them for a plain store-credit pledge. */
export function basePledge(
  title: string,
  value: number,
  items: PledgeItem[],
  demoKind: DemoPledgeKind,
  standardPrice: number,
  extra: Partial<DemoPledge> = {},
): DemoPledge {
  return {
    id: 0,
    name: title,
    title,
    value: usdText(value),
    valueUsd: value,
    configurationValue: usdText(0),
    currency: 'Store Credit',
    availability: 'Attributed',
    contains: items.map((entry) => entry.title).join(', '),
    image: items.find((entry) => entry.image)?.image,
    isLastAlpha: false,
    isBuybackable: true,
    isGiftable: true,
    isExchangeable: true,
    isUpgradeable: false,
    isUpgraded: false,
    nameReservations: null,
    nameableShips: null,
    items,
    demoKind,
    standardPrice,
    ...extra,
  };
}

export const shipItem = (ship: Ship): PledgeItem => ({
  title: ship.name,
  kind: 'Ship',
  ...(ship.image && { image: ship.image }),
});
const insuranceItem = (title: string): PledgeItem => ({ title, kind: 'Insurance' });
export const GAME_ITEMS: PledgeItem[] = [
  { title: 'Star Citizen Digital Download', kind: 'Digital Download' },
];

/** CIG sells CCUs only to ships up to this standard price, in USD. */
export const CCU_TARGET_MAX = 1000;

/** The standard prices of the demo's warbond offers (`demo-store.ts`): from $60 to the maximum. */
export const isWarbondTargetPrice = (msrp: number) => msrp >= 60 && msrp <= CCU_TARGET_MAX;

/** The ships a CCU can go to: up to `CCU_TARGET_MAX`. */
export const ccuTargetsOf = (ships: readonly Ship[]) =>
  ships.filter((ship) => ship.msrp > 0 && ship.msrp <= CCU_TARGET_MAX);

/**
 * The discount of a warbond CCU to a ship, in USD: always in steps of $5, more for pricier ships –
 * up to $150 $5–10, up to $250 $15–20, up to $600 $20–40, up to $1,000 $40–100.
 */
export function warbondDiscount(random: DemoRandom, label: string, msrp: number): number {
  const [min, max] =
    msrp <= 150 ? [5, 10] : msrp <= 250 ? [15, 20] : msrp <= 600 ? [20, 40] : [40, 100];
  return random.int(label, min / 5, max / 5) * 5;
}

/** The items of a store category, cheapest ones first left out of nothing. */
const itemsOf = (catalog: DemoCatalog, category: string) =>
  catalog.items.filter((entry) => entry.category === category && entry.price > 0);

/** A store item's pledge title: RSI's category in front of the name. */
export const storeTitle = (category: string, name: string) =>
  name.toLowerCase().startsWith(category.toLowerCase()) ? name : `${category} - ${name}`;

/** The value paid: the standard price, sometimes less (sale, warbond) or more (an older price). */
function paidValue(random: DemoRandom, label: string, price: number): number {
  const roll = random.at(`${label}:value`);
  if (roll < 0.45) return price;
  if (roll < 0.9) return roundPrice(price * (0.6 + random.at(`${label}:discount`) * 0.3));
  return roundPrice(price * 1.1);
}

/**
 * The ship of the Price Increase Advisor's chain (#255): in the hangar as a ship, as the target of
 * one CCU and the base of another, so a price increase of it shows each case. A ship CCUs go to
 * with cheaper and pricier ones around it – one RSI sells CCUs to (`buyable`, if known), so the
 * advice recommends CCUs to it. Among the ones whose gap to the next cheaper ship most exceeds the
 * gap to the next pricier one: the CCU from it melts for less than a CCU to it costs, so the
 * advice needs store credit and the demo's store credit (#179) decides whether it is enough.
 */
export function demoPivotShip(
  random: DemoRandom,
  catalog: DemoCatalog,
  buyable?: ReadonlySet<number>,
  /** All ships, for the gaps: the advice knows the ships other cases keep for themselves, too. */
  all: readonly Ship[] = catalog.ships,
): Ship | undefined {
  const sorted = ccuTargetsOf(catalog.ships).sort((a, b) => a.msrp - b.msrp);
  const everyShip = ccuTargetsOf(all).sort((a, b) => a.msrp - b.msrp);
  const sold = (ship: Ship) => !buyable || buyable.has(ship.id);
  const scored = sorted.flatMap((ship) => {
    const below = everyShip.filter((other) => other.msrp < ship.msrp && sold(other));
    const above = everyShip.find((other) => other.msrp > ship.msrp);
    if (!sold(ship) || !below.length || !above) return [];
    const gapBelow = ship.msrp - below[below.length - 1]!.msrp;
    return [{ ship, score: gapBelow - (above.msrp - ship.msrp) }];
  });
  const best = scored.sort((a, b) => b.score - a.score).slice(0, 3);
  return random.pick('pivot', best)?.ship;
}

function standaloneShip(
  random: DemoRandom,
  catalog: DemoCatalog,
  index: number,
  pivot?: Ship,
): DemoPledge {
  // The first ship is the pivot (#255).
  const isPivot = index === 0 && !!pivot;
  const ship = (isPivot && pivot) || random.pick(`ship:${index}`, catalog.ships)!;
  const label = `ship:${index}`;
  const value = paidValue(random, label, ship.msrp);
  return basePledge(
    `Standalone Ships - ${ship.name}`,
    value,
    [shipItem(ship), insuranceItem('120 Month Insurance')],
    'ships',
    ship.msrp,
    {
      category: 'standalone_ship',
      isUpgradeable: true,
      ...(isPivot && { demoPivot: 'ship' as const }),
    },
  );
}

function gamePackage(random: DemoRandom, catalog: DemoCatalog, index: number): DemoPledge {
  const cheap = [...catalog.ships].sort((a, b) => a.msrp - b.msrp).slice(0, 6);
  const ship = random.pick(`package:${index}`, cheap)!;
  const price = roundPrice(ship.msrp + 20);
  return basePledge(
    `Package - ${ship.name} Starter Pack`,
    paidValue(random, `package:${index}`, price),
    [shipItem(ship), ...GAME_ITEMS, insuranceItem('6 Month Insurance')],
    'packages',
    price,
    { category: 'game_package', isUpgradeable: true },
  );
}

function ccu(random: DemoRandom, catalog: DemoCatalog, index: number, pivot?: Ship): DemoPledge {
  const sorted = ccuTargetsOf(catalog.ships).sort((a, b) => a.msrp - b.msrp);
  let from: Ship;
  let to: Ship;
  const isPivot = !!pivot && index < 2;
  if (pivot && isPivot) {
    // The first CCU goes to the pivot, the second from it (#255).
    const cheaper = sorted.filter((ship) => ship.msrp < pivot.msrp);
    const pricier = sorted.filter((ship) => ship.msrp > pivot.msrp);
    // The CCU from it goes to the next pricier ship: it melts for little (see `demoPivotShip`).
    from = index === 0 ? random.pick(`ccu:${index}:from`, cheaper)! : pivot;
    to = index === 0 ? pivot : pricier[0]!;
  } else {
    const fromIndex = random.int(`ccu:${index}:from`, 0, sorted.length - 2);
    from = sorted[fromIndex]!;
    const targets = sorted.filter((ship) => ship.msrp > from.msrp);
    to = random.pick(`ccu:${index}:to`, targets) ?? sorted[sorted.length - 1]!;
  }
  const price = Math.max(5, to.msrp - from.msrp);
  const warbond = random.chance(`ccu:${index}:warbond`, 0.35);
  // A warbond CCU costs less by the warbond discount of its target, never less than $5.
  const value = warbond
    ? Math.max(5, price - warbondDiscount(random, `ccu:${index}:discount`, to.msrp))
    : price;
  return ccuPledge(from, to, value, warbond, {
    ...(isPivot && { demoPivot: index === 0 ? ('ccuTo' as const) : ('ccuFrom' as const) }),
  });
}

/** A CCU from `from` to `to` that cost `value`, as RSI lists it. */
export function ccuPledge(
  from: Ship,
  to: Ship,
  value: number,
  warbond: boolean,
  extra: Partial<DemoPledge> = {},
): DemoPledge {
  const title = `Upgrade - ${from.name} to ${to.name} ${warbond ? 'Warbond' : 'Standard'} Edition`;
  const price = Math.max(5, to.msrp - from.msrp);
  return basePledge(title, value, [{ title }], 'ccus', price, {
    ...extra,
    upgrade: {
      matchItems: [{ id: from.id, name: from.name }],
      targetItems: [{ id: to.id, name: to.name }],
      type: 'R',
      ...(to.image && { targetImage: to.image }),
    },
  });
}

function storePledge(
  random: DemoRandom,
  catalog: DemoCatalog,
  category: string,
  kind: string,
  demoKind: DemoPledgeKind,
  index: number,
): DemoPledge | undefined {
  const entry = random.pick(`${demoKind}:${index}`, itemsOf(catalog, category));
  if (!entry) return undefined;
  return storeItemPledge(random, entry, kind, demoKind, `${demoKind}:${index}`);
}

function storeItemPledge(
  random: DemoRandom,
  entry: StoreItem,
  kind: string,
  demoKind: DemoPledgeKind,
  label: string,
): DemoPledge {
  // A paint's item has the name without RSI's category ("Sabre - Blue Steel Paint").
  return basePledge(
    storeTitle(entry.category, entry.name),
    paidValue(random, label, entry.price),
    [{ title: entry.name, kind, ...(entry.image && { image: entry.image }) }],
    demoKind,
    entry.price,
  );
}

/** A pack of two ships the store doesn't sell (any more): compared with the sum of both. */
function pack(random: DemoRandom, catalog: DemoCatalog, index: number): DemoPledge {
  const ships = random.shuffle(`pack:${index}`, catalog.ships, (ship) => ship.id).slice(0, 2);
  const price = ships.reduce((sum, ship) => sum + ship.msrp, 0);
  return basePledge(
    `Package - ${ships.map((ship) => ship.name).join(' & ')} Pack`,
    roundPrice(price * 0.9),
    [...ships.map(shipItem), insuranceItem('Lifetime Insurance')],
    'packs',
    price,
    { isUpgradeable: true },
  );
}

/** Rewards: a value of $0, recognized by their names (`rewards.ts`). */
const REWARDS = [
  'Referral Bonus - Mustang Alpha Paint',
  'IAE 2955 - Hangar Poster',
  'Luminalia Gift - Holiday Decoration',
  'Chairman’s Club Edition - Arden Backpack',
  'CitizenCon 2955 - Commemorative Coin',
  'Subscribers Exclusive - Flair Item',
];

function reward(random: DemoRandom, index: number): DemoPledge {
  const title = random.pick(`reward:${index}`, REWARDS)!;
  return basePledge(title, 0, [{ title: title.replace(/^.+? - /, '') }], 'rewards', 0, {
    isGiftable: false,
    isExchangeable: false,
  });
}

/**
 * The generated hangar: the pledges of `composition` in a random but fixed order (RSI's list is
 * newest first), with made-up ids counting down from `DEMO.idBase`.
 */
export function generateHangar(
  catalog: DemoCatalog,
  key: string,
  composition: DemoComposition = DEMO.composition,
  /** The ships RSI sells CCUs to, if known (#255, `demoPivotShip`). */
  buyable?: ReadonlySet<number>,
  /** Melt and Rebuy's cases (#532), with or without the rebuyable ones and the upgraded one. */
  rebuy: { rebuyable: boolean; upgraded: boolean } = { rebuyable: true, upgraded: true },
): DemoPledge[] {
  const random = createRandom(`${key}:hangar`);
  const pledges: DemoPledge[] = [];
  const times = (count: number, make: (index: number) => DemoPledge | undefined) => {
    for (let index = 0; index < count; index++) {
      const pledge = make(index);
      if (pledge) pledges.push(pledge);
    }
  };
  // The Price Increase Advisor's chain (#255): only with a ship and two CCUs.
  // The base ship of the CCUs that show "Base ship missing" in the Grouped View (#450): no other
  // pledge has it.
  const missingBase = composition.ccus > 0 ? demoMissingBase(random, catalog) : undefined;
  // The base ships of the CCU Consultant's cases (#425): no other pledge has them either.
  const ccuBases =
    composition.ccus > 0
      ? demoCcuBases(random, catalog, new Set(missingBase ? [missingBase.id] : []), buyable)
      : {};
  const reserved = new Set([...(missingBase ? [missingBase.id] : []), ...reservedShips(ccuBases)]);
  const pool = { ...catalog, ships: catalog.ships.filter((ship) => !reserved.has(ship.id)) };
  const pivot =
    composition.ships > 0 && composition.ccus > 1
      ? demoPivotShip(random, pool, buyable, catalog.ships)
      : undefined;
  times(composition.ships, (index) => standaloneShip(random, pool, index, pivot));
  times(composition.packages, (index) => gamePackage(random, pool, index));
  times(composition.ccus, (index) => ccu(random, pool, index, pivot));
  times(composition.paints, (index) =>
    storePledge(random, catalog, 'Paints', 'Skin', 'paints', index),
  );
  times(composition.gear, (index) =>
    storePledge(random, catalog, 'Gear', 'FPS Equipment', 'gear', index),
  );
  times(composition.addOns, (index) =>
    storePledge(random, catalog, 'Add-Ons', 'Component', 'addOns', index),
  );
  times(composition.packs, (index) => pack(random, pool, index));
  times(composition.rewards, (index) => reward(random, index));
  const shuffled = random.shuffle('order', pledges, (pledge) => pledges.indexOf(pledge).toString());
  // A paint comes first: the newest pledge, bought a few hours ago with store credit (#176). One
  // the store sells now, so it can't be rebought only as it was bought too recently (#532).
  const onSale = (pledge: DemoPledge) =>
    catalog.items.some(
      (item) =>
        item.name === pledge.items[0]?.title &&
        item.available &&
        !item.isWarbond &&
        item.discountedPrice === undefined,
    );
  const paint =
    shuffled.find((pledge) => pledge.demoKind === 'paints' && onSale(pledge)) ??
    shuffled.find((pledge) => pledge.demoKind === 'paints');
  const ordered = paint ? [paint, ...shuffled.filter((pledge) => pledge !== paint)] : shuffled;
  // The CCU Consultant's cases (#425) among the oldest pledges, after the groups.
  const grouped = withDemoGroups(ordered, pool, random, missingBase);
  const withCcuCases = [...grouped, ...hangarCases(ccuBases, pool, random)];
  // Melt and Rebuy's cases (#532): the one to refund after the groups' three, the rest the oldest.
  // Not with the ships of the Price Increase Advisor's chain nor those of the demo's watchlists.
  const pivotShips = new Set(
    pledges
      .filter((pledge) => pledge.demoPivot)
      .flatMap((pledge) => [
        ...pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title),
        ...(pledge.upgrade?.matchItems ?? []).map((item) => item.name),
        ...(pledge.upgrade?.targetItems ?? []).map((item) => item.name),
      ]),
  );
  const watched = demoWatchlistShips(catalog.ships, (id) => !buyable || buyable.has(id));
  const rebuyCases = demoRebuyCases(random, {
    catalog: { ...pool, ships: pool.ships.filter((ship) => !pivotShips.has(ship.name)) },
    items: catalog.items,
    hangar: withCcuCases,
    ...(buyable && { buyable }),
    avoid: new Set(Object.values(watched).map((ship) => ship.id)),
    ...rebuy,
    kinds: {
      ships: composition.ships > 0,
      paints: composition.paints > 0,
      ccus: composition.ccus > 0,
      packages: composition.packages > 0,
    },
  });
  const refundAt = Math.min(REBUY_REFUND_POSITION, withCcuCases.length);
  const all = [
    ...withCcuCases.slice(0, refundAt),
    ...(rebuyCases.refund ? [rebuyCases.refund] : []),
    ...withCcuCases.slice(refundAt),
    ...rebuyCases.rest,
  ];
  return withSurcharge(all, catalog).map((pledge, position) => ({
    ...pledge,
    id: DEMO.idBase - position,
  }));
}

/**
 * Where Melt and Rebuy's case to refund goes (#532): after the newest pledge and the three pledges
 * to refund of the Grouped View's groups (#450), so it is the fourth one to refund.
 */
const REBUY_REFUND_POSITION = 4;

/** How much more than the price difference the CCU with a surcharge cost. */
const SURCHARGE = 10;

/**
 * One CCU paid more than the price difference of its ships today, e.g. bought before the base ship
 * became cheaper: a surcharge among the own CCUs of a warbond offer (#395). The demo's warbond
 * offers are for the first ships the hangar's CCUs go to (`demoStoreData`), so it is a standard CCU
 * to one of them, not one of the Price Increase Advisor's.
 */
function withSurcharge(pledges: DemoPledge[], catalog: DemoCatalog): DemoPledge[] {
  const priceOf = (name: string | undefined) =>
    catalog.ships.find((ship) => ship.name === name)?.msrp;
  const targets = [
    ...new Set(pledges.flatMap((pledge) => pledge.upgrade?.targetItems[0]?.name ?? [])),
  ]
    .filter((name) => isWarbondTargetPrice(priceOf(name) ?? 0))
    .slice(0, 3);
  const ccu = pledges.find(
    (pledge) =>
      pledge.upgrade &&
      !pledge.demoPivot &&
      !pledge.demoGroup &&
      !pledge.demoCcuCase &&
      !pledge.demoRebuyCase &&
      /standard edition$/i.test(pledge.title) &&
      targets.includes(pledge.upgrade.targetItems[0]!.name),
  );
  if (!ccu) return pledges;
  const value = ccu.standardPrice + SURCHARGE;
  return pledges.map((pledge) =>
    pledge === ccu ? { ...pledge, value: usdText(value), valueUsd: value } : pledge,
  );
}
