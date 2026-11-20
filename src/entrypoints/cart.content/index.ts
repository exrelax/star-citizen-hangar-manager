import { followLanguageSetting } from '@/settings/language';
import { migrateStorage } from '@/storage/migrate';
import CartPaintDiscount from '@/store/components/CartPaintDiscount.vue';
import { createApp, type App } from 'vue';

/*
 * The paint discount note on RSI's cart page (#458), see `CartPaintDiscount.vue`. RSI's store is a
 * single-page app: the cart can open without a page load, and its content comes after the page,
 * so the note waits for the cart's steps and follows the address.
 */

/** RSI's cart, optionally with a locale prefix: "/en/store/pledge/cart". */
const CART_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?store\/pledge\/cart\/?$/i;
/** The cart's steps (items, then checkout); the note goes above them. */
const CART_ANCHOR = '.c-cartStepper';

export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  async main(ctx) {
    await migrateStorage();
    ctx.onInvalidated(await followLanguageSetting());

    let app: App | undefined;
    let host: HTMLElement | undefined;
    const unmount = () => {
      app?.unmount();
      host?.remove();
      app = undefined;
      host = undefined;
    };
    /** Mounts the note above the cart's steps, once they are there; again if RSI replaced them. */
    const place = () => {
      if (!CART_PATH.test(location.pathname)) return unmount();
      const anchor = document.querySelector(CART_ANCHOR);
      if (!anchor) return;
      if (host?.isConnected && host.nextElementSibling === anchor) return;
      unmount();
      host = document.createElement('div');
      host.className = 'shm-cart-paints-host';
      anchor.before(host);
      app = createApp(CartPaintDiscount, {
        // RSI's own cart shows the paints added once the page loads again.
        onAdded: () => setTimeout(() => location.reload(), 1500),
      });
      app.mount(host);
    };
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.addEventListener(window, 'wxt:locationchange', place);
    place();
    ctx.onInvalidated(() => {
      observer.disconnect();
      unmount();
    });
  },
});
