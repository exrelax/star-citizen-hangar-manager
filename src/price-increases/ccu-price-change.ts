import type { PriceLookup } from '@/hangar/ship-prices';
import type { ExpectedPriceIncrease } from './price-increases';

/*
 * What an expected price increase means for a CCU (#250, part of the Price Increase Advisor
 * #248). Its upgrade value is the price difference of its ships (target minus base):
 * - The **base** ship rises (e.g. Prospector → Vulture): the CCU **loses** upgrade value.
 * - The **target** ship rises (e.g. Cutlass Black → Prospector): the CCU **gains** upgrade value.
 * With the new price known (`price` of the increase, #249) and both ships' prices, the upgrade
 * value before and after and the change are known, and with the CCU's melt value the effect on
 * its discount. An upgrade value of $0 or below after the increase is kept as it is: a CCU already
 * owned stays applicable, although RSI doesn't sell such CCUs. Without a new price only the
 * direction is known.
 */

/** Which way the upgrade value goes; `mixed` while both ships rise and the amounts are unknown. */
export type CcuPriceDirection = 'loses' | 'gains' | 'mixed';

export interface CcuPriceAmounts {
  /** The upgrade value now: target's price minus base's price, in USD. */
  before: number;
  /** The upgrade value after the increase; $0 or below if the base ship isn't cheaper anymore. */
  after: number;
  /** `after - before`: negative when the CCU loses value. */
  change: number;
  /** The CCU's discount now (upgrade value minus melt value), with a known melt value. */
  discountBefore?: number;
  /** The discount after the increase; negative when the CCU is worth less than it cost. */
  discountAfter?: number;
}

export interface CcuPriceChange {
  /** The increase of the base ship, if it rises. */
  base?: ExpectedPriceIncrease;
  /** The increase of the target ship, if it rises. */
  target?: ExpectedPriceIncrease;
  direction: CcuPriceDirection;
  /** Only with the new price of every rising ship and the prices of both ships. */
  amounts?: CcuPriceAmounts;
}

/** A ship of a CCU: its name and the increase found for it, if any. */
export interface CcuShip {
  name: string;
  increase?: ExpectedPriceIncrease;
  /**
   * The target is an item that rises with a ship (e.g. a module, `relatedItems`): it rises, but
   * the increase's price is the ship's, not its own.
   */
  related?: boolean;
}

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * The price of a CCU's ship before and after: the standard price (`priceOf`, the upgrade tool) or
 * else the increase's old price; after the increase its new price. Unknown for a related item and
 * for a rising ship without a new price.
 */
function shipPrices(ship: CcuShip, priceOf: PriceLookup | undefined) {
  const { increase } = ship;
  if (increase && (ship.related || !increase.price)) return undefined;
  const now = priceOf?.(ship.name)?.price ?? increase?.price?.from;
  if (now === undefined) return undefined;
  return { now, after: increase?.price?.to ?? now };
}

/**
 * The change of a CCU from `from` to `to`, if either ship rises; `paid` is its melt value (what it
 * cost), for the effect on its discount.
 */
export function ccuPriceChange(
  from: CcuShip,
  to: CcuShip,
  paid: number | undefined,
  priceOf: PriceLookup | undefined,
): CcuPriceChange | undefined {
  const base = from.increase;
  const target = to.increase;
  if (!base && !target) return undefined;

  const fromPrices = shipPrices(from, priceOf);
  const toPrices = shipPrices(to, priceOf);
  let amounts: CcuPriceAmounts | undefined;
  if (fromPrices && toPrices) {
    const before = cents(toPrices.now - fromPrices.now);
    const after = cents(toPrices.after - fromPrices.after);
    amounts = { before, after, change: cents(after - before) };
    if (paid !== undefined && paid > 0) {
      amounts.discountBefore = cents(before - paid);
      amounts.discountAfter = cents(after - paid);
    }
  }

  const direction: CcuPriceDirection =
    amounts && amounts.change !== 0
      ? amounts.change < 0
        ? 'loses'
        : 'gains'
      : base && target
        ? 'mixed'
        : base
          ? 'loses'
          : 'gains';
  return {
    ...(base && { base }),
    ...(target && { target }),
    direction,
    ...(amounts && { amounts }),
  };
}
