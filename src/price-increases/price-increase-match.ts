import { buybackShipNames, mainItem, type BuybackPledge } from '@/buyback/buyback';
import type { Pledge } from '@/hangar/pledge';
import { shipKey } from '@/hangar/ship-images';
import { ccuShips } from '@/hangar/upgrade-log';
import type { PriceLookup } from '@/hangar/ship-prices';
import { ccuPriceChange, type CcuPriceChange, type CcuShip } from './ccu-price-change';
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
 *
 * For the Price Increase Advisor (#250), `hangarCcu` and `buybackCcu` look at a CCU's both ships:
 * its base ship rising makes it lose upgrade value, its target ship rising gain it (see
 * `ccu-price-change.ts`). Only CCU pledges count: a pledge with applied upgrades is its current
 * ship, matched by `hangar` like any ship.
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

  /** A CCU's base ship, by its Ship Matrix id if known, else by name. */
  const ccuBase = (name: string, id?: number): CcuShip => ({
    name,
    increase: (id && byShipId.get(id)) || byShipName.get(nameKey(name)),
  });
  /** A CCU's target: the ship (by id, else name), or an item that rises with a ship. */
  const ccuTarget = (name: string, id?: number): CcuShip => {
    const increase = (id && byShipId.get(id)) || byShipName.get(nameKey(name));
    if (increase) return { name, increase };
    const relatedIncrease = byRelated.get(nameKey(name));
    return relatedIncrease ? { name, increase: relatedIncrease, related: true } : { name };
  };

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

    /**
     * What the expected price increases mean for a CCU of My Hangar (#250), by the names of its
     * ships; its value is its melt value.
     */
    hangarCcu(pledge: Pledge, priceOf?: PriceLookup): CcuPriceChange | undefined {
      if (byShipId.size === 0 || !pledge.upgrade) return undefined;
      const fromTitle = ccuShips(pledge.title);
      const from = pledge.upgrade.matchItems[0]?.name ?? fromTitle?.from;
      const to = pledge.upgrade.targetItems[0]?.name ?? fromTitle?.to;
      if (!from || !to) return undefined;
      return ccuPriceChange(ccuBase(from), ccuTarget(to), pledge.valueUsd, priceOf);
    },

    /**
     * What the expected price increases mean for a CCU of the buy back (#250), by the Ship Matrix
     * ids of its "Buy Back" button, else the names in its title; `paid` is its buy back price.
     */
    buybackCcu(
      pledge: BuybackPledge,
      priceOf?: PriceLookup,
      paid?: number,
    ): CcuPriceChange | undefined {
      if (byShipId.size === 0 || !pledge.isUpgrade) return undefined;
      const names = ccuShips(pledge.title);
      const ids = pledge.upgrade;
      if (!names && !ids) return undefined;
      const from = ccuBase(names?.from ?? '', ids?.fromShipId);
      const to = ccuTarget(names?.to ?? '', ids?.toShipId);
      return ccuPriceChange(from, to, paid, priceOf);
    },
  };
}

export type PriceIncreaseMatcher = ReturnType<typeof createPriceIncreaseMatcher>;
