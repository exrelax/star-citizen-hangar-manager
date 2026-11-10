import { translate, type Locale } from '@/i18n';
import { isKindOn } from '@/notifications/kinds';
import {
  updateNotifications,
  withAdded,
  type AppNotification,
} from '@/notifications/notifications';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { eventState, localized, shownEvents, type StarCitizenEvent } from './events';

/*
 * A sidebar notification once per event when its display period starts (#69), as the kind
 * "Events" that can be turned off (#197). No browser notification: the Pledge Store tab shows the
 * events anyway, and browser notifications are used sparingly (#155).
 */

/** Date and time of an event in the user's language, e.g. "13 Nov 2026, 17:00". */
export function formatEventTime(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
}

/** The notification of a shown event: when it starts, or until when it runs. */
export function eventNote(event: StarCitizenEvent, locale: Locale, now: number): AppNotification {
  const upcoming = eventState(event, now) === 'upcoming';
  return {
    id: `events:${event.id}`,
    kind: 'events',
    text: upcoming
      ? translate(locale, 'notifications.eventUpcoming', [
          localized(event.name, locale),
          formatEventTime(event.eventStart, locale),
        ])
      : translate(locale, 'notifications.eventRunning', [
          localized(event.name, locale),
          formatEventTime(event.eventEnd, locale),
        ]),
    at: now,
  };
}

/** Adds the notifications of the events shown now, each once, while the kind is on. */
export async function noteShownEvents(
  events: readonly StarCitizenEvent[],
  now: number,
): Promise<void> {
  const shown = shownEvents(events, now);
  if (!shown.length) return;
  const settings = withDefaults(await settingsItem.getValue());
  if (!isKindOn(settings.notificationsOff, 'events')) return;
  const locale = resolveLanguage(settings.language);
  const notes = shown.map((event) => eventNote(event, locale, now));
  await updateNotifications((list) => withAdded(list, notes));
}
