import type { Ship } from '@/ships/ships';
import type { BuybackPledge } from './buyback';

/*
 * Buy back pledges RSI can't sell again (#207). RSI sells a CCU only from a cheaper ship to a more
 * expensive one, at today's standard prices; a CCU whose base ship was raised to the price of its
 * target ship or above it since can't be bought back – it has no price, and "To Cart" fails. RSI's
 * buy back page renders its "Not available" block for every pledge and hides it by its styles, so
 * the prices of the ship catalog tell it. A ship missing there tells nothing.
 */

/** A ship of a CCU with its standard price today. */
export interface PricedShip {
  name: string;
  msrp: number;
}

/** Why a pledge can't be bought back: its CCU's ships at today's prices. */
export interface BuybackUnavailable {
  from: PricedShip;
  to: PricedShip;
}

/** A function telling why a buy back pledge can't be bought back, if it can't. */
export function createAvailabilityCheck(ships: readonly Ship[] = []) {
  const byId = new Map(ships.map((ship) => [ship.id, ship]));
  return (pledge: BuybackPledge): BuybackUnavailable | undefined => {
    if (!pledge.isUpgrade || !pledge.upgrade) return undefined;
    const from = byId.get(pledge.upgrade.fromShipId);
    const to = byId.get(pledge.upgrade.toShipId);
    // Without a price on both sides (e.g. a ship not sold) nothing is known.
    if (!from?.msrp || !to?.msrp || to.msrp > from.msrp) return undefined;
    return {
      from: { name: from.name, msrp: from.msrp },
      to: { name: to.name, msrp: to.msrp },
    };
  };
}

export type AvailabilityCheck = ReturnType<typeof createAvailabilityCheck>;
