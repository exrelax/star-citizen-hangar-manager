import { SHIP_PRICES_MAX_AGE_MS } from '@/config';
import { shipPricesItem } from './hangar-storage';
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

/** Locally stored prices of the last download. */
export interface ShipPrices {
  /** ISO timestamp of the download. */
  fetchedAt: string;
  ships: ShipPrice[];
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
  /** Ships the original price comes from: the ship, or "from" and "to" of a CCU. */
  ships: ShipPrice[];
}

const UPGRADE_GRAPHQL = '/pledge-store/api/upgrade/v2/graphql';

/** Loads the ships of the upgrade tool. Works with the session of the RSI page. */
export async function fetchShipPrices(): Promise<ShipPrice[]> {
  const response = await fetch(UPGRADE_GRAPHQL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        operationName: 'filterShips',
        variables: { fromFilters: [] },
        query:
          'query filterShips($toId: Int, $fromFilters: [FilterConstraintValues]) {' +
          ' from(to: $toId, filters: $fromFilters) { ships { name msrp } } }',
      },
    ]),
  });
  if (!response.ok) throw new Error(`Loading ship prices failed: HTTP ${response.status}`);
  const [result] = (await response.json()) as [
    { data?: { from?: { ships?: { name: string; msrp: number }[] } } } | undefined,
  ];
  const ships = result?.data?.from?.ships ?? [];
  if (!ships.length) throw new Error('Loading ship prices failed: no ships in the answer');
  // RSI's prices are in cents.
  return ships.map(({ name, msrp }) => ({ name, price: msrp / 100 }));
}

/**
 * Downloads the prices again if they are older than `maxAgeMs` (or missing). A failure keeps
 * the stored prices – they are an extra and must not break a sync.
 */
export async function refreshShipPrices({
  maxAgeMs = SHIP_PRICES_MAX_AGE_MS,
  fetchPrices = fetchShipPrices,
} = {}): Promise<void> {
  const stored = await shipPricesItem.getValue();
  if (stored && Date.now() - Date.parse(stored.fetchedAt) < maxAgeMs) return;
  try {
    const ships = await fetchPrices();
    await shipPricesItem.setValue({ fetchedAt: new Date().toISOString(), ships });
  } catch (error) {
    console.warn('[sc-hangar-manager] Ship prices unavailable', error);
  }
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
 * one ship (compared to the ship's price). Packages with the game are left out: their value also
 * pays for the game, so a comparison with the ship's price would be misleading.
 */
export function pledgeDiscount(
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
  if (!(original > 0) || !Number.isFinite(pledge.valueUsd)) return undefined;

  const amount = Math.round((original - pledge.valueUsd) * 100) / 100;
  return { original, paid: pledge.valueUsd, amount, percent: (amount / original) * 100, ships };
}
