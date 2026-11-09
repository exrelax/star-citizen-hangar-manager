/*
 * Browser notifications (#152): an optional extra on top of the sidebar's "Notifications" box,
 * for when no RSI page is open. They need the `notifications` permission, which is optional: the
 * browser asks for it only when the user turns the setting on, never at install or update.
 *
 * The setting is the permission itself. It belongs to this browser (it isn't synced like the
 * other settings), so a switch kept in the synced settings would turn on in browsers without the
 * permission. Content scripts can't read or ask for permissions; the background script mirrors
 * the state into the local storage for them, and the request happens on the extension's page
 * `notification-permission.html` (it needs the click there as user gesture).
 */

/** A new object each time: the browser's API takes a mutable list. */
export const notificationsPermission = (): { permissions: ['notifications'] } => ({
  permissions: ['notifications'],
});

/** Whether this browser allows the extension's notifications (kept by the background script). */
export const browserNotificationsItem = storage.defineItem<boolean>(
  'local:notifications.browserAllowed',
  { fallback: false },
);

/** The browser refused the permission the last time it was asked for; cleared once granted. */
export const browserNotificationsRefusedItem = storage.defineItem<boolean>(
  'local:notifications.browserRefused',
  { fallback: false },
);

/** Messages from the settings to the background script. */
export const OPEN_NOTIFICATION_PERMISSION = 'shm:open-notification-permission';
export const REMOVE_NOTIFICATION_PERMISSION = 'shm:remove-notification-permission';

/** The page that asks for the permission. */
export const PERMISSION_PAGE = '/notification-permission.html';

/** Stores whether the permission is granted now (background script and permission page). */
export async function mirrorNotificationPermission(
  contains: () => Promise<boolean> = () => browser.permissions.contains(notificationsPermission()),
): Promise<boolean> {
  const allowed = await contains();
  if ((await browserNotificationsItem.getValue()) !== allowed) {
    await browserNotificationsItem.setValue(allowed);
  }
  if (allowed) await browserNotificationsRefusedItem.removeValue();
  return allowed;
}

/**
 * Asks the browser for the permission (call it in a click handler of an extension page) and
 * stores the answer.
 */
export async function requestNotificationPermission(
  request: () => Promise<boolean> = () => browser.permissions.request(notificationsPermission()),
): Promise<boolean> {
  const granted = await request().catch(() => false);
  await browserNotificationsRefusedItem.setValue(!granted);
  if (granted) await mirrorNotificationPermission(async () => true);
  return granted;
}
