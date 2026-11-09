import { listenToNotificationClicks } from '@/background/dispatch';
import { isCheckingMessage, relayToOtherTabs } from '@/hangar/smart-update/broadcast';
import { watchMeltReady } from '@/notifications/melt-ready-notification';
import { watchNotesInStep } from '@/notifications/note-sync';
import {
  mirrorNotificationPermission,
  notificationsPermission,
  OPEN_NOTIFICATION_PERMISSION,
  PERMISSION_PAGE,
  REMOVE_NOTIFICATION_PERMISSION,
} from '@/notifications/browser-permission';
import { OPEN_STYLEGUIDE } from '@/shared/messages';
import {
  READ_PLEDGE_STORE_IN_BACKGROUND,
  testReadPledgeStore,
  watchPledgeStore,
} from '@/store/background-schedule';
import { watchFillerNotification } from '@/store/paint-consultant/filler-notification';
import { migrateStorage } from '@/storage/migrate';

export default defineBackground(() => {
  // After an update: data of earlier versions moves to its current keys (see storage/migrate.ts).
  browser.runtime.onInstalled.addListener(() => void migrateStorage());

  // A smart update check started or ended in one RSI tab: the others show it too.
  browser.runtime.onMessage.addListener((message, sender) => {
    if (isCheckingMessage(message)) void relayToOtherTabs(message, sender.tab?.id);
  });

  // Browser notifications (#152): the settings see whether this browser allows them – also when
  // the permission is taken back in the browser's own settings, or was while the extension slept.
  void mirrorNotificationPermission();
  browser.permissions.onAdded.addListener(() => {
    void mirrorNotificationPermission();
    listenToNotificationClicks();
  });
  browser.permissions.onRemoved.addListener(() => void mirrorNotificationPermission());
  browser.runtime.onMessage.addListener((message) => {
    // Turning them on: the browser asks only on an extension page, after a click there.
    if (message === OPEN_NOTIFICATION_PERMISSION) {
      void browser.tabs.create({ url: browser.runtime.getURL(PERMISSION_PAGE) });
    }
    // Turning them off gives the permission back.
    if (message === REMOVE_NOTIFICATION_PERMISSION) {
      void browser.permissions
        .remove(notificationsPermission())
        .then(() => mirrorNotificationPermission());
    }
  });

  // The Paint Discount Consultant's filler paints can be melted (#105): an alarm 24 hours after
  // their order, then a browser notification.
  watchFillerNotification();

  // Pledges marked to melt can be melted now (#153): an alarm at the earliest time, then one
  // browser notification for all of them.
  watchMeltReady();

  // The sidebar's notifications and their browser notifications in step (#155).
  watchNotesInStep();

  // The Pledge Store on the schedule around the full hour, also with no RSI tab open (#163):
  // while browser notifications are on.
  watchPledgeStore();

  // Development only: the manager's "Styleguide" link opens the styleguide page in a new tab.
  if (import.meta.env.DEV) {
    browser.runtime.onMessage.addListener((message) => {
      if (message === OPEN_STYLEGUIDE) {
        void browser.tabs.create({ url: browser.runtime.getURL('/styleguide.html') });
      }
      // The Development settings: can the background read the Pledge Store from RSI?
      if (message === READ_PLEDGE_STORE_IN_BACKGROUND) return testReadPledgeStore();
    });
  }
});
