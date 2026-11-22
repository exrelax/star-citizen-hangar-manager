import {
  onManagerSeen,
  onNotificationClick,
  onNotificationClosed,
  openHangarManager,
} from '@/background/dispatch';
import { translate } from '@/i18n';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { isKindOn } from '@/notifications/kinds';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { loadStoreCatalog, watchStoreCatalog } from './store-catalog-storage';
import { storeChangeMessage } from './store-change-text';
import { changeKey, storeChangesOf, storeSeenItem, withoutGone } from './watch-store-changes';
import { loadWatchlists, watchWatchlists } from './watchlists-storage';

/*
 * The browser notification of changed Pledge Store items on a watchlist (#472), shown by the
 * background script also while no RSI page is open: one per watchlist, naming its changes. It
 * notes the items seen for the first time, and tells each change once.
 *
 * It goes away once the changes are gone – the watchlist was seen, its sidebar notification
 * dismissed, the price back –, once the Hangar Manager is seen (its sidebar tells the same, #155),
 * and when closed. Without the browser's permission, with the kind `watchlistStore` turned off
 * (#197) or in the demo mode nothing is shown, but the changes count as told.
 */

/** One notification per watchlist: this prefix and its id. */
const NOTIFICATION_PREFIX = 'shm-watchlist-store:';

/** The changes already told (`changeKey`). */
const notifiedItem = storage.defineItem<readonly string[]>(
  'local:notifications.watchlistStoreNotified',
  { fallback: [] },
);

/** The watchlists whose notification shows now, by id. */
const shownItem = storage.defineItem<readonly string[]>('local:notifications.watchlistStoreShown', {
  fallback: [],
});

/** Tells the new changes, takes away the notifications of changes that are gone. */
export async function checkWatchlistStoreChanges(): Promise<void> {
  const [lists, catalog, seen, notified, allowed, settings, before] = await Promise.all([
    loadWatchlists(false),
    loadStoreCatalog(),
    storeSeenItem.getValue(),
    notifiedItem.getValue(),
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
    shownItem.getValue(),
  ]);
  const { changed, noted } = storeChangesOf(lists, catalog, seen);
  // The items seen for the first time are noted; those no longer on a watchlist forgotten.
  const nextSeen = withoutGone({ ...seen, ...noted }, lists);
  if (JSON.stringify(nextSeen) !== JSON.stringify(seen)) await storeSeenItem.setValue(nextSeen);

  const { demoMode, language, notificationsOff } = withDefaults(settings);
  const shown = allowed && !demoMode && isKindOn(notificationsOff, 'watchlistStore');
  const told = new Set(notified);
  const open = new Set(changed.map(({ list }) => list.id));

  const gone = before.filter((id) => !shown || !open.has(id));
  await Promise.all(gone.map((id) => browser.notifications?.clear(NOTIFICATION_PREFIX + id)));
  let showing = before.filter((id) => !gone.includes(id));
  if (shown) {
    const locale = resolveLanguage(language);
    for (const entry of changed) {
      if (entry.changes.every((change) => told.has(changeKey(entry.list, change)))) continue;
      await browser.notifications.create(NOTIFICATION_PREFIX + entry.list.id, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: translate(locale, 'notifications.browserWatchlistStoreTitle'),
        message: storeChangeMessage(entry, locale),
      });
      showing = [...new Set([...showing, entry.list.id])];
    }
  }
  if (JSON.stringify(showing) !== JSON.stringify(before)) await shownItem.setValue(showing);

  // The changes still there count as told, so the stored list doesn't grow.
  const kept = changed.flatMap(({ list, changes }) => changes.map((c) => changeKey(list, c)));
  if (JSON.stringify(kept) !== JSON.stringify(notified)) await notifiedItem.setValue(kept);
}

async function clearShown(): Promise<void> {
  const ids = await shownItem.getValue();
  if (!ids.length) return;
  await shownItem.setValue([]);
  await Promise.all(ids.map((id) => browser.notifications?.clear(NOTIFICATION_PREFIX + id)));
}

/** Wires the data it follows and the click (call it in the background script). */
export function watchWatchlistStoreChanges(): void {
  const check = () => void checkWatchlistStoreChanges();
  check();
  watchWatchlists(check, false);
  watchStoreCatalog(check);
  storeSeenItem.watch(check);
  browserNotificationsItem.watch(check);
  settingsItem.watch(check);
  onManagerSeen(() => void clearShown());
  onNotificationClosed(NOTIFICATION_PREFIX, (id) => {
    const listId = id.slice(NOTIFICATION_PREFIX.length);
    void shownItem.getValue().then((ids) => shownItem.setValue(ids.filter((x) => x !== listId)));
  });
  onNotificationClick(
    NOTIFICATION_PREFIX,
    (id) => void openHangarManager(`showWatchlist:${id.slice(NOTIFICATION_PREFIX.length)}`),
  );
}
