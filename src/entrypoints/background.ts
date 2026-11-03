import { OPEN_STYLEGUIDE } from '@/shared/messages';

export default defineBackground(() => {
  // The extension has no popup – the toolbar icon opens the manager page.
  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
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
