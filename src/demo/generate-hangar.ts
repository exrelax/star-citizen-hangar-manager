import { DEMO } from '@/config';
import type { Pledge, PledgeItem } from '@/hangar/pledge';
import type { Ship } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import type { DemoCatalog } from './catalog';
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
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
/** RSI's way of writing a value: "$1,234.50 USD". */
export const usdText = (value: number) => `${USD.format(value)} USD`;

/** Rounded to RSI's typical prices: whole dollars, or halves for small ones. */
const roundPrice = (value: number) =>
  value < 20 ? Math.round(value * 2) / 2 : Math.max(5, Math.round(value / 5) * 5);

/** A pledge with RSI's defaults, as the parser leaves them for a plain store-credit pledge. */
function basePledge(
  title: string,
  value: number,
  items: PledgeItem[],
  demoKind: DemoPledgeKind,
  standardPrice: number,
  extra: Partial<Pledge> = {},
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

const shipItem = (ship: Ship): PledgeItem => ({
  title: ship.name,
  kind: 'Ship',
  ...(ship.image && { image: ship.image }),
});
const insuranceItem = (title: string): PledgeItem => ({ title, kind: 'Insurance' });
const GAME_ITEMS: PledgeItem[] = [
  { title: 'Star Citizen Digital Download', kind: 'Digital Download' },
];

/** The items of a store category, cheapest ones first left out of nothing. */
const itemsOf = (catalog: DemoCatalog, category: string) =>
  catalog.items.filter((entry) => entry.category === category && entry.price > 0);

/** A store item's pledge title: RSI's category in front of the name. */
const storeTitle = (category: string, name: string) =>
  name.toLowerCase().startsWith(category.toLowerCase()) ? name : `${category} - ${name}`;

/** The value paid: the standard price, sometimes less (sale, warbond) or more (an older price). */
function paidValue(random: DemoRandom, label: string, price: number): number {
  const roll = random.at(`${label}:value`);
  if (roll < 0.45) return price;
  if (roll < 0.9) return roundPrice(price * (0.6 + random.at(`${label}:discount`) * 0.3));
  return roundPrice(price * 1.1);
}

function standaloneShip(random: DemoRandom, catalog: DemoCatalog, index: number): DemoPledge {
  const ship = random.pick(`ship:${index}`, catalog.ships)!;
  const label = `ship:${index}`;
  const value = paidValue(random, label, ship.msrp);
  return basePledge(
    `Standalone Ships - ${ship.name}`,
    value,
    [shipItem(ship), insuranceItem('120 Month Insurance')],
    'ships',
    ship.msrp,
    { category: 'standalone_ship', isUpgradeable: true },
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

function ccu(random: DemoRandom, catalog: DemoCatalog, index: number): DemoPledge {
  const sorted = [...catalog.ships].sort((a, b) => a.msrp - b.msrp);
  const fromIndex = random.int(`ccu:${index}:from`, 0, sorted.length - 2);
  const from = sorted[fromIndex]!;
  const targets = sorted.filter((ship) => ship.msrp > from.msrp);
  const to = random.pick(`ccu:${index}:to`, targets) ?? sorted[sorted.length - 1]!;
  const price = Math.max(5, to.msrp - from.msrp);
  const warbond = random.chance(`ccu:${index}:warbond`, 0.35);
  const value = warbond ? roundPrice(price * 0.75) : price;
  const title = `Upgrade - ${from.name} to ${to.name} ${warbond ? 'Warbond' : 'Standard'} Edition`;
  return basePledge(title, value, [{ title }], 'ccus', price, {
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
): DemoPledge[] {
  const random = createRandom(`${key}:hangar`);
  const pledges: DemoPledge[] = [];
  const times = (count: number, make: (index: number) => DemoPledge | undefined) => {
    for (let index = 0; index < count; index++) {
      const pledge = make(index);
      if (pledge) pledges.push(pledge);
    }
  };
  times(composition.ships, (index) => standaloneShip(random, catalog, index));
  times(composition.packages, (index) => gamePackage(random, catalog, index));
  times(composition.ccus, (index) => ccu(random, catalog, index));
  times(composition.paints, (index) =>
    storePledge(random, catalog, 'Paints', 'Skin', 'paints', index),
  );
  times(composition.gear, (index) =>
    storePledge(random, catalog, 'Gear', 'FPS Equipment', 'gear', index),
  );
  times(composition.addOns, (index) =>
    storePledge(random, catalog, 'Add-Ons', 'Component', 'addOns', index),
  );
  times(composition.packs, (index) => pack(random, catalog, index));
  times(composition.rewards, (index) => reward(random, index));
  const ordered = random.shuffle('order', pledges, (pledge) => pledges.indexOf(pledge).toString());
  return ordered.map((pledge, position) => ({ ...pledge, id: DEMO.idBase - position }));
}
