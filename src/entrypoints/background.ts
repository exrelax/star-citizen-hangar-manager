import { isCheckingMessage, relayToOtherTabs } from '@/hangar/smart-update/broadcast';
import {
  mirrorNotificationPermission,
  notificationsPermission,
  OPEN_NOTIFICATION_PERMISSION,
  PERMISSION_PAGE,
  REMOVE_NOTIFICATION_PERMISSION,
} from '@/notifications/browser-permission';
import { OPEN_STYLEGUIDE } from '@/shared/messages';
import {
  listenToFillerClicks,
  watchFillerNotification,
} from '@/store/paint-consultant/filler-notification';
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
    listenToFillerClicks();
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

  // Development only: the manager's "Styleguide" link opens the styleguide page in a new tab.
  if (import.meta.env.DEV) {
    browser.runtime.onMessage.addListener((message) => {
      if (message === OPEN_STYLEGUIDE) {
        void browser.tabs.create({ url: browser.runtime.getURL('/styleguide.html') });
      }
    });
  }
});
