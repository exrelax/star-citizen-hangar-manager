import type { PriceLookup } from '@/hangar/ship-prices';
import type { Ship } from '@/ships/ships';
import type { ItemPriceLookup } from '@/store/items/item-prices';
import { buybackShipNames, hasSeveralItems, type BuybackPledge } from './buyback';

/*
 * What buying back a pledge costs (#185), in USD without taxes like the other values of the
 * extension. RSI's buy back list shows no price, so it comes from:
 * - `rsi`: the pledge's detail page, read with its items (pledges with several items),
 * - `ships`: for a CCU, the difference of its ships' standard prices – what RSI's upgrade dialog
 *   of the buy back list charges –, for a standalone ship (not upgraded) or a single ship its
 *   standard price,
 * - `store`: the standard price of the item of the same name in the Pledge Store (paints, gear,
 *   ships with their insurance, packs, …), as RSI's buy back costs the current standard price,
 *   not a warbond or sale price.
 * Checked against RSI in November 2026. A pledge none of them knows shows no price.
 */

export type BuybackPriceSource = 'rsi' | 'ships' | 'store';

export interface BuybackPrice {
  amount: number;
  source: BuybackPriceSource;
}

export interface BuybackPriceCatalog {
  /** The ships of the upgrade tool, by their id (CCUs name their ships by id). */
  ships?: readonly Ship[];
  /** The standard price of a ship by its name. */
  shipPriceOf?: PriceLookup;
  /** The standard price of a Pledge Store item by a pledge title. */
  itemPriceOf?: ItemPriceLookup;
}

/** A function giving the buy back price of a pledge, if known. */
export function createBuybackPricer({ ships = [], shipPriceOf, itemPriceOf }: BuybackPriceCatalog) {
  const msrpById = new Map(ships.map((ship) => [ship.id, ship.msrp]));
  return (pledge: BuybackPledge): BuybackPrice | undefined => {
    if (typeof pledge.price === 'number') return { amount: pledge.price, source: 'rsi' };
    if (pledge.isUpgrade) {
      const from = pledge.upgrade && msrpById.get(pledge.upgrade.fromShipId);
      const to = pledge.upgrade && msrpById.get(pledge.upgrade.toShipId);
      return from !== undefined && to !== undefined && to > from
        ? { amount: round(to - from), source: 'ships' }
        : undefined;
    }
    // A game package costs more than the ship of the same name the store sells ("Package - Cutlass
    // Black": $115, the standalone Cutlass Black $110): only its buy back page knows.
    if (isGamePackage(pledge)) return undefined;
    // The store sells packages under the pledge's title, e.g. "Starlite - 10 Year" (with its
    // insurance), so the title matches also with several items.
    const item = itemPriceOf?.(pledge.title);
    if (item) return { amount: item.price, source: 'store' };
    // A standalone ship costs its ship's standard price, also with its insurance and extras
    // ("Pitbull - 10 Year", "Pulse - ILW"); an upgraded one its original price, unknown here. Of
    // other pledges only one that is just the ship.
    if (/\bupgraded\b/i.test(pledge.title)) return undefined;
    if (hasSeveralItems(pledge) && !isStandaloneShip(pledge)) return undefined;
    const [ship] = buybackShipNames(pledge);
    const shipPrice = ship ? shipPriceOf?.(ship) : undefined;
    return shipPrice ? { amount: shipPrice.price, source: 'ships' } : undefined;
  };
}

export type BuybackPricer = ReturnType<typeof createBuybackPricer>;

const isGamePackage = (pledge: BuybackPledge) =>
  pledge.category === 'game_package' || /^packages?\b/i.test(pledge.title);

const isStandaloneShip = (pledge: BuybackPledge) =>
  pledge.category === 'standalone_ship' || /^standalone ships?\b/i.test(pledge.title);

const round = (amount: number) => Math.round(amount * 100) / 100;
