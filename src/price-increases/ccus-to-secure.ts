import type { Ship, ShipSku, WarbondSku } from '@/ships/ships';
import { cheapestBases, type BaseShip, type Holdings } from '@/store/warbond';
import { upcomingPriceIncreases, type ExpectedPriceIncrease } from './price-increases';

/*
 * The CCUs to secure before a price increase (#253, part of the Price Increase Advisor #248), for
 * the Pledge Store tab – for every user, whether or not the hangar has CCUs to the ship. For each
 * ship whose price is expected to rise and to which RSI sells CCUs right now: the cheapest CCUs to
 * it from the ships below its price (the upgrade tool's data, like the warbond CCUs). A CCU bought
 * now gains what the ship rises by: its upgrade value grows, its price doesn't. Ships about to rise
 * themselves are left out as base ships. Gone once the price increase is past.
 */

export interface SecureOffer {
  increase: ExpectedPriceIncrease;
  /** The rising ship in the upgrade tool. */
  ship: Ship;
  /** The SKU RSI sells CCUs to it with (not the warbond edition), for RSI's upgrade dialog. */
  skuId: number;
  /** Its standard price today. */
  price: number;
  /** What each CCU gains in discount: what the ship rises by, if known. */
  gain?: number;
  /** The ships with the cheapest CCUs to it, cheapest CCU first. */
  bases: BaseShip[];
}

export interface SecureInput {
  increases: readonly ExpectedPriceIncrease[];
  ships: readonly Ship[];
  buyable: readonly ShipSku[];
  warbonds: readonly WarbondSku[];
  /** How often each ship (by id) is in the hangar and the buy back. */
  holdings?: ReadonlyMap<number, Holdings>;
  now: number;
}

/** The CCUs to secure, the next price increase first; one entry per ship (its next increase). */
export function ccusToSecure(input: SecureInput): SecureOffer[] {
  const upcoming = upcomingPriceIncreases(input.increases, input.now);
  const rising = new Set(upcoming.map((increase) => increase.ship.id));
  const bases = input.ships.filter((ship) => !rising.has(ship.id));
  const byId = new Map(input.ships.map((ship) => [ship.id, ship]));
  const warbondSkus = new Set(input.warbonds.map((warbond) => warbond.skuId));
  const seen = new Set<number>();
  return upcoming.flatMap((increase): SecureOffer[] => {
    const ship = byId.get(increase.ship.id);
    if (!ship || seen.has(ship.id)) return [];
    seen.add(ship.id);
    // RSI sells standard CCUs to it right now.
    const sku = input.buyable.find(
      (entry) => entry.shipId === ship.id && !warbondSkus.has(entry.skuId),
    );
    if (!sku) return [];
    const price = ship.msrp;
    const gain =
      increase.price && Math.round((increase.price.to - increase.price.from) * 100) / 100;
    return [
      {
        increase,
        ship,
        skuId: sku.skuId,
        price,
        ...(gain && gain > 0 && { gain }),
        bases: cheapestBases(bases, { ship, skuId: sku.skuId, price }, input.holdings),
      },
    ];
  });
}
