import { syncManagerLinks, watchManagerLinks } from '@/ccugame/manager-links';
import { locale } from '@/i18n';
import { followLanguageSetting } from '@/settings/language';
import { watch } from 'vue';

/** Adds "Open in Hangar Manager" links to the item details of CCU Game. */
export default defineContentScript({
  matches: ['https://ccugame.app/*'],

  async main(ctx) {
    ctx.onInvalidated(await followLanguageSetting());
    ctx.onInvalidated(watchManagerLinks(document.body));
    // Link texts follow a language change.
    ctx.onInvalidated(watch(locale, () => syncManagerLinks(document.body)));
  },
});
