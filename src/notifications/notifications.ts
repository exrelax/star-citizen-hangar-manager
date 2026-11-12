/*
 * The notifications of the Hangar Manager (#96), shown in the sidebar box "Notifications" (#142):
 * there they can be checked off one by one or all at once, without the browser's notification
 * permission. Each has an id per source and subject (e.g. `fillers:<order id>`, #105), so a source
 * adds it only once and a checked-off one doesn't come back. Kept in this browser only; checked-off
 * ones are removed after `NOTIFICATIONS_KEEP_DONE_MS`.
 *
 * Not stored here: what is worked out from the current state and can't be checked off, e.g. that
 * marked pledges can be melted now (see the sidebar).
 */

import { formatUsd } from '@/hangar/discount-format';
import { translate, type Locale, type MessageKey } from '@/i18n';

export const NOTIFICATIONS_KEEP_DONE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A part of a notification's text, put in the language shown: plain text or a count, a text per
 * language (English always), a date and time, an amount in USD, or names with their prices as a
 * short list ("A ($1), B ($2), C ($3) … and 2 more").
 */
export type NoteArg =
  | string
  | number
  | { texts: Partial<Record<Locale, string>> & { en: string } }
  | { at: number }
  | { usd: number }
  | { names: { name: string; usd?: number }[] };

/** A text built in the language shown: a message key and its parts. */
export interface NoteMessage {
  key: MessageKey;
  args: NoteArg[];
}

export interface AppNotification {
  /** Source and subject, e.g. `fillers:4OLB2S5WUG6PX`. */
  id: string;
  /** The text in the user's language when it was added; shown if there is no `message`. */
  text: string;
  /**
   * The text built in the language shown, so it follows a change of the language (#69, #211):
   * a message key and its parts; several are joined with " · ".
   */
  message?: NoteMessage | NoteMessage[];
  /** The pledge it is about, if any: the sidebar links to it. */
  pledgeId?: number;
  /** When it happened, in ms. */
  at: number;
  /** When it was checked off, in ms. */
  doneAt?: number;
  /** What it is about, for a link to it: changes in the Pledge Store (#164), events (#69). */
  kind?: 'warbonds' | 'storeItems' | 'events';
  /** A list shown when it is expanded, e.g. each changed Pledge Store item, as it was added. */
  details?: string[];
  /** The same list built in the language shown (#211); shown instead of `details`. */
  detailMessages?: NoteMessage[];
  /**
   * What it tells about, to know whether it still matters once checked off (#213): the SKU ids of
   * new warbond CCUs, the new or repriced Pledge Store items with their price then.
   */
  subject?: { warbonds?: number[]; items?: { id: number; price: number }[] };
  /**
   * Also shown as a browser notification (#155), with this title and text – only for what is worth
   * knowing while no RSI page is open, e.g. new warbond CCUs.
   */
  browser?: { title: string; text: string };
}

/**
 * The kinds whose change the Hangar Manager's Pledge Store tab shows (#276): the warbond CCUs and
 * the events. Only they link to it, in the sidebar and in the browser; changed store items such as
 * bundles or gear aren't in the tab.
 */
export const STORE_LINK_KINDS: readonly NonNullable<AppNotification['kind']>[] = [
  'warbonds',
  'events',
];

/** Whether the notification links to the Pledge Store tab. */
export const hasStoreLink = (note: Pick<AppNotification, 'kind'>): boolean =>
  note.kind !== undefined && STORE_LINK_KINDS.includes(note.kind);

export const notificationsItem = storage.defineItem<AppNotification[]>('local:notifications', {
  fallback: [],
});

/** Names shown in one text before "… and N more". */
const SHOWN_NAMES = 3;

/** "A, B, C … and 2 more". */
export function shortList(names: readonly string[], locale: Locale): string {
  const shown = names.slice(0, SHOWN_NAMES).join(', ');
  const more = names.length - SHOWN_NAMES;
  return more > 0 ? `${shown} ${translate(locale, 'notifications.andMore', [more])}` : shown;
}

/** A part of a notification's text in the language. */
function argText(arg: NoteArg, locale: Locale): string | number {
  if (typeof arg === 'string' || typeof arg === 'number') return arg;
  if ('texts' in arg) return arg.texts[locale] ?? arg.texts.en;
  if ('usd' in arg) return formatUsd(arg.usd, locale);
  if ('names' in arg) {
    const names = arg.names.map(({ name, usd }) =>
      usd === undefined ? name : `${name} (${formatUsd(usd, locale)})`,
    );
    return shortList(names, locale);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    arg.at,
  );
}

/** A message in the language. */
export const messageText = (message: NoteMessage, locale: Locale): string =>
  translate(
    locale,
    message.key,
    message.args.map((arg) => argText(arg, locale)),
  );

/** The text of a notification in the language: built from its message, else as it was added. */
export function noteText(note: AppNotification, locale: Locale): string {
  if (!note.message) return note.text;
  const messages = Array.isArray(note.message) ? note.message : [note.message];
  return messages.map((message) => messageText(message, locale)).join(' · ');
}

/** The list of a notification in the language, or as it was added. */
export const noteDetails = (note: AppNotification, locale: Locale): string[] =>
  note.detailMessages?.map((message) => messageText(message, locale)) ?? note.details ?? [];

/** The open notifications, newest first. */
export const openNotifications = (list: readonly AppNotification[]) =>
  list.filter((note) => note.doneAt === undefined).sort((a, b) => b.at - a.at);

/** `list` with the notifications it doesn't have yet (by id); `list` itself without new ones. */
export function withAdded(
  list: readonly AppNotification[],
  added: readonly AppNotification[],
): readonly AppNotification[] {
  const ids = new Set(list.map((note) => note.id));
  const fresh = added.filter((note) => !ids.has(note.id));
  return fresh.length ? [...list, ...fresh] : list;
}

/** `list` with the open ones of `ids` checked off at `now`; `list` itself if none was open. */
export function withDone(
  list: readonly AppNotification[],
  ids: ReadonlySet<string>,
  now: number,
): readonly AppNotification[] {
  if (!list.some((note) => ids.has(note.id) && note.doneAt === undefined)) return list;
  return list.map((note) =>
    ids.has(note.id) && note.doneAt === undefined ? { ...note, doneAt: now } : note,
  );
}

/** `list` without the ones checked off long ago; `list` itself if none is that old. */
export function withoutOld(
  list: readonly AppNotification[],
  now: number,
): readonly AppNotification[] {
  const kept = list.filter(
    (note) => note.doneAt === undefined || now - note.doneAt < NOTIFICATIONS_KEEP_DONE_MS,
  );
  return kept.length === list.length ? list : kept;
}

/** Applies `change` to the stored notifications, and stores them only if it changed them. */
export async function updateNotifications(
  change: (list: readonly AppNotification[]) => readonly AppNotification[],
): Promise<void> {
  const list = await notificationsItem.getValue();
  const next = change(list);
  if (next !== list) await notificationsItem.setValue([...next]);
}

/** Checks off the given notifications (all open ones without `ids`). */
export function checkOff(ids?: readonly string[]): Promise<void> {
  return updateNotifications((list) =>
    withDone(list, new Set(ids ?? openNotifications(list).map((note) => note.id)), Date.now()),
  );
}
