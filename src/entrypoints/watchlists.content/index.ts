import { logError } from '@/errors/error-log';
import { i18n } from '@/i18n';
import { followLanguageSetting } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { current, shipsItem } from '@/ships/ships-storage';
import { migrateStorage } from '@/storage/migrate';
import { STORE_ITEMS_VERSION, storeItemsItem } from '@/store/items/store-items-storage';
import type { StoreItem } from '@/store/items/store-items';
import type { Ship } from '@/ships/ships';
import RsiWatchButton from '@/watchlists/components/RsiWatchButton.vue';
import {
  chosenUpgrade,
  isPaintPage,
  paintOfCard,
  paintOfPage,
  PAINT_ANCHOR,
  SKU_CARD,
  SKU_CARD_ACTIONS,
  SKU_CARD_LINK,
  UPGRADE_CART,
  UPGRADE_MODAL,
  type RsiWatchPlace,
} from '@/watchlists/rsi-pages';
import { followWatchlists, type NewWatchItem } from '@/watchlists/use-watchlists';
import { createApp, ref, type App } from 'vue';
import './style.css';

/*
 * Buttons on RSI's own pages that put a Pledge Store item on watchlists (#471): on a paint's page
 * below its buying block, on the card of a paint in the store's lists left of its cart button
 * (#632), and in RSI's ship upgrade dialog next to its "Add To Cart" once a base and a target ship
 * are chosen (see `rsi-pages.ts`). RSI's store is a single-page app, so the page is
 * watched and the buttons follow it. When the markup lacks what they need there is no button, and
 * the error log tells it once per page (`WATCHLIST-RSI-PAGE-FAIL`).
 */

/** How long a paint's page or the dialog may lack what the button needs before it is logged. */
const MISMATCH_AFTER_MS = 8000;

export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  async main(ctx) {
    await migrateStorage();
    ctx.onInvalidated(await followLanguageSetting());

    // The demo's watchlists in the demo mode (#474), as in the Hangar Manager.
    const demo = ref(withDefaults(await settingsItem.getValue()).demoMode);
    ctx.onInvalidated(settingsItem.watch((value) => (demo.value = withDefaults(value).demoMode)));
    let stopLists: (() => void) | undefined;
    const followLists = () => (stopLists ??= followWatchlists(demo));
    ctx.onInvalidated(() => stopLists?.());

    let items: readonly StoreItem[] = [];
    let ships: readonly Ship[] = [];
    const readItems = (value: Awaited<ReturnType<typeof storeItemsItem.getValue>>) =>
      (items = value?.version === STORE_ITEMS_VERSION ? value.items : []);
    readItems(await storeItemsItem.getValue());
    ships = current(await shipsItem.getValue())?.ships ?? [];
    ctx.onInvalidated(storeItemsItem.watch(readItems));
    ctx.onInvalidated(shipsItem.watch((value) => (ships = current(value)?.ships ?? [])));

    /** A mounted button: where, for which item. */
    interface Mounted {
      host: HTMLElement;
      app: App;
      key: string;
    }
    let paintButton: Mounted | undefined;
    let ccuButton: Mounted | undefined;
    const unmount = (mounted: Mounted | undefined) => {
      mounted?.app.unmount();
      mounted?.host.remove();
      return undefined;
    };
    const mount = (
      where: RsiWatchPlace,
      place: (host: HTMLElement) => void,
      item: NewWatchItem,
      title: string,
    ) => {
      followLists();
      const host = document.createElement('span');
      host.className = `shm-rsi-watch-host is-${where}`;
      place(host);
      const app = createApp(RsiWatchButton, { item, title, place: where });
      app.mount(host);
      return { host, app };
    };

    // Each mismatch once per page and kind.
    const logged = new Set<string>();
    const since = new Map<string, number>();
    const mismatch = (key: string, message: string) => {
      const first = since.get(key) ?? Date.now();
      since.set(key, first);
      if (Date.now() - first < MISMATCH_AFTER_MS || logged.has(key)) return;
      logged.add(key);
      void logError('WATCHLIST-RSI-PAGE-FAIL', message);
    };
    const settled = (key: string) => since.delete(key);

    const placePaint = () => {
      const path = location.pathname;
      if (!isPaintPage(path)) {
        paintButton = unmount(paintButton);
        return;
      }
      const anchor = document.querySelector(PAINT_ANCHOR);
      const paint = paintOfPage(path, document.title, items);
      if (!anchor || !paint) {
        paintButton = unmount(paintButton);
        if (!anchor) mismatch(`anchor:${path}`, `No buying block on the paint's page ${path}`);
        else if (items.length)
          mismatch(`paint:${path}`, `No store item for the paint's page ${path}`);
        return;
      }
      settled(`anchor:${path}`);
      settled(`paint:${path}`);
      const key = `${path}|${paint.id}`;
      if (paintButton?.key === key && paintButton.host.isConnected) return;
      paintButton = unmount(paintButton);
      const item: NewWatchItem = {
        kind: 'storePaint',
        skuId: paint.id,
        name: paint.name,
        value: paint.discountedPrice ?? paint.price,
      };
      paintButton = {
        ...mount(
          'page',
          (host) => anchor.after(host),
          item,
          i18n.t('watchlists.putOn', [paint.name]),
        ),
        key,
      };
    };

    const placeCcu = () => {
      const modal = document.querySelector(UPGRADE_MODAL);
      const chosen = modal && chosenUpgrade(modal);
      const cart = modal?.querySelector(UPGRADE_CART);
      if (!modal || !chosen || !cart) {
        ccuButton = unmount(ccuButton);
        if (modal && chosen && !cart)
          mismatch('upgrade', 'No "Add To Cart" in the ship upgrade dialog');
        return;
      }
      settled('upgrade');
      const key = `${chosen.from.id}-${chosen.to.id}`;
      if (ccuButton?.key === key && ccuButton.host.isConnected) return;
      ccuButton = unmount(ccuButton);
      const from = ships.find((ship) => ship.id === chosen.from.id);
      const to = ships.find((ship) => ship.id === chosen.to.id);
      const name = i18n.t('watchlists.ccuName', [chosen.from.name, chosen.to.name]);
      const item: NewWatchItem = {
        kind: 'storeCcu',
        fromShipId: chosen.from.id,
        toShipId: chosen.to.id,
        name,
        ...(from && to && to.msrp > from.msrp && { value: to.msrp - from.msrp }),
      };
      ccuButton = {
        ...mount('dialog', (host) => cart.prepend(host), item, i18n.t('watchlists.putOn', [name])),
        key,
      };
    };

    // The cards of the store's lists (#632): RSI renders them anew as the list is filtered, sorted
    // or scrolled, so each card is checked on every change and a button follows its card's paint.
    const cardButtons = new Map<Element, Mounted>();
    const placeCards = () => {
      for (const [card, mounted] of cardButtons) {
        if (!card.isConnected || !mounted.host.isConnected) {
          unmount(mounted);
          cardButtons.delete(card);
        }
      }
      if (!items.length) return;
      for (const card of document.querySelectorAll(SKU_CARD)) {
        const href = card.querySelector(SKU_CARD_LINK)?.getAttribute('href') ?? '';
        const paint = paintOfCard(href, items);
        const present = cardButtons.get(card);
        if (!paint) {
          if (present) {
            cardButtons.delete(card);
            unmount(present);
          }
          continue;
        }
        const key = `${paint.id}`;
        if (present?.key === key) continue;
        if (present) unmount(present);
        const actions = card.querySelector(SKU_CARD_ACTIONS);
        if (!actions) {
          cardButtons.delete(card);
          mismatch(`card:${location.pathname}`, `No cart button on a card of ${location.pathname}`);
          continue;
        }
        const item: NewWatchItem = {
          kind: 'storePaint',
          skuId: paint.id,
          name: paint.name,
          value: paint.discountedPrice ?? paint.price,
        };
        const title = i18n.t('watchlists.putOn', [paint.name]);
        cardButtons.set(card, {
          ...mount('card', (host) => actions.prepend(host), item, title),
          key,
        });
      }
    };

    const place = () => {
      placePaint();
      placeCcu();
      placeCards();
    };
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.addEventListener(window, 'wxt:locationchange', place);
    place();
    ctx.onInvalidated(() => {
      observer.disconnect();
      paintButton = unmount(paintButton);
      ccuButton = unmount(ccuButton);
      for (const mounted of cardButtons.values()) unmount(mounted);
      cardButtons.clear();
    });
  },
});
