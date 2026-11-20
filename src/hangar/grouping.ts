import type { BuybackView } from '@/buyback/buyback-view';
import { parseInsurance, type Insurance } from './insurance';
import type { PledgeItem } from './pledge';
import { GAME_DOWNLOAD, isPaintItem, type PledgeView } from './pledge-view';
import { ccuShips } from './upgrade-log';

/*
 * The grouping of the Grouped View (#445, #446): items of "My Hangar" or "Buy Back" that are the
 * same form one group, with their count and sums, instead of one row each.
 *
 * - The key says what an item is: a CCU by its base and target ship; a ship or package by the
 *   ships it holds and – for a package – its name; anything else (gear, paints, flair, subscriber
 *   items, …) by what it holds – the same helmet of two years' events is the same item –, by its
 *   name only without items. Buy back items by the same rules, from what its page tells.
 * - Extras don't change the key: added gear, the insurance, a Best in Show or other added paint,
 *   having been upgraded. A pledge with applied upgrades groups by the ship it is now. The group
 *   tells which extras differ among its items.
 * - A group knows its items, their count, the sums of their value (in the buy back: of the buy back
 *   price) and discount – of the known ones, with how many aren't known – and whether all, some or
 *   none of them are giftable and meltable.
 */

/** An extra that doesn't keep items apart; the group tells which of them differ. */
export type GroupExtra = 'gear' | 'paint' | 'bisPaint' | 'insurance' | 'upgraded';
export const GROUP_EXTRAS: readonly GroupExtra[] = [
  'gear',
  'paint',
  'bisPaint',
  'insurance',
  'upgraded',
];

/** What the grouping needs to know about an item. */
export interface GroupFacts {
  key: string;
  /** Its extras; `insurance` as its label, e.g. "LTI", "120m", "none". */
  extras: Partial<Record<GroupExtra, string | true>>;
  /** Its value in USD, if known (the buy back price in the buy back). */
  value?: number;
  /** Its discount in USD, if known. */
  discount?: number;
  giftable: boolean;
  /** Unset where it doesn't apply (the buy back). */
  meltable?: boolean;
}

/** Whether all, some or none of a group's items have a property. */
export type GroupShare = 'all' | 'some' | 'none';

/** A sum of the known values, and how many items it leaves out. */
export interface GroupSum {
  total: number;
  /** Items whose value isn't known: the total doesn't cover them. */
  unknown: number;
}

export interface ItemGroup<T> {
  key: string;
  items: T[];
  count: number;
  value: GroupSum;
  discount: GroupSum;
  giftable: GroupShare;
  /** Unset where it doesn't apply (the buy back). */
  meltable?: GroupShare;
  /** The extras that differ among its items, in the order of `GROUP_EXTRAS`. */
  extras: GroupExtra[];
}

const name = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const shareOf = (count: number, total: number): GroupShare =>
  count === total ? 'all' : count ? 'some' : 'none';

const cents = (usd: number) => Math.round(usd * 100);

/** The groups of `items`, in the order of each group's first item. */
export function groupItems<T>(
  items: readonly T[],
  factsOf: (item: T) => GroupFacts,
): ItemGroup<T>[] {
  const groups = new Map<string, { items: T[]; facts: GroupFacts[] }>();
  for (const item of items) {
    const facts = factsOf(item);
    let group = groups.get(facts.key);
    if (!group) groups.set(facts.key, (group = { items: [], facts: [] }));
    group.items.push(item);
    group.facts.push(facts);
  }
  return [...groups].map(([key, { items: members, facts }]) => {
    const sum = (pick: (fact: GroupFacts) => number | undefined): GroupSum => {
      const known = facts.map(pick).filter((value): value is number => value !== undefined);
      return {
        total: known.reduce((total, value) => total + cents(value), 0) / 100,
        unknown: facts.length - known.length,
      };
    };
    const meltable = facts.every((fact) => fact.meltable !== undefined)
      ? shareOf(facts.filter((fact) => fact.meltable).length, facts.length)
      : undefined;
    return {
      key,
      items: members,
      count: members.length,
      value: sum((fact) => fact.value),
      discount: sum((fact) => fact.discount),
      giftable: shareOf(facts.filter((fact) => fact.giftable).length, facts.length),
      ...(meltable && { meltable }),
      extras: GROUP_EXTRAS.filter(
        (extra) => new Set(facts.map((fact) => fact.extras[extra] ?? '')).size > 1,
      ),
    };
  });
}

/** Whether a group stands for a single item: shown as that item. */
export const isSingle = (group: ItemGroup<unknown>): boolean => group.count === 1;

// ---- The facts of hangar and buy back items ----

const insuranceText = (insurance: Insurance | undefined) =>
  !insurance ? 'none' : insurance.lifetime ? 'LTI' : `${insurance.months}m`;

const BIS = /\bbest in show\b/i;

/** The extras among a pledge's items besides its ships, insurances and game downloads. */
function extrasOfItems(titles: readonly { title: string; paint: boolean }[]): GroupFacts['extras'] {
  const extras: GroupFacts['extras'] = {};
  for (const { title, paint } of titles) {
    if (paint) extras[BIS.test(title) ? 'bisPaint' : 'paint'] = true;
    else extras.gear = true;
  }
  return extras;
}

/** A pledge's name without RSI's category in front and its insurance or edition at the end. */
function pledgeName(title: string): string {
  return name(
    title
      .replace(
        /^(standalone ships?|packages?|paints?|gear|add ons?|flair|subscribers? (store|exclusive))\s*-\s*/i,
        '',
      )
      .replace(/\s*-\s*(lti|\d+\s*(year|month)s?|warbond|standard)\b.*$/i, ''),
  );
}

/** A CCU's key: its base and target ship. */
const ccuKey = (from: string, to: string) => `ccu:${name(from)}>${name(to)}`;

/**
 * The name part of a ship pledge's key: none for a standalone ship – also one named just after its
 * only ship, without RSI's category – and for a pledge upgraded to its ship; else its name.
 */
function packageNameOf(title: string, ships: readonly string[], standalone: boolean): string {
  const own = pledgeName(title);
  return standalone || (ships.length === 1 && own === name(ships[0]!)) ? '' : own;
}

/** The ships part of a key, independent of their order. */
const shipsKey = (ships: readonly string[]) => [...ships].map(name).sort().join('+');

/** The facts of a pledge of "My Hangar". */
export function pledgeFacts(pledge: PledgeView): GroupFacts {
  const base = {
    value: pledge.valueUsd,
    ...(pledge.discount && { discount: pledge.discount.amount }),
    giftable: pledge.isGiftable,
    meltable: pledge.isMeltable,
  };
  if (pledge.isCcu && pledge.upgrade) {
    const names = ccuShips(pledge.title);
    const from = pledge.upgrade.matchItems[0]?.name ?? names?.from ?? pledge.title;
    const to = pledge.upgrade.targetItems[0]?.name ?? names?.to ?? pledge.title;
    // The insurance a CCU brings with it is an extra.
    const insurance = pledge.upgrade.targetItems
      .map((item) => parseInsurance(item.name))
      .find(Boolean);
    return { key: ccuKey(from, to), extras: { insurance: insuranceText(insurance) }, ...base };
  }
  const ships = pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title);
  if (ships.length) {
    const others = pledge.items.filter(
      (item) =>
        item.kind !== 'Ship' &&
        item.kind !== 'Insurance' &&
        !parseInsurance(item.title) &&
        !GAME_DOWNLOAD.test(item.title),
    );
    const extras: GroupFacts['extras'] = {
      ...extrasOfItems(
        others.map((item: PledgeItem) => ({ title: item.title, paint: isPaintItem(item) })),
      ),
      insurance: insuranceText(pledge.insurance),
      ...(pledge.isUpgraded && { upgraded: true as const }),
    };
    // A standalone ship and a pledge upgraded to that ship are that ship; a package also its name.
    const packageName = packageNameOf(
      pledge.originalName ?? pledge.title,
      ships,
      pledge.isStandaloneShip || pledge.isUpgraded,
    );
    return { key: `ships:${shipsKey(ships)}|${packageName}`, extras, ...base };
  }
  // By what it holds: the same helmet of several years' events ("2952 Day of the Vara - …",
  // "Day of the Vara 2956 - …") is the same item. By its name only without items.
  const contents = pledge.items.map((item) => `${name(item.kind ?? '')}:${name(item.title)}`);
  return {
    key: contents.length
      ? `item:${contents.sort().join('+')}`
      : `item:${pledge.isPaint ? 'paint' : 'item'}:${pledgeName(pledge.title)}`,
    extras: {},
    ...base,
  };
}

/** The facts of a pledge of "Buy Back": the same rules, from what its page tells. */
export function buybackFacts(pledge: BuybackView): GroupFacts {
  const base = {
    ...(pledge.price && { value: pledge.price.amount }),
    giftable: pledge.isProbablyGiftable,
  };
  if (pledge.isCcu) {
    const names = ccuShips(pledge.title);
    // By the ships' names as in the hangar; their ids only where the title doesn't tell them.
    const from = names?.from ?? (pledge.upgrade ? `#${pledge.upgrade.fromShipId}` : pledge.title);
    const to = names?.to ?? (pledge.upgrade ? `#${pledge.upgrade.toShipId}` : pledge.title);
    return { key: ccuKey(from, to), extras: {}, ...base };
  }
  const ships = pledge.ships.map((ship) => ship.name);
  if (ships.length) {
    const shipNames = new Set(ships.map(name));
    const others = pledge.items.filter(
      (item) => !shipNames.has(name(item)) && !parseInsurance(item) && !GAME_DOWNLOAD.test(item),
    );
    const extras: GroupFacts['extras'] = {
      ...extrasOfItems(
        others.map((item) => ({ title: item, paint: /\b(paint|livery)\b/i.test(item) })),
      ),
      insurance: insuranceText(pledge.insurance),
    };
    const packageName = packageNameOf(pledge.title, ships, pledge.isStandaloneShip);
    return { key: `ships:${shipsKey(ships)}|${packageName}`, extras, ...base };
  }
  // By what it holds, as in the hangar: its items, else the one item "Contained" names.
  const contents = pledge.items.length ? pledge.items : [pledge.contained];
  return { key: `item:${contents.map(name).sort().join('+')}`, extras: {}, ...base };
}
