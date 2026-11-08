import { isCheckingMessage, relayToOtherTabs } from '@/hangar/smart-update/broadcast';
import { OPEN_STYLEGUIDE } from '@/shared/messages';
import { migrateStorage } from '@/storage/migrate';

export default defineBackground(() => {
  // After an update: data of earlier versions moves to its current keys (see storage/migrate.ts).
  browser.runtime.onInstalled.addListener(() => void migrateStorage());

  // A smart update check started or ended in one RSI tab: the others show it too.
  browser.runtime.onMessage.addListener((message, sender) => {
    if (isCheckingMessage(message)) void relayToOtherTabs(message, sender.tab?.id);
  });

  // Development only: the manager's "Styleguide" link opens the styleguide page in a new tab.
  if (import.meta.env.DEV) {
    browser.runtime.onMessage.addListener((message) => {
      if (message === OPEN_STYLEGUIDE) {
        void browser.tabs.create({ url: browser.runtime.getURL('/styleguide.html') });
      }
    });
  }
});
