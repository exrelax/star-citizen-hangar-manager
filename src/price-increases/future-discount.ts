import type { PledgeView } from '@/hangar/pledge-view';
import type { ExpectedPriceIncrease } from './price-increases';

/*
 * The discount of a pledge after an expected price increase (#274), next to today's in My Hangar:
 * only where the change in USD is known.
 * - A ship whose price rises (with the new price, #249): its original price grows by the increase.
 * - A CCU whose base or target ship rises (#250): its upgrade value after the increase.
 * The pledge's value stays what was paid, so the discount grows or shrinks by the change – a CCU
 * from a rising ship may even cost more than its upgrade value then.
 */

export interface FutureDiscount {
  /** The original price after the increase: the ship's new price or the CCU's upgrade value. */
  original: number;
  /** `original - paid`; negative if the pledge then costs more than the original price. */
  amount: number;
  /** `amount` in percent of `original`; none for an original price of $0 or less. */
  percent?: number;
  /** The increase it follows: the next one where both ships of a CCU rise. */
  increase: ExpectedPriceIncrease;
}

const cents = (value: number) => Math.round(value * 100) / 100;

export function futureDiscount(
  pledge: Pick<PledgeView, 'valueUsd' | 'discount' | 'priceIncrease' | 'ccuPriceChange'>,
): FutureDiscount | undefined {
  const paid = pledge.valueUsd;
  if (!(paid > 0)) return undefined;
  const of = (original: number, increase: ExpectedPriceIncrease): FutureDiscount => {
    const amount = cents(original - paid);
    return {
      original,
      amount,
      ...(original > 0 && { percent: (amount / original) * 100 }),
      increase,
    };
  };

  const change = pledge.ccuPriceChange;
  if (change?.amounts && change.amounts.change !== 0) {
    const increases = [change.base, change.target].filter(
      (increase): increase is ExpectedPriceIncrease => !!increase,
    );
    const next = increases.sort((a, b) => a.priceIncreaseAt.at - b.priceIncreaseAt.at)[0]!;
    return of(change.amounts.after, next);
  }

  const match = pledge.priceIncrease;
  const price = match?.increase.price;
  const discount = pledge.discount;
  // A pledge of one ship, compared with that ship's price.
  if (match?.reason !== 'ship' || !price || discount?.ships.length !== 1) return undefined;
  return of(cents(discount.original + price.to - price.from), match.increase);
}
