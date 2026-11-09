import { onNotificationClosed } from '@/background/dispatch';
import { checkOff, notificationsItem, type AppNotification } from './notifications';

/*
 * The sidebar's notifications that can be checked off and the browser notifications in step
 * (#155): checking one off in the sidebar takes away its browser notification, and closing that in
 * the browser checks it off in the sidebar. Both share the sidebar notification's id, as
 * `note:<id>` in the browser.
 *
 * Not every sidebar notification is also a browser notification: the browser shows only what is
 * worth knowing while no RSI page is open, sparingly. A source that wants one shows it with
 * `showNoteInBrowser`.
 */

const PREFIX = 'note:';

/** The id of a sidebar notification in the browser. */
export const browserIdOf = (note: Pick<AppNotification, 'id'>) => `${PREFIX}${note.id}`;

/** The sidebar notification's id of a browser notification, if it is one of them. */
export const noteIdOf = (browserId: string) =>
  browserId.startsWith(PREFIX) ? browserId.slice(PREFIX.length) : undefined;

/** Shows a sidebar notification in the browser too (the caller checks the permission). */
export async function showNoteInBrowser(note: AppNotification, title: string): Promise<void> {
  await browser.notifications.create(browserIdOf(note), {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title,
    message: note.text,
  });
}

/** Wires both directions (call it in the background script). */
export function watchNotesInStep(): void {
  // Checked off in the sidebar (or gone): away in the browser too.
  let open = new Set<string>();
  notificationsItem.watch((list) => {
    const stillOpen = new Set(
      (list ?? []).filter((note) => note.doneAt === undefined).map((note) => note.id),
    );
    for (const id of open) {
      if (!stillOpen.has(id)) void browser.notifications?.clear(browserIdOf({ id }));
    }
    open = stillOpen;
  });
  void notificationsItem.getValue().then((list) => {
    open = new Set(list.filter((note) => note.doneAt === undefined).map((note) => note.id));
  });
  // Closed in the browser: checked off in the sidebar.
  onNotificationClosed(PREFIX, (browserId) => {
    const id = noteIdOf(browserId);
    if (id) void checkOff([id]);
  });
}
