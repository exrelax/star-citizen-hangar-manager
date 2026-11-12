import {
  onNotificationClick,
  onNotificationClosed,
  openHangarManager,
} from '@/background/dispatch';
import { translate } from '@/i18n';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { browserNotificationsItem } from './browser-permission';
import { checkOff, hasStoreLink, notificationsItem, type AppNotification } from './notifications';

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

/** A notification older than this isn't shown in the browser any more (e.g. after a restart). */
const BROWSER_MAX_AGE_MS = 15 * 60 * 1000;

/** The sidebar notifications already shown in the browser, so each shows once. */
const shownItem = storage.defineItem<readonly string[]>('local:notifications.browserShown', {
  fallback: [],
});

/** Shows a sidebar notification in the browser, with its browser title and text. */
export async function showNoteInBrowser(
  note: AppNotification & Required<Pick<AppNotification, 'browser'>>,
): Promise<void> {
  const locale = resolveLanguage(withDefaults(await settingsItem.getValue()).language);
  const showStore = translate(locale, 'notifications.showInStore');
  await browser.notifications.create(browserIdOf(note), {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: note.browser.title,
    message: note.browser.text,
    // The button (Chrome) does what the click does: Firefox shows none and refuses the option.
    // Only where the Pledge Store tab shows the change (#276).
    ...(!import.meta.env.FIREFOX && hasStoreLink(note) && { buttons: [{ title: showStore }] }),
  });
}

/**
 * Shows the new notifications that want it in the browser too: once each, only recent ones, and
 * only while the browser allows it and the demo mode is off.
 */
export async function showNewNotesInBrowser(
  list: readonly AppNotification[],
  now = Date.now(),
): Promise<void> {
  const fresh = list.filter(
    (note): note is AppNotification & Required<Pick<AppNotification, 'browser'>> =>
      !!note.browser && note.doneAt === undefined && now - note.at < BROWSER_MAX_AGE_MS,
  );
  if (!fresh.length) return;
  const shown = new Set(await shownItem.getValue());
  const unseen = fresh.filter((note) => !shown.has(note.id));
  if (!unseen.length) return;
  const [allowed, settings] = await Promise.all([
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
  ]);
  if (allowed && !withDefaults(settings).demoMode) {
    for (const note of unseen) await showNoteInBrowser(note);
  }
  // Only the ids of notifications still stored are kept.
  const stored = new Set(list.map((note) => note.id));
  await shownItem.setValue([
    ...[...shown].filter((id) => stored.has(id)),
    ...unseen.map((n) => n.id),
  ]);
}

/** Opens the Hangar Manager for a browser notification: at what it tells, if the tab shows it. */
export async function openForNote(browserId: string): Promise<void> {
  const id = noteIdOf(browserId);
  const note = (await notificationsItem.getValue()).find((entry) => entry.id === id);
  await openHangarManager(note && hasStoreLink(note) ? 'showWarbonds' : 'open');
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
    void showNewNotesInBrowser(list ?? []);
  });
  void notificationsItem.getValue().then((list) => {
    open = new Set(list.filter((note) => note.doneAt === undefined).map((note) => note.id));
  });
  // A click (or its button): the Pledge Store tab at the warbond CCUs where it shows the change
  // (#276), else just the manager.
  const openFor = (browserId: string) => void openForNote(browserId);
  onNotificationClick(PREFIX, openFor, (_index, browserId) => openFor(browserId));
  // Closed in the browser: checked off in the sidebar.
  onNotificationClosed(PREFIX, (browserId) => {
    const id = noteIdOf(browserId);
    if (id) void checkOff([id]);
  });
}
