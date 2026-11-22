import { BUYBACK_SNAPSHOT_VERSION } from '@/buyback/buyback';
import { buybackSnapshot } from '@/buyback/buyback-storage';
import { demoKeyItem } from '@/demo/demo-key';
import { demoBaseShipCounts } from '@/demo/demo-upgrade-counts';
import { logError } from '@/errors/error-log';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION } from '@/hangar/pledge';
import { i18n, locale } from '@/i18n';
import { localToday } from '@/orders/refund';
import {
  priceIncreasesItem,
  storedPriceIncreases,
} from '@/price-increases/price-increases-storage';
import { followLanguageSetting } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { createShipFactsLookup } from '@/ships/ship-facts';
import { buyableShipsItem, current, shipsItem } from '@/ships/ships-storage';
import { demoCountdownSources } from '@/demo/demo-upgrade-countdown';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import { bundledShipFacts, shipFactsItem, storedShipFacts } from '@/ships/sync-ship-facts';
import { createBaseShipCounts, type BaseShipCounts } from '@/ships/upgrade-dialog-counts';
import {
  createAvailabilityOf,
  watchUpgradeDialog,
  type UpgradeTarget,
} from '@/ships/upgrade-dialog-labels';
import { createTargetEnd, targetEndText } from '@/ships/upgrade-dialog-countdown';
import { EVENTS_VERSION, eventsItem, type EventsSnapshot } from '@/events/events-storage';
import {
  siteWarbondHistoryItem,
  storedSiteWarbondHistory,
  type SiteWarbondHistorySnapshot,
} from '@/store/warbond-history-storage';
import { watch } from 'vue';
import './style.css';

/*
 * Additions to RSI's ship upgrade dialog, on every page of RSI's website the dialog opens on: the
 * label "Always available" (#401), the countdown on target ships that aren't (#570) and the counts
 * on the base ships (#506). Reads only the settings, the ship facts, the events, the website's
 * warbond offers (in the demo its own events, #572) and – once the dialog opens – the stored
 * hangar, buy back and ships (in the demo its own hangar and buy back instead, #578); see
 * `upgrade-dialog-labels.ts`.
 */
export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  async main(ctx) {
    ctx.onInvalidated(await followLanguageSetting());

    let settings = withDefaults(await settingsItem.getValue());
    const factsOf = (snapshot: Parameters<typeof storedShipFacts>[0]) => {
      const facts = storedShipFacts(snapshot) ?? bundledShipFacts();
      return createAvailabilityOf(facts && createShipFactsLookup(facts));
    };
    let availability = factsOf(await shipFactsItem.getValue());

    // The countdown of target ships (#570): the running event and the warbond offers' expected ends.
    let events: EventsSnapshot | null = await eventsItem.getValue();
    let offers: SiteWarbondHistorySnapshot | null = await siteWarbondHistoryItem.getValue();
    // In the demo (#572): its own events and a made-up warbond end, never the website's.
    let buyable = current(await buyableShipsItem.getValue())?.skus ?? [];
    const endOf = () => {
      const sources = settings.demoMode
        ? demoCountdownSources(
            Date.now(),
            settings.demo.states.runningEvent,
            buyable.map((sku) => sku.shipId),
            availability,
          )
        : {
            events: events?.version === EVENTS_VERSION ? events.events : [],
            offers: storedSiteWarbondHistory(offers),
          };
      return createTargetEnd({ ...sources, availability: (target) => availability(target) });
    };
    let targetEnd = endOf();

    // The counts (#506): read when the dialog opens, read again once hangar, buy back or ships change.
    // In the demo (#578) from its own hangar and buy back, never from the stored real ones.
    let countsOf: ((target: UpgradeTarget) => BaseShipCounts | undefined) | undefined;
    // Counts up with every reset, so a load begun before it never sets outdated counts.
    let generation = 0;
    let loading = false;
    const realCounts = async () => {
      const [hangar, buyback, ships] = await Promise.all([
        hangarSnapshot.getValue(),
        buybackSnapshot.getValue(),
        shipsItem.getValue(),
      ]);
      return createBaseShipCounts({
        ships: current(ships)?.ships ?? [],
        ...(hangar?.version === HANGAR_SNAPSHOT_VERSION && { hangar: hangar.pledges }),
        ...(buyback?.version === BUYBACK_SNAPSHOT_VERSION && { buyback: buyback.pledges }),
      });
    };
    const demoCounts = async () => {
      const [key, ships, storeItems, buyable, increases] = await Promise.all([
        demoKeyItem.getValue(),
        shipsItem.getValue(),
        storeItemsItem.getValue(),
        buyableShipsItem.getValue(),
        priceIncreasesItem.getValue(),
      ]);
      const skus = current(buyable)?.skus;
      return demoBaseShipCounts({
        key,
        settings: settings.demo,
        ships: current(ships)?.ships,
        storeItems: storeItems?.version === STORE_ITEMS_VERSION ? storeItems.items : undefined,
        buyable: skus && new Set(skus.map((sku) => sku.shipId)),
        realIncreases: storedPriceIncreases(increases),
        today: localToday(),
        now: Date.now(),
      });
    };
    const loadCounts = async () => {
      if (countsOf || loading || !settings.upgradeDialogBaseCounts) return;
      loading = true;
      const started = generation;
      try {
        const counts = await (settings.demoMode ? demoCounts() : realCounts());
        if (started === generation) countsOf = counts;
      } finally {
        loading = false;
      }
      if (started === generation) dialog.update();
      else void loadCounts();
    };
    const resetCounts = () => {
      generation += 1;
      countsOf = undefined;
    };
    // The counts come from the real hangar or the demo's, made by its settings.
    const demoSource = (value: typeof settings) =>
      value.demoMode ? JSON.stringify(value.demo) : 'real';
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
      isAlwaysAvailable: (target) => availability(target) === true,
      texts: () => ({
        label: i18n.t('upgradeDialog.alwaysAvailable'),
        hint: i18n.t('upgradeDialog.alwaysAvailableHint'),
      }),
      countsOf: (target) => {
        if (!settings.upgradeDialogBaseCounts) return undefined;
        const counts = countsOf?.(target);
        return counts && countsText(counts);
      },
      countdownOf: (target) => {
        if (!settings.upgradeDialogAlwaysAvailable) return undefined;
        const now = Date.now();
        const end = targetEnd(target, now);
        return end && targetEndText(end, now, locale.value);
      },
      onOpen: () => void loadCounts(),
      onMismatch: (reason) =>
        void logError('PARSE-UPGRADE-DIALOG', `RSI's ship upgrade dialog: ${reason}`),
    });
    ctx.onInvalidated(dialog.stop);

    // A changed setting or new data apply to an open dialog at once.
    ctx.onInvalidated(
      settingsItem.watch((stored) => {
        const before = demoSource(settings);
        settings = withDefaults(stored);
        targetEnd = endOf();
        if (demoSource(settings) !== before) resetCounts();
        dialog.update();
        if (document.querySelector('.ShipUpgradeModal')) void loadCounts();
      }),
    );
    ctx.onInvalidated(
      shipFactsItem.watch((snapshot) => {
        availability = factsOf(snapshot);
        targetEnd = endOf();
        dialog.update();
      }),
    );
    ctx.onInvalidated(
      eventsItem.watch((snapshot) => {
        events = snapshot;
        targetEnd = endOf();
        dialog.update();
      }),
    );
    ctx.onInvalidated(
      siteWarbondHistoryItem.watch((snapshot) => {
        offers = snapshot;
        targetEnd = endOf();
        dialog.update();
      }),
    );
    ctx.onInvalidated(
      buyableShipsItem.watch((snapshot) => {
        buyable = current(snapshot)?.skus ?? [];
        targetEnd = endOf();
        dialog.update();
      }),
    );
    const reloadCounts = () => {
      resetCounts();
      if (document.querySelector('.ShipUpgradeModal')) void loadCounts();
    };
    ctx.onInvalidated(hangarSnapshot.watch(reloadCounts));
    ctx.onInvalidated(buybackSnapshot.watch(reloadCounts));
    ctx.onInvalidated(shipsItem.watch(reloadCounts));
    // What the demo's hangar and buy back are made of (#578).
    ctx.onInvalidated(demoKeyItem.watch(reloadCounts));
    ctx.onInvalidated(storeItemsItem.watch(reloadCounts));
    ctx.onInvalidated(buyableShipsItem.watch(reloadCounts));
    ctx.onInvalidated(priceIncreasesItem.watch(reloadCounts));
    ctx.onInvalidated(watch(locale, dialog.update));
  },
});
