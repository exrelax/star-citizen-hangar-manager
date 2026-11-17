import {
  onAlarm,
  onManagerSeen,
  onNotificationClick,
  onNotificationClosed,
  openHangarManager,
} from '@/background/dispatch';
import { SHIP_REMOVALS } from '@/config';
import { translate, translatePlural, type Locale } from '@/i18n';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { isKindOn } from '@/notifications/kinds';
import { formatExpectedTime } from '@/price-increases/price-increase-label';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { removalNoteKey } from './removal-notes';
import { removalsByDate, type RemovalDate, type ShipRemoval } from './ship-removals';
import { shipRemovalsItem, storedShipRemovals } from './ship-removals-storage';

/*
 * The browser notification about ships leaving the Pledge Store (#291, part of Ship Removals
 * #285): a week before the date (`SHIP_REMOVALS.browserNoticeMs`), one per date for all its ships,
 * shown by the background script also while no RSI page is open. An alarm goes off when the next
 * date crosses that limit. Each date is told once for its ships; a new ship on it or a moved date
 * tells it again. A click opens the Pledge Store tab at the section (#288).
 *
 * It goes away once its date has passed, once the Hangar Manager is seen – its sidebar tells the
 * same (#290) – or when closed (#155). Without the browser's permission, with the kind
 * `shipRemovals` turned off (#197) or in the demo mode nothing is shown, but the dates count as
 * told, so turning it on later doesn't bring old ones.
 */

export const SHIP_REMOVALS_ALARM = 'shm-ship-removals';
/** One notification per date: this prefix and the date's key. */
const NOTIFICATION_PREFIX = 'shm-ship-removals:';

/** The dates already told, by `removalNoteKey`. */
const notifiedItem = storage.defineItem<readonly string[]>(
  'local:notifications.shipRemovalsNotified',
  { fallback: [] },
);

/** The dates whose browser notification shows now, by `removalNoteKey`. */
const shownItem = storage.defineItem<readonly string[]>('local:notifications.shipRemovalsShown', {
  fallback: [],
});

const keyOf = (date: RemovalDate) => removalNoteKey(date.removedAt, date.removals);
/** When a date crosses the limit: a week before it. */
const noticeAt = (date: RemovalDate) => date.removedAt.at - SHIP_REMOVALS.browserNoticeMs;

/** What to do at `now`: the dates to tell now, and when to look again. */
export function shipRemovalSchedule(
  removals: readonly ShipRemoval[],
  notified: readonly string[],
  now: number,
): { due: RemovalDate[]; next?: number } {
  const told = new Set(notified);
  const open = removalsByDate(removals, now).filter((date) => !told.has(keyOf(date)));
  const due = open.filter((date) => noticeAt(date) <= now);
  const later = open.filter((date) => noticeAt(date) > now);
  return { due, ...(later.length && { next: Math.min(...later.map(noticeAt)) }) };
}

/** Tells the dates that crossed the limit and sets the alarm for the next one. */
export async function checkShipRemovals(now = Date.now()): Promise<void> {
  const [stored, notified, allowed, settings, before] = await Promise.all([
    shipRemovalsItem.getValue(),
    notifiedItem.getValue(),
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
    shownItem.getValue(),
  ]);
  const removals = storedShipRemovals(stored);
  const { demoMode, language, notificationsOff } = withDefaults(settings);
  const shown = allowed && !demoMode && isKindOn(notificationsOff, 'shipRemovals');
  const { due, next } = shipRemovalSchedule(removals, notified, now);
  const ahead = new Map(removalsByDate(removals, now).map((date) => [keyOf(date), date]));

  // The notifications shown whose date is past, or all with the browser's ones off: they go.
  const gone = before.filter((key) => !shown || !ahead.has(key));
  await Promise.all(gone.map((key) => browser.notifications?.clear(NOTIFICATION_PREFIX + key)));
  let showing = before.filter((key) => !gone.includes(key));
  if (shown) {
    const locale = resolveLanguage(language);
    for (const date of due) await announce(date, locale);
    showing = [...new Set([...showing, ...due.map(keyOf)])];
  }
  if (JSON.stringify(showing) !== JSON.stringify(before)) await shownItem.setValue(showing);

  // Only dates still ahead are kept, so the stored list doesn't grow.
  const kept = [...new Set([...notified, ...due.map(keyOf)])].filter((key) => ahead.has(key));
  if (JSON.stringify(kept) !== JSON.stringify(notified)) await notifiedItem.setValue(kept);

  if (next === undefined || !shown) await browser.alarms.clear(SHIP_REMOVALS_ALARM);
  else await browser.alarms.create(SHIP_REMOVALS_ALARM, { when: next });
}

/** The text of a date's notification: its ships and the date. */
export function shipRemovalMessage(date: RemovalDate, locale: Locale): string {
  const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    date.removals.map((removal) => removal.ship.name),
  );
  return translatePlural(locale, 'notifications.browserShipRemovals', date.removals.length, [
    names,
    formatExpectedTime(date.removedAt, locale),
  ]);
}

/** One notification for the date. */
async function announce(date: RemovalDate, locale: Locale): Promise<void> {
  await browser.notifications.create(NOTIFICATION_PREFIX + keyOf(date), {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: translate(locale, 'notifications.browserShipRemovalsTitle'),
    message: shipRemovalMessage(date, locale),
  });
}

/** Takes the notifications away, e.g. once the Hangar Manager was seen. */
async function clearShown(): Promise<void> {
  const keys = await shownItem.getValue();
  await shownItem.setValue([]);
  await Promise.all(keys.map((key) => browser.notifications?.clear(NOTIFICATION_PREFIX + key)));
}

/** Wires the alarm, the click and the data it follows (call it in the background script). */
export function watchShipRemovals(): void {
  const check = () => void checkShipRemovals();
  check();
  shipRemovalsItem.watch(check);
  browserNotificationsItem.watch(check);
  settingsItem.watch(check);
  onAlarm(SHIP_REMOVALS_ALARM, check);
  onManagerSeen(() => void clearShown());
  onNotificationClosed(NOTIFICATION_PREFIX, (id) => {
    const key = id.slice(NOTIFICATION_PREFIX.length);
    void shownItem.getValue().then((keys) => shownItem.setValue(keys.filter((k) => k !== key)));
  });
  onNotificationClick(NOTIFICATION_PREFIX, () => void openHangarManager('showShipRemovals'));
}
