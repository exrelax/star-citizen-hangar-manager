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
 *
 * An open notification follows its event: each read gives it the event's current name and time
 * (a date moved in the file moves it too), and it is checked off once the event's display period
 * is over or the event is gone from the file.
 */

/** Date and time of an event in the user's language, e.g. "13 Nov 2026, 17:00". */
export function formatEventTime(at: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
}

/** The id of an event's notification. */
const noteId = (event: Pick<StarCitizenEvent, 'id'>) => `events:${event.id}`;

/** What an event's notification says at `now`: when it starts, or until when it runs. */
function eventMessage(event: StarCitizenEvent, now: number): AppNotification['message'] {
  const upcoming = eventState(event, now) === 'upcoming';
  return {
    key: upcoming ? 'notifications.eventUpcoming' : 'notifications.eventRunning',
    args: [{ texts: event.name }, { at: upcoming ? event.eventStart : event.eventEnd }],
  };
}

/** The notification of a shown event: when it starts, or until when it runs. */
export function eventNote(event: StarCitizenEvent, locale: Locale, now: number): AppNotification {
  const upcoming = eventState(event, now) === 'upcoming';
  return {
    id: noteId(event),
    kind: 'events',
    // Built in the language shown, so name and date follow a change of the language.
    message: eventMessage(event, now),
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

/**
 * Adds the notifications of the events shown now, each once, while the kind is on, and keeps the
 * open ones in step with the events. `known`: the events are the file's (read or stored); without
 * it nothing is checked off.
 */
export async function noteShownEvents(
  events: readonly StarCitizenEvent[],
  now: number,
  { known = true }: { known?: boolean } = {},
): Promise<void> {
  const shown = shownEvents(events, now);
  const settings = withDefaults(await settingsItem.getValue());
  const notes = isKindOn(settings.notificationsOff, 'events')
    ? shown.map((event) => eventNote(event, resolveLanguage(settings.language), now))
    : [];
  await updateNotifications((list) => withAdded(inStep(list, shown, now, known), notes));
}

/**
 * `list` with its open event notifications in step with the events shown at `now`: the current
 * name and time, and checked off once their event isn't shown any more (if `known`); `list` itself
 * if nothing changed.
 */
export function inStep(
  list: readonly AppNotification[],
  shown: readonly StarCitizenEvent[],
  now: number,
  known: boolean,
): readonly AppNotification[] {
  const byId = new Map(shown.map((event) => [noteId(event), event]));
  let changed = false;
  const next = list.map((note) => {
    if (note.kind !== 'events' || note.doneAt !== undefined) return note;
    const event = byId.get(note.id);
    if (!event) {
      if (!known) return note;
      changed = true;
      return { ...note, doneAt: now };
    }
    const message = eventMessage(event, now);
    if (JSON.stringify(message) === JSON.stringify(note.message)) return note;
    changed = true;
    return { ...note, message };
  });
  return changed ? next : list;
}
