export default defineContentScript({
  // TODO: narrow down to the hangar pages once the requirements are clear.
  matches: ['https://robertsspaceindustries.com/*'],

  main() {
    console.debug('[sc-hangar-manager] content script loaded');
  },
});
