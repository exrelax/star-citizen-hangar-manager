export default defineBackground(() => {
  // The extension has no popup – the toolbar icon opens the manager page.
  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });
});
