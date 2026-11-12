import { formatUsd } from '@/hangar/discount-format';
import { translate, translatePlural, type Locale } from '@/i18n';
import { localized } from '@/site-data/site-data';
import type { CcuPriceChange } from './ccu-price-change';
import type { PriceIncreaseMatch } from './price-increase-match';
import { endOf, type ExpectedPriceIncrease, type ExpectedTime } from './price-increases';

/*
 * The label of an item whose price is expected to rise (#191): a countdown to the price increase
 * and a tooltip with its dates and note. In the buy back it is a warning – buy it back or use it
 * as a discount token before –, in My Hangar an information – melting it before means buying it
 * back at the higher price. Every text says the dates are expected.
 *
 * The countdown: with a probable time the days left, on the last day the hours and minutes
 * ("3 h 20 min", "3 h" on the full hour) and in the last hour minutes and seconds ("46:12"); with
 * only the day the day itself, "today" on it.
 *
 * With the Price Increase Advisor (#251) the label also tells the change where it is known (#249,
 * #250): a ship's price ("Price +$20"), a CCU's upgrade value ("Upgrade value +$20"). A CCU whose
 * base ship rises loses upgrade value: a warning in both places ("Upgrade value −$20").
 */

/** Where the label is shown. */
export type PriceIncreasePlace = 'buyback' | 'hangar';

export interface PriceIncreaseLabel {
  text: string;
  hint: string;
  /** A warning (act before) or an information. */
  tone: 'warning' | 'info';
  /** The time it counts down to. */
  at: ExpectedTime;
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

/**
 * What a text about several price increases says about their confirmation (#275): nothing while
 * all are confirmed by CIG, that they are expected while none is, else both.
 */
export function confirmationNote(
  increases: readonly Pick<ExpectedPriceIncrease, 'confirmed'>[],
): 'priceIncrease.expected' | 'priceIncrease.partlyConfirmed' | undefined {
  const confirmed = increases.filter((increase) => increase.confirmed).length;
  if (confirmed === increases.length) return undefined;
  return confirmed ? 'priceIncrease.partlyConfirmed' : 'priceIncrease.expected';
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
    return translatePlural(locale, 'priceIncrease.days', days);
  }
  const hours = Math.floor(left / HOUR);
  const minutes = Math.floor((left - hours * HOUR) / MINUTE);
  if (hours) {
    return minutes
      ? translate(locale, 'priceIncrease.hours', [hours, minutes])
      : translate(locale, 'priceIncrease.fullHours', [hours]);
  }
  // The last hour: a running countdown, e.g. "46:12".
  const seconds = Math.floor((left % MINUTE) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Less than this left: the countdown shows seconds, so it is updated every second. */
export const SECONDS_COUNTDOWN_MS = HOUR;

/** The increase a CCU's label counts down to: the one that decides the direction. */
function ccuIncrease(ccu: CcuPriceChange): ExpectedPriceIncrease | undefined {
  if (ccu.direction === 'loses') return ccu.base ?? ccu.target;
  if (ccu.direction === 'gains') return ccu.target ?? ccu.base;
  const both = [ccu.base, ccu.target].filter((increase) => !!increase);
  return both.sort((a, b) => a.priceIncreaseAt.at - b.priceIncreaseAt.at)[0];
}

/**
 * The label of an item with an expected price increase – its `match` (#190) and, for a CCU, the
 * change of its upgrade value (`ccu`, #250); none once it is over.
 */
export function priceIncreaseLabel(
  match: PriceIncreaseMatch | undefined,
  place: PriceIncreasePlace,
  now: number,
  locale: Locale,
  ccu?: CcuPriceChange,
): PriceIncreaseLabel | undefined {
  const increase = (ccu && ccuIncrease(ccu)) ?? match?.increase;
  if (!increase) return undefined;
  const { priceIncreaseAt, flightReadyAt, note, ship, price } = increase;
  if (endOf(priceIncreaseAt) <= now) return undefined;
  const usd = (value: number) => formatUsd(value, locale);
  const when = formatExpectedTime(priceIncreaseAt, locale);
  const left = countdown(priceIncreaseAt, now, locale);
  const loses = ccu?.direction === 'loses';
  const amounts = ccu?.amounts;
  // Confirmed by CIG (#275): every increase it tells about.
  const told = ccu?.direction === 'mixed' ? [ccu.base!, ccu.target!] : [increase];
  const confirmed = told.every((rising) => rising.confirmed);

  const lines: string[] = [];
  if (loses) {
    lines.push(
      translate(
        locale,
        confirmed ? 'priceIncrease.hintCcuLosesConfirmed' : 'priceIncrease.hintCcuLoses',
        [ship.name, when],
      ),
    );
  } else {
    for (const rising of told) {
      lines.push(
        translate(locale, rising.confirmed ? 'priceIncrease.hintConfirmed' : 'priceIncrease.hint', [
          rising.ship.name,
          formatExpectedTime(rising.priceIncreaseAt, locale),
        ]),
      );
    }
    lines.push(
      translate(
        locale,
        place === 'buyback' ? 'priceIncrease.hintBuyback' : 'priceIncrease.hintHangar',
      ),
    );
  }
  if (price) {
    lines.push(
      translate(
        locale,
        increase.confirmed ? 'priceIncrease.hintPriceConfirmed' : 'priceIncrease.hintPrice',
        [ship.name, usd(price.from), usd(price.to)],
      ),
    );
  }
  if (amounts) {
    lines.push(
      translate(locale, 'priceIncrease.hintUpgradeValue', [
        usd(amounts.before),
        usd(amounts.after),
      ]),
    );
    if (amounts.discountBefore !== undefined && amounts.discountAfter !== undefined) {
      lines.push(
        translate(locale, 'priceIncrease.hintDiscount', [
          usd(amounts.discountBefore),
          usd(amounts.discountAfter),
        ]),
      );
    }
    // RSI doesn't sell such CCUs (#207): one already owned still works, one in the buy back can't
    // be bought back any more.
    if (amounts.after <= 0) {
      lines.push(
        translate(
          locale,
          place === 'buyback'
            ? 'priceIncrease.hintNoLongerAvailable'
            : 'priceIncrease.hintStillApplicable',
        ),
      );
    }
  }
  // Already flight ready (none given, or over): only the price increase.
  if (flightReadyAt && endOf(flightReadyAt) > now) {
    lines.push(
      translate(locale, 'priceIncrease.flightReady', [formatExpectedTime(flightReadyAt, locale)]),
    );
  }
  if (note) lines.push(localized(note, locale));
  lines.push(translate(locale, confirmed ? 'priceIncrease.confirmed' : 'priceIncrease.expected'));

  let text: string;
  if (loses) {
    text = amounts
      ? translate(locale, 'priceIncrease.labelUpgradeLoss', [usd(-amounts.change), left])
      : translate(locale, 'priceIncrease.labelUpgradeDrops', [left]);
  } else if (ccu?.direction === 'gains' && amounts) {
    text = translate(locale, 'priceIncrease.labelUpgradeGain', [usd(amounts.change), left]);
  } else if (!ccu && match?.reason === 'ship' && price) {
    text = translate(locale, 'priceIncrease.labelPrice', [usd(price.to - price.from), left]);
  } else {
    text = translate(locale, 'priceIncrease.label', [left]);
  }

  return {
    text,
    hint: lines.join(' '),
    tone: loses || place === 'buyback' ? 'warning' : 'info',
    at: priceIncreaseAt,
    soon: priceIncreaseAt.dayOnly ? now >= priceIncreaseAt.at : priceIncreaseAt.at - now < DAY,
  };
}
