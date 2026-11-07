import { OPEN_STYLEGUIDE } from '@/shared/messages';
import { migrateStorage } from '@/storage/migrate';

export default defineBackground(() => {
  // The session storage is for the extension's own pages unless allowed for content scripts too
  // (Chrome): the manager keeps the position of its summary box there (hangar/summary-position.ts).
  void browser.storage.session
    ?.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
    .catch(() => undefined);

  // After an update: data of earlier versions moves to its current keys (see storage/migrate.ts).
  browser.runtime.onInstalled.addListener(() => void migrateStorage());

  // Development only: the manager's "Styleguide" link opens the styleguide page in a new tab.
  if (import.meta.env.DEV) {
    browser.runtime.onMessage.addListener((message) => {
      if (message === OPEN_STYLEGUIDE) {
        void browser.tabs.create({ url: browser.runtime.getURL('/styleguide.html') });
      }
    });
  }
});
