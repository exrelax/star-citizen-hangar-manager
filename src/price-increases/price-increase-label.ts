import { translate, type Locale } from '@/i18n';
import { localized } from '@/site-data/site-data';
import type { PriceIncreaseMatch } from './price-increase-match';
import { endOf, type ExpectedTime } from './price-increases';

/*
 * The label of an item whose price is expected to rise (#191): a countdown to the price increase
 * and a tooltip with its dates and note. In the buy back it is a warning – buy it back or use it
 * as a discount token before –, in My Hangar an information – melting it before means buying it
 * back at the higher price. Every text says the dates are expected.
 *
 * The countdown: with a probable time the days left, on the last day the hours and minutes; with
 * only the day the day itself, "today" on it.
 */

/** Where the label is shown. */
export type PriceIncreasePlace = 'buyback' | 'hangar';

export interface PriceIncreaseLabel {
  text: string;
  hint: string;
  /** Less than a day left: shown more prominently. */
  soon: boolean;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A point in time of the file in the language: a day (UTC) or a day with time (local). */
export function formatExpectedTime(time: ExpectedTime, locale: Locale): string {
  return time.dayOnly
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(time.at)
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time.at);
}

/** The time left until `time`, as the label shows it. */
function countdown(time: ExpectedTime, now: number, locale: Locale): string {
  if (time.dayOnly) {
    return now >= time.at
      ? translate(locale, 'priceIncrease.today')
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
          time.at,
        );
  }
  const left = Math.max(0, time.at - now);
  if (left >= DAY) {
    const days = Math.floor(left / DAY);
    return translate(locale, days === 1 ? 'priceIncrease.day' : 'priceIncrease.days', [days]);
  }
  const hours = Math.floor(left / HOUR);
  // Rounded up: "1 min" until the time is reached.
  const minutes = Math.ceil((left - hours * HOUR) / MINUTE);
  if (minutes === 60) return translate(locale, 'priceIncrease.hours', [hours + 1, 0]);
  return hours
    ? translate(locale, 'priceIncrease.hours', [hours, minutes])
    : translate(locale, 'priceIncrease.minutes', [Math.max(1, minutes)]);
}

/** The label of an item with an expected price increase; none once it is over. */
export function priceIncreaseLabel(
  { increase }: PriceIncreaseMatch,
  place: PriceIncreasePlace,
  now: number,
  locale: Locale,
): PriceIncreaseLabel | undefined {
  const { priceIncreaseAt, flightReadyAt, note, ship } = increase;
  if (endOf(priceIncreaseAt) <= now) return undefined;
  const lines = [
    translate(locale, 'priceIncrease.hint', [
      ship.name,
      formatExpectedTime(priceIncreaseAt, locale),
    ]),
    translate(
      locale,
      place === 'buyback' ? 'priceIncrease.hintBuyback' : 'priceIncrease.hintHangar',
    ),
  ];
  // Already flight ready (none given, or over): only the price increase.
  if (flightReadyAt && endOf(flightReadyAt) > now) {
    lines.push(
      translate(locale, 'priceIncrease.flightReady', [formatExpectedTime(flightReadyAt, locale)]),
    );
  }
  if (note) lines.push(localized(note, locale));
  lines.push(translate(locale, 'priceIncrease.expected'));
  return {
    text: translate(locale, 'priceIncrease.label', [countdown(priceIncreaseAt, now, locale)]),
    hint: lines.join(' '),
    soon: priceIncreaseAt.dayOnly ? now >= priceIncreaseAt.at : priceIncreaseAt.at - now < DAY,
  };
}
