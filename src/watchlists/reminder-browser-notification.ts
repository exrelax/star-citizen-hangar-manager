import {
  onAlarm,
  onManagerSeen,
  onNotificationClick,
  onNotificationClosed,
  openHangarManager,
} from '@/background/dispatch';
import { translate, type Locale } from '@/i18n';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { isKindOn } from '@/notifications/kinds';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { dueReminders, nextReminderAt, reminderKey, type Watchlist } from './watchlists';
import { loadWatchlists, watchWatchlists } from './watchlists-storage';

/*
 * The browser notification of a watchlist's reminder (#469), shown by the background script also
 * while no RSI page is open: an alarm goes off at the next date of a watchlist with a reminder, and
 * each watchlist due then gets a notification of its own, told once per date. A click opens the
 * watchlist in the Hangar Manager.
 *
 * It goes away once the Hangar Manager is seen – its sidebar shows the same reminder (#155) –, once
 * the reminder is dismissed there, turned off, moved to another date or its watchlist deleted, and
 * when closed. Without the browser's permission, with the kind `watchlistReminders` turned off
 * (#197) or in the demo mode nothing is shown, but the reminders count as told, so turning it on
 * later doesn't bring old ones. The demo's watchlists never remind in the browser.
 */

export const WATCHLIST_REMINDERS_ALARM = 'shm-watchlist-reminders';
/** One notification per watchlist: this prefix and its `reminderKey`. */
const NOTIFICATION_PREFIX = 'shm-watchlist-reminder:';

/** The reminders already told (`reminderKey`). */
const notifiedItem = storage.defineItem<readonly string[]>(
  'local:notifications.watchlistRemindersNotified',
  { fallback: [] },
);

/** The reminders whose browser notification shows now (`reminderKey`). */
const shownItem = storage.defineItem<readonly string[]>(
  'local:notifications.watchlistRemindersShown',
  { fallback: [] },
);

/** What to do at `now`: the reminders to tell now, those still due, and when to look again. */
export function reminderSchedule(
  lists: readonly Watchlist[],
  notified: readonly string[],
  now: number,
): { due: Watchlist[]; open: Set<string>; next?: number } {
  const told = new Set(notified);
  const all = dueReminders(lists, now);
  const next = nextReminderAt(lists, now);
  return {
    due: all.filter((list) => !told.has(reminderKey(list))),
    open: new Set(all.map(reminderKey)),
    ...(next !== undefined && { next }),
  };
}

/** Tells the reminders due now and sets the alarm for the next one. */
export async function checkWatchlistReminders(now = Date.now()): Promise<void> {
  const [lists, notified, allowed, settings, before] = await Promise.all([
    loadWatchlists(false),
    notifiedItem.getValue(),
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
    shownItem.getValue(),
  ]);
  const { demoMode, language, notificationsOff } = withDefaults(settings);
  const shown = allowed && !demoMode && isKindOn(notificationsOff, 'watchlistReminders');
  const { due, open, next } = reminderSchedule(lists, notified, now);

  // Those no longer due (dismissed, changed, deleted), or all with the browser's ones off: they go.
  const gone = before.filter((key) => !shown || !open.has(key));
  await Promise.all(gone.map((key) => browser.notifications?.clear(NOTIFICATION_PREFIX + key)));
  let showing = before.filter((key) => !gone.includes(key));
  if (shown) {
    const locale = resolveLanguage(language);
    for (const list of due) await announce(list, locale);
    showing = [...new Set([...showing, ...due.map(reminderKey)])];
  }
  if (JSON.stringify(showing) !== JSON.stringify(before)) await shownItem.setValue(showing);

  // Only reminders still due are kept, so the stored list doesn't grow.
  const kept = [...new Set([...notified, ...due.map(reminderKey)])].filter((key) => open.has(key));
  if (JSON.stringify(kept) !== JSON.stringify(notified)) await notifiedItem.setValue(kept);

  if (next === undefined || !shown) await browser.alarms.clear(WATCHLIST_REMINDERS_ALARM);
  else await browser.alarms.create(WATCHLIST_REMINDERS_ALARM, { when: next });
}

/** The text of a watchlist's reminder: its name and date, and its description. */
export function reminderMessage(list: Watchlist, locale: Locale): string {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    list.dueAt,
  );
  const text = translate(locale, 'notifications.browserWatchlistReminder', [list.name, date]);
  return list.description ? `${text}\n${list.description}` : text;
}

async function announce(list: Watchlist, locale: Locale): Promise<void> {
  await browser.notifications.create(NOTIFICATION_PREFIX + reminderKey(list), {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: translate(locale, 'notifications.browserWatchlistReminderTitle'),
    message: reminderMessage(list, locale),
  });
}

/** Takes the notifications away, e.g. once the Hangar Manager was seen. */
async function clearShown(): Promise<void> {
  const keys = await shownItem.getValue();
  if (!keys.length) return;
  await shownItem.setValue([]);
  await Promise.all(keys.map((key) => browser.notifications?.clear(NOTIFICATION_PREFIX + key)));
}

/** The watchlist of a notification: its id, the part of `reminderKey` before the date. */
const listIdOf = (notificationId: string) =>
  notificationId.slice(NOTIFICATION_PREFIX.length).split('@')[0] ?? '';

/** Wires the alarm, the click and the data it follows (call it in the background script). */
export function watchWatchlistReminders(): void {
  const check = () => void checkWatchlistReminders();
  check();
  watchWatchlists(check, false);
  browserNotificationsItem.watch(check);
  settingsItem.watch(check);
  onAlarm(WATCHLIST_REMINDERS_ALARM, check);
  onManagerSeen(() => void clearShown());
  onNotificationClosed(NOTIFICATION_PREFIX, (id) => {
    const key = id.slice(NOTIFICATION_PREFIX.length);
    void shownItem.getValue().then((keys) => shownItem.setValue(keys.filter((k) => k !== key)));
  });
  onNotificationClick(
    NOTIFICATION_PREFIX,
    (id) => void openHangarManager(`showWatchlist:${listIdOf(id)}`),
  );
}
