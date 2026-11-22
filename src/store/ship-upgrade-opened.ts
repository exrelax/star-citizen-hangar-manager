import { onMounted, onUnmounted } from 'vue';

/*
 * RSI's ship upgrade dialog opens below the Hangar Manager's overlays (#564), e.g. from "Ship
 * upgrade" in "All ships by value" (#385). Its buttons tell that it opens
 * (`notifyShipUpgradeOpened`), and every open overlay that holds such buttons closes on it
 * (`useCloseOnShipUpgrade`), so RSI's dialog shows.
 *
 * RSI opens the dialog with a click handler on the page for `js-open-ship-upgrades`, which gets the
 * click after the button's own: the notice goes out a task later, once RSI's handler has run, so
 * the overlay closes after it and never takes the button out of the page before RSI sees the click.
 */

const EVENT = 'shm:ship-upgrade-opened';

/** After a click on a button that opens RSI's ship upgrade dialog. */
export function notifyShipUpgradeOpened(): void {
  setTimeout(() => window.dispatchEvent(new Event(EVENT)), 0);
}

/** Closes an overlay while it is open once RSI's ship upgrade dialog opens from it. */
export function useCloseOnShipUpgrade(close: () => void): void {
  onMounted(() => window.addEventListener(EVENT, close));
  onUnmounted(() => window.removeEventListener(EVENT, close));
}
