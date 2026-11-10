import { withDone, openNotifications, type AppNotification } from '@/notifications/notifications';

/*
 * The sidebar's notifications in the demo mode (#210, #131): sample notifications of its own,
 * kept apart from the real ones, so the demo never shows the account's notifications and trying
 * it out checks off nothing real. Set once per demo key; the × checks them off as usual. The demo
 * never shows a browser notification for them.
 */

export const demoNotificationsItem = storage.defineItem<AppNotification[]>(
  'local:demo.notifications',
  { fallback: [] },
);

/** The demo key the samples were set for. */
const seededItem = storage.defineItem<string | null>('local:demo.notificationsSeeded', {
  fallback: null,
});

/** Sets the demo's sample notifications, once per demo key. */
export async function seedDemoNotes(key: string, notes: readonly AppNotification[]): Promise<void> {
  if ((await seededItem.getValue()) === key) return;
  await demoNotificationsItem.setValue([...notes]);
  await seededItem.setValue(key);
}

/** Checks off the demo's notifications (all open ones without `ids`). */
export async function checkOffDemo(ids?: readonly string[]): Promise<void> {
  const list = await demoNotificationsItem.getValue();
  const done = new Set(ids ?? openNotifications(list).map((note) => note.id));
  await demoNotificationsItem.setValue([...withDone(list, done, Date.now())]);
}
