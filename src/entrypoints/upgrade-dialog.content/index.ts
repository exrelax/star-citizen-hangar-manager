import { BUYBACK_SNAPSHOT_VERSION } from '@/buyback/buyback';
import { buybackSnapshot } from '@/buyback/buyback-storage';
import { logError } from '@/errors/error-log';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION } from '@/hangar/pledge';
import { i18n, locale } from '@/i18n';
import { followLanguageSetting } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { createShipFactsLookup } from '@/ships/ship-facts';
import { current, shipsItem } from '@/ships/ships-storage';
import { bundledShipFacts, shipFactsItem, storedShipFacts } from '@/ships/sync-ship-facts';
import { createBaseShipCounts, type BaseShipCounts } from '@/ships/upgrade-dialog-counts';
import {
  createAlwaysAvailableCheck,
  watchUpgradeDialog,
  type UpgradeTarget,
} from '@/ships/upgrade-dialog-labels';
import { watch } from 'vue';
import './style.css';

/*
 * Additions to RSI's ship upgrade dialog, on every page of RSI's website the dialog opens on: the
 * label "Always available" (#401) and the counts on the base ships (#506). Reads only the
 * settings, the ship facts and – once the dialog opens – the stored hangar, buy back and ships;
 * see `upgrade-dialog-labels.ts`.
 */
export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  async main(ctx) {
    ctx.onInvalidated(await followLanguageSetting());

    let settings = withDefaults(await settingsItem.getValue());
    const factsOf = (snapshot: Parameters<typeof storedShipFacts>[0]) => {
      const facts = storedShipFacts(snapshot) ?? bundledShipFacts();
      return createAlwaysAvailableCheck(facts && createShipFactsLookup(facts));
    };
    let isAlwaysAvailable = factsOf(await shipFactsItem.getValue());

    // The counts (#506): read when the dialog opens, read again once hangar, buy back or ships change.
    let countsOf: ((target: UpgradeTarget) => BaseShipCounts | undefined) | undefined;
    let loading = false;
    const loadCounts = async () => {
      if (countsOf || loading || !settings.upgradeDialogBaseCounts) return;
      loading = true;
      try {
        const [hangar, buyback, ships] = await Promise.all([
          hangarSnapshot.getValue(),
          buybackSnapshot.getValue(),
          shipsItem.getValue(),
        ]);
        countsOf = createBaseShipCounts({
          ships: current(ships)?.ships ?? [],
          ...(hangar?.version === HANGAR_SNAPSHOT_VERSION && { hangar: hangar.pledges }),
          ...(buyback?.version === BUYBACK_SNAPSHOT_VERSION && { buyback: buyback.pledges }),
        });
      } finally {
        loading = false;
      }
      dialog.update();
    };
    const number = () => new Intl.NumberFormat(locale.value);
    const countsText = (counts: BaseShipCounts) => {
      const format = (value: number) => number().format(value);
      const args = [
        format(counts.owned),
        format(counts.hangarCcus),
        format(counts.buybackCcus ?? 0),
      ];
      return counts.buybackCcus === undefined
        ? {
            text: i18n.t('upgradeDialog.countsNoBuyback', args),
            hint: i18n.t('upgradeDialog.countsNoBuybackHint', args),
          }
        : {
            text: i18n.t('upgradeDialog.counts', args),
            hint: i18n.t('upgradeDialog.countsHint', args),
          };
    };

    const dialog = watchUpgradeDialog(document, {
      enabled: () => settings.upgradeDialogAlwaysAvailable,
      isAlwaysAvailable: (target) => isAlwaysAvailable(target),
      texts: () => ({
        label: i18n.t('upgradeDialog.alwaysAvailable'),
        hint: i18n.t('upgradeDialog.alwaysAvailableHint'),
      }),
      countsOf: (target) => {
        if (!settings.upgradeDialogBaseCounts) return undefined;
        const counts = countsOf?.(target);
        return counts && countsText(counts);
      },
      onOpen: () => void loadCounts(),
      onMismatch: (reason) =>
        void logError('PARSE-UPGRADE-DIALOG', `RSI's ship upgrade dialog: ${reason}`),
    });
    ctx.onInvalidated(dialog.stop);

    // A changed setting or new data apply to an open dialog at once.
    ctx.onInvalidated(
      settingsItem.watch((stored) => {
        settings = withDefaults(stored);
        dialog.update();
        if (document.querySelector('.ShipUpgradeModal')) void loadCounts();
      }),
    );
    ctx.onInvalidated(
      shipFactsItem.watch((snapshot) => {
        isAlwaysAvailable = factsOf(snapshot);
        dialog.update();
      }),
    );
    const reloadCounts = () => {
      if (!countsOf) return;
      countsOf = undefined;
      if (document.querySelector('.ShipUpgradeModal')) void loadCounts();
    };
    ctx.onInvalidated(hangarSnapshot.watch(reloadCounts));
    ctx.onInvalidated(buybackSnapshot.watch(reloadCounts));
    ctx.onInvalidated(shipsItem.watch(reloadCounts));
    ctx.onInvalidated(watch(locale, dialog.update));
  },
});
