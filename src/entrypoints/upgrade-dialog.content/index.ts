import { logError } from '@/errors/error-log';
import { i18n, locale } from '@/i18n';
import { followLanguageSetting } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { createShipFactsLookup } from '@/ships/ship-facts';
import { bundledShipFacts, shipFactsItem, storedShipFacts } from '@/ships/sync-ship-facts';
import { createAlwaysAvailableCheck, watchUpgradeDialog } from '@/ships/upgrade-dialog-labels';
import { watch } from 'vue';
import './style.css';

/*
 * The label "Always available" in RSI's ship upgrade dialog (#401), on every page of RSI's website
 * the dialog opens on. Reads only the settings and the ship facts; see `upgrade-dialog-labels.ts`.
 */
export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  async main(ctx) {
    ctx.onInvalidated(await followLanguageSetting());

    let enabled = withDefaults(await settingsItem.getValue()).upgradeDialogAlwaysAvailable;
    const factsOf = (snapshot: Parameters<typeof storedShipFacts>[0]) => {
      const facts = storedShipFacts(snapshot) ?? bundledShipFacts();
      return createAlwaysAvailableCheck(facts && createShipFactsLookup(facts));
    };
    let isAlwaysAvailable = factsOf(await shipFactsItem.getValue());

    const dialog = watchUpgradeDialog(document, {
      enabled: () => enabled,
      isAlwaysAvailable: (target) => isAlwaysAvailable(target),
      texts: () => ({
        label: i18n.t('upgradeDialog.alwaysAvailable'),
        hint: i18n.t('upgradeDialog.alwaysAvailableHint'),
      }),
      onMismatch: (reason) =>
        void logError('PARSE-UPGRADE-DIALOG', `RSI's ship upgrade dialog: ${reason}`),
    });
    ctx.onInvalidated(dialog.stop);

    // A changed setting or new ship facts apply to an open dialog at once.
    ctx.onInvalidated(
      settingsItem.watch((stored) => {
        enabled = withDefaults(stored).upgradeDialogAlwaysAvailable;
        dialog.update();
      }),
    );
    ctx.onInvalidated(
      shipFactsItem.watch((snapshot) => {
        isAlwaysAvailable = factsOf(snapshot);
        dialog.update();
      }),
    );
    ctx.onInvalidated(watch(locale, dialog.update));
  },
});
