/*
 * The notifications of the Hangar Manager (#96), shown in the sidebar box "Notifications" (#142):
 * there they can be checked off one by one or all at once, without the browser's notification
 * permission. Each has an id per source and subject (e.g. `meltable:<pledge id>`), so a source
 * adds it only once and a checked-off one doesn't come back. Kept in this browser only; checked-off
 * ones are removed after `NOTIFICATIONS_KEEP_DONE_MS`.
 */

export const NOTIFICATIONS_KEEP_DONE_MS = 30 * 24 * 60 * 60 * 1000;

export interface AppNotification {
  /** Source and subject, e.g. `meltable:114816820`. */
  id: string;
  /** What it is about; the sidebar words it after this. */
  kind: 'meltable';
  /** The pledge it is about. */
  pledgeId: number;
  /** The pledge's title, kept for when the pledge is gone. */
  title: string;
  /** When it happened (e.g. since when the pledge can be melted), in ms. */
  at: number;
  /** When it was checked off, in ms. */
  doneAt?: number;
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

/** The notifications about marked pledges that can be melted now (#97). */
export function meltableNotifications(
  marks: Iterable<{ pledgeId: number; title: string; meltableAt: number }>,
  now: number,
): AppNotification[] {
  return [...marks]
    .filter((mark) => mark.meltableAt <= now)
    .map((mark) => ({
      id: `meltable:${mark.pledgeId}`,
      kind: 'meltable',
      pledgeId: mark.pledgeId,
      title: mark.title,
      at: mark.meltableAt,
    }));
}

/**
 * The notifications for the marked pledges: one for each that can be melted now, and the open
 * ones about pledges no longer marked (melted, unmarked) checked off – they say nothing anymore.
 */
export function syncMeltable(
  list: readonly AppNotification[],
  marks: ReadonlyMap<number, { pledgeId: number; title: string; meltableAt: number }>,
  now: number,
): readonly AppNotification[] {
  const added = withAdded(list, meltableNotifications(marks.values(), now));
  const gone = added
    .filter((note) => note.kind === 'meltable' && !marks.has(note.pledgeId))
    .map((note) => note.id);
  return withoutOld(withDone(added, new Set(gone), now), now);
}
