import { translate, type Locale } from '@/i18n';
import { countdown, formatExpectedTime } from '@/price-increases/price-increase-label';

/*
 * The expected end of a current warbond offer (#569), from the website's warbond history
 * (`expectedEnd`, #568): a countdown as the ship removals' (#288), and a tooltip with the date and
 * time that says it is expected, not confirmed. None without an expected end, nor once it passed
 * while the offer is still on sale.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface WarbondEndLabel {
  text: string;
  hint: string;
  /** Its last day: marked as the price increases' last day is. */
  soon: boolean;
}

export function warbondEndLabel(
  expectedEnd: number | undefined,
  shipName: string,
  now: number,
  locale: Locale,
): WarbondEndLabel | undefined {
  if (expectedEnd === undefined || now >= expectedEnd) return undefined;
  const time = { at: expectedEnd };
  return {
    text: translate(locale, 'store.warbondEnd', [countdown(time, now, locale)]),
    hint: `${translate(locale, 'store.warbondEndHint', [
      shipName,
      formatExpectedTime(time, locale),
    ])}\n${translate(locale, 'store.warbondEndExpected')}`,
    soon: expectedEnd - now < DAY,
  };
}
