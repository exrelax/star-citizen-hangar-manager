import type { CcuPriceChange } from './ccu-price-change';
import type { PriceIncreaseMatch } from './price-increase-match';
import { isWithinDays } from './price-increases';

/*
 * The filters of an upcoming price change (#256): "Price change ahead" in My Hangar and "Price
 * increase expected" in the buy back. Both match a pledge whose own price rises (a ship, a related
 * item, a CCU to the ship: `priceIncrease`) or a CCU whose base or target ship rises
 * (`ccuPriceChange`, #250) – within the period of the Buy Back Reminder (#192), so past dates no
 * longer match.
 */

/** What a list entry knows about upcoming price increases. */
export interface PriceChangeSubject {
  priceIncrease?: PriceIncreaseMatch;
  ccuPriceChange?: CcuPriceChange;
}

/** Whether a price increase that changes the entry's value lies within the next `days` days. */
export const hasPriceChangeWithin = (
  { priceIncrease, ccuPriceChange }: PriceChangeSubject,
  now: number,
  days: number,
): boolean =>
  [priceIncrease?.increase, ccuPriceChange?.base, ccuPriceChange?.target].some((increase) =>
    isWithinDays(increase, now, days),
  );

/** Whether the entry expects a price change at all, whenever it is. */
export const hasPriceChange = ({ priceIncrease, ccuPriceChange }: PriceChangeSubject): boolean =>
  priceIncrease !== undefined || ccuPriceChange !== undefined;
