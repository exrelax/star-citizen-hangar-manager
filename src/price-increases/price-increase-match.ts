import { buybackShipNames, mainItem, type BuybackPledge } from '@/buyback/buyback';
import type { Pledge } from '@/hangar/pledge';
import { shipKey } from '@/hangar/ship-images';
import { ccuShips } from '@/hangar/upgrade-log';
import { upcomingPriceIncreases, type ExpectedPriceIncrease } from './price-increases';

/*
 * Which items of My Hangar and the buy back an expected price increase affects (#190), by the
 * matching key of #187:
 * - Buy back CCUs: the target's Ship Matrix id of the "Buy Back" button (`toShipId`), else the
 *   target's name in the title.
 * - My Hangar CCUs: the names of their targets (RSI's own item ids there are of another kind).
 * - Ships and packages: their ship items by name – My Hangar's items of kind "Ship", the buy
 *   back's "Contained" and the items of its detail page.
 * - Related items (e.g. modules): by their exact names, in the items, as CCU targets and, in the
 *   buy back, in the title ("Add-Ons - Galaxy - Cargo Module - IAE").
 * Names are compared without case, punctuation, word order and the endings "Standard Edition" and
 * "Warbond Edition", but otherwise exactly: "Galaxy" doesn't match "Galaxy Refinery Module", nor
 * "Liberator" the "Valkyrie Liberator Edition". Paints aren't affected: their names hold the
 * ship's name only as a part. Only price increases still ahead count; of several, the next one.
 */

/** Why an item is affected. */
export type PriceIncreaseReason = 'ship' | 'ccu' | 'related';

export interface PriceIncreaseMatch {
  increase: ExpectedPriceIncrease;
  reason: PriceIncreaseReason;
}

const EDITION = /\s+(?:standard|warbond)(?:\s+edition)?$/i;

/** The key a name is compared by. */
export const nameKey = (name: string): string => shipKey(name.trim().replace(EDITION, ''));

/** "Add-Ons - Galaxy - Cargo Module - IAE" → "Galaxy - Cargo Module - IAE", "Galaxy - Cargo Module", "Galaxy". */
function titleNames(title: string): string[] {
  const parts = title.split(/\s+[-–]\s+/).slice(1);
  return parts.map((_, index) => parts.slice(0, parts.length - index).join(' - '));
}

/** Finds the expected price increases of items; build it once per list. */
export function createPriceIncreaseMatcher(
  increases: readonly ExpectedPriceIncrease[],
  now: number,
) {
  const byShipId = new Map<number, ExpectedPriceIncrease>();
  const byShipName = new Map<string, ExpectedPriceIncrease>();
  const byRelated = new Map<string, ExpectedPriceIncrease>();
  // The next one first: the first entry of a key wins.
  for (const increase of upcomingPriceIncreases(increases, now)) {
    const { ship, relatedItems = [] } = increase;
    if (!byShipId.has(ship.id)) byShipId.set(ship.id, increase);
    for (const name of [ship.name, ...(ship.aliases ?? [])]) {
      const key = nameKey(name);
      if (!byShipName.has(key)) byShipName.set(key, increase);
    }
    for (const { name } of relatedItems) {
      const key = nameKey(name);
      if (!byRelated.has(key)) byRelated.set(key, increase);
    }
  }

  /** The next of the price increases found, with its reason. */
  const next = (found: (PriceIncreaseMatch | undefined)[]): PriceIncreaseMatch | undefined =>
    found
      .filter((match): match is PriceIncreaseMatch => !!match)
      .sort((a, b) => a.increase.priceIncreaseAt.at - b.increase.priceIncreaseAt.at)[0];

  const ship = (name: string, reason: PriceIncreaseReason = 'ship') => {
    const increase = byShipName.get(nameKey(name));
    return increase && { increase, reason };
  };
  const related = (name: string) => {
    const increase = byRelated.get(nameKey(name));
    return increase && { increase, reason: 'related' as const };
  };
  /** A CCU's target: the ship, or a related item (e.g. a module). */
  const target = (name: string) => next([ship(name, 'ccu'), related(name)]);

  return {
    /** The expected price increase of a pledge of My Hangar, if any. */
    hangar(pledge: Pledge): PriceIncreaseMatch | undefined {
      if (byShipId.size === 0) return undefined;
      if (pledge.upgrade) {
        const targets = pledge.upgrade.targetItems.map((item) => item.name);
        const fromTitle = ccuShips(pledge.title)?.to;
        return next([...targets, ...(fromTitle ? [fromTitle] : [])].map(target));
      }
      return next(
        pledge.items.flatMap((item) =>
          item.kind === 'Ship' ? [ship(item.title), related(item.title)] : [related(item.title)],
        ),
      );
    },

    /** The expected price increase of a pledge of the buy back, if any. */
    buyback(pledge: BuybackPledge): PriceIncreaseMatch | undefined {
      if (byShipId.size === 0) return undefined;
      if (pledge.isUpgrade) {
        const byId = pledge.upgrade && byShipId.get(pledge.upgrade.toShipId);
        if (byId) return { increase: byId, reason: 'ccu' };
        const name = ccuShips(pledge.title)?.to;
        return name ? target(name) : undefined;
      }
      const ships = buybackShipNames(pledge);
      const shipNames = ships.length ? [...ships, ...(pledge.items ?? [])] : [];
      const names = [mainItem(pledge), ...(pledge.items ?? []), ...titleNames(pledge.title)];
      return next([...shipNames.map((name) => ship(name)), ...names.map(related)]);
    },
  };
}

export type PriceIncreaseMatcher = ReturnType<typeof createPriceIncreaseMatcher>;
