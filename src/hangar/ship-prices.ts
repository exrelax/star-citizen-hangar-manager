import { current, type ShipsSnapshot } from '@/ships/ships-storage';
import type { ItemPriceLookup } from '@/store/items/item-prices';
import type { Pledge } from './pledge';

/*
 * Original prices of the ships, as listed by RSI's ship upgrade tool ("All ships"), to show how
 * much a ship or CCU in the hangar was discounted. The upgrade tool uses other ship ids than the
 * hangar, so ships are matched by name.
 */

/** A ship of RSI's upgrade tool with its standard price in USD. */
export interface ShipPrice {
  name: string;
  price: number;
}

/** Discount of a pledge compared to the original price of its ship (or CCU). */
export interface PledgeDiscount {
  /** Original price in USD: the ship's price, or the price difference of the CCU's ships. */
  original: number;
  /** What the pledge is worth (its value in USD). */
  paid: number;
  /** `original - paid`; negative if the pledge cost more. */
  amount: number;
  /** `amount` in percent of `original`. */
  percent: number;
  /**
   * What the original price comes from: the ship, "from" and "to" of a CCU, or the item of the
   * Pledge Store.
   */
  ships: ShipPrice[];
}

/** The standard prices of the stored ships of the upgrade tool (see `src/ships`). */
export function shipPricesOf(snapshot: ShipsSnapshot | null | undefined): ShipPrice[] {
  return (current(snapshot ?? null)?.ships ?? []).map(({ name, msrp }) => ({ name, price: msrp }));
}

const words = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** Items listed next to ships that are no ship themselves (CCU extras, modules). */
const NOT_A_SHIP = /\b(paint|livery|poster|coin|reservation|insurance|module|kit)\b/i;

/** Hangar names of ships that the upgrade tool lists under a different name. */
const ALIASES: Record<string, string> = {
  '600i exploration module': '600i Explorer',
  '600i touring module': '600i Touring',
};

/**
 * Finds the price of a ship by its hangar name. Names mostly match; otherwise:
 * - Names without a mark mean the Mk I: RSI renamed ships to "… Mk I" when a Mk II came out
 *   ("F7C-S Hornet Ghost" is the "F7C-S Hornet Ghost Mk I").
 * - One name is usually a shorter form of the other: "Mercury" for "Mercury Star Runner", "C2
 *   Hercules" for "Hercules Starlifter C2", or the other way round "F7C-M Hornet Heartseeker Mk I"
 *   for "F7C-M Super Hornet Heartseeker Mk I". Of the ships whose words all appear in the name (or
 *   the other way round), the one with the most shared and the fewest extra words is taken; on a
 *   tie the one without extra words ("Ballista" for "Anvil Ballista", not "Anvil Ballista
 *   Snowblind"). If ships are still equal, the price stays unknown.
 */
export function createPriceLookup(ships: readonly ShipPrice[]) {
  const entries = ships.map((ship) => ({ ship, words: words(ship.name) }));
  const exact = new Map(entries.map((entry) => [entry.words.join(' '), entry.ship]));

  return (name: string): ShipPrice | undefined => {
    const alias = ALIASES[words(name).join(' ')];
    if (alias) name = alias;
    else if (NOT_A_SHIP.test(name)) return undefined;
    const nameWords = words(name);
    const match =
      exact.get(nameWords.join(' ')) ??
      (nameWords.includes('mk') ? undefined : exact.get([...nameWords, 'mk', 'i'].join(' ')));
    if (match) return match;

    const present = new Set(nameWords);
    let best: ShipPrice | undefined;
    let bestScore = 0;
    let bestExtra = 0;
    let tie = false;
    for (const entry of entries) {
      const shared = entry.words.filter((word) => present.has(word)).length;
      const extra = entry.words.length - shared;
      if (extra > 0 && shared < present.size) continue; // Neither name contains the other.
      // Shared words count, extra words of the upgrade tool's name (a variant?) count against.
      const score = shared - extra;
      if (score > bestScore || (score === bestScore && extra < bestExtra)) {
        [best, bestScore, bestExtra, tie] = [entry.ship, score, extra, false];
      } else if (score === bestScore && extra === bestExtra) {
        tie = true;
      }
    }
    return tie ? undefined : best;
  };
}

export type PriceLookup = ReturnType<typeof createPriceLookup>;

/**
 * Discount of a CCU (compared to the price difference of its ships) or of a pledge with exactly
 * one ship (compared to the ship's price). Packages with the game are left out there: their value
 * also pays for the game, so a comparison with the ship's price would be misleading. Every other
 * pledge – paints, gear, add-ons, packs, game packages, … – is compared with the item of the same
 * name in the Pledge Store, if `itemPriceOf` knows it (see `store/items/item-prices.ts`); a bundle
 * of several ships the store doesn't sell with the sum of its ships' prices.
 */
export function pledgeDiscount(
  pledge: Pledge,
  priceOf: PriceLookup | undefined,
  hasGameAccess: boolean,
  itemPriceOf?: ItemPriceLookup,
): PledgeDiscount | undefined {
  const shipDiscount = priceOf && shipBasedDiscount(pledge, priceOf, hasGameAccess);
  if (shipDiscount || pledge.upgrade) return shipDiscount;
  const item = itemPriceOf?.(pledge.title);
  if (item) return discountOf(pledge, item.price, [item]);
  return priceOf && bundleDiscount(pledge, priceOf, hasGameAccess);
}

/**
 * A bundle of several ships the store doesn't sell (anymore): compared with the sum of its ships'
 * prices. Only without the game, and only if every ship's price is known.
 */
function bundleDiscount(
  pledge: Pledge,
  priceOf: PriceLookup,
  hasGameAccess: boolean,
): PledgeDiscount | undefined {
  const shipItems = pledge.items.filter((item) => item.kind === 'Ship');
  if (shipItems.length < 2 || hasGameAccess) return undefined;
  const ships = shipItems.map((item) => priceOf(item.title));
  if (ships.some((ship) => !ship)) return undefined;
  const known = ships as ShipPrice[];
  const original = Math.round(known.reduce((sum, ship) => sum + ship.price, 0) * 100) / 100;
  return discountOf(pledge, original, [
    { name: known.map((ship) => ship.name).join(' + '), price: original },
  ]);
}

function shipBasedDiscount(
  pledge: Pledge,
  priceOf: PriceLookup,
  hasGameAccess: boolean,
): PledgeDiscount | undefined {
  let ships: ShipPrice[];
  let original: number;
  if (pledge.upgrade) {
    const from = pledge.upgrade.matchItems[0] && priceOf(pledge.upgrade.matchItems[0].name);
    const to = pledge.upgrade.targetItems[0] && priceOf(pledge.upgrade.targetItems[0].name);
    if (!from || !to) return undefined;
    ships = [from, to];
    original = to.price - from.price;
  } else {
    const shipItems = pledge.items.filter((item) => item.kind === 'Ship');
    if (shipItems.length !== 1 || hasGameAccess) return undefined;
    const ship = priceOf(shipItems[0]!.title);
    if (!ship) return undefined;
    ships = [ship];
    original = ship.price;
  }
  return discountOf(pledge, original, ships);
}

function discountOf(
  pledge: Pledge,
  original: number,
  ships: ShipPrice[],
): PledgeDiscount | undefined {
  // Free pledges (rewards, referral bonuses): "100 % off" says nothing and would swell the sums.
  if (!(original > 0) || !(pledge.valueUsd > 0)) return undefined;
  const amount = Math.round((original - pledge.valueUsd) * 100) / 100;
  return { original, paid: pledge.valueUsd, amount, percent: (amount / original) * 100, ships };
}
