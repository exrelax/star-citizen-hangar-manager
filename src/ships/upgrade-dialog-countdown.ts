import { localized, type StarCitizenEvent } from '@/events/events';
import { translate, type Locale } from '@/i18n';
import { countdown, formatExpectedTime } from '@/price-increases/price-increase-label';
import { runningEvent } from '@/store/warbond-history-view';
import type { WarbondSighting } from '@/store/warbond-history';
import type { UpgradeTarget } from './upgrade-dialog-labels';

/*
 * How long a target ship of RSI's ship upgrade dialog is expected to stay in the Pledge Store
 * (#570): while an event runs (`events.json`), each target ship that isn't always available (#401)
 * counts down to the event's end, as many of them are only sold during the event. A ship whose
 * current warbond offer has an expected end (`expectedEnd` of the website's warbond history, #568)
 * counts down to that instead, before or after the event's end: the dialog then offers the warbond
 * edition, e.g. a one-day offer of an event's finale. Once it passed, the event's end counts
 * again. Nothing without a running event, on always available ships and on ships the facts don't
 * know.
 */

export interface TargetEnd {
  at: number;
  /** What the end is: the running event's end, or its current warbond offer's expected end. */
  source: 'event' | 'warbond';
  /** The running event. */
  event: StarCitizenEvent;
}

export interface TargetEndSources {
  events: readonly StarCitizenEvent[];
  /** The website's warbond offers, with their expected ends. */
  offers: readonly WarbondSighting[];
  /** Whether a ship is always available; `undefined` if the facts don't know it. */
  availability: (target: UpgradeTarget) => boolean | undefined;
}

/** When a target ship is expected to leave the store; none if it isn't expected to. */
export function createTargetEnd({ events, offers, availability }: TargetEndSources) {
  // The warbond offers with an expected end, by ship.
  const warbondOffers = new Map<number, { firstSeen: number; expectedEnd: number }[]>();
  for (const { shipId, firstSeen, expectedEnd } of offers) {
    if (expectedEnd === undefined) continue;
    warbondOffers.set(shipId, [...(warbondOffers.get(shipId) ?? []), { firstSeen, expectedEnd }]);
  }
  /** The latest expected end of the ship's warbond offers running at `now`. */
  const warbondEnd = (shipId: number, now: number) =>
    (warbondOffers.get(shipId) ?? [])
      .filter((offer) => offer.firstSeen <= now && now < offer.expectedEnd)
      .reduce<number | undefined>((end, offer) => Math.max(end ?? 0, offer.expectedEnd), undefined);
  return (target: UpgradeTarget, now: number): TargetEnd | undefined => {
    const event = runningEvent(events, now);
    if (!event || availability(target) !== false) return undefined;
    const warbond = target.id === undefined ? undefined : warbondEnd(target.id, now);
    return warbond !== undefined
      ? { at: warbond, source: 'warbond', event }
      : { at: event.eventEnd, source: 'event', event };
  };
}

/** The countdown's line and tooltip in the dialog. */
export function targetEndText(
  end: TargetEnd,
  now: number,
  locale: Locale,
): { text: string; hint: string } {
  const time = { at: end.at };
  const date = formatExpectedTime(time, locale);
  const why =
    end.source === 'event'
      ? translate(locale, 'upgradeDialog.countdownEvent', [date, localized(end.event.name, locale)])
      : translate(locale, 'upgradeDialog.countdownWarbond', [date]);
  return {
    text: translate(locale, 'upgradeDialog.countdown', [countdown(time, now, locale)]),
    hint: `${why}\n${translate(locale, 'upgradeDialog.countdownExpected')}`,
  };
}
