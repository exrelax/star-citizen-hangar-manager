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

export const NOTIFICATIONS_KEEP_DONE_MS = 30 * 24 * 60 * 60 * 1000;

export interface AppNotification {
  /** Source and subject, e.g. `fillers:4OLB2S5WUG6PX`. */
  id: string;
  /** The text shown, already in the user's language. */
  text: string;
  /** The pledge it is about, if any: the sidebar links to it. */
  pledgeId?: number;
  /** When it happened, in ms. */
  at: number;
  /** When it was checked off, in ms. */
  doneAt?: number;
  /** What it is about, for a link to it: changes in the Pledge Store (#164), events (#69). */
  kind?: 'warbonds' | 'storeItems' | 'events';
  /** A list shown when it is expanded, e.g. each changed Pledge Store item. */
  details?: string[];
  /**
   * Also shown as a browser notification (#155), with this title and text – only for what is worth
   * knowing while no RSI page is open, e.g. new warbond CCUs.
   */
  browser?: { title: string; text: string };
}

export const notificationsItem = storage.defineItem<AppNotification[]>('local:notifications', {
  fallback: [],
});

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
