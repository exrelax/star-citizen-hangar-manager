import { SMART_UPDATE } from '@/config';
import { resetBackoff } from './backoff';

/*
 * A purchase in RSI's store (#328): the order confirmation page is an own action like melting or
 * gifting (#124), but RSI lists the bought pledge in "My Gear" (or takes it from the buy back) a
 * little later than it confirms the order – often only after two or three reloads. Its pages are
 * sent with `Cache-Control: no-store` (November 2026), so it isn't the browser's cache: RSI
 * fulfills the order after confirming it, and the order history and the pledge log may show it
 * before "My Gear" does.
 *
 * So the confirmation opens a window (`SMART_UPDATE.afterPurchase`): its first check runs at
 * once, the next ones at a short interval, until a check finds a change in the hangar or the buy
 * back or the window ends; then the set interval applies again. As every check, they only run
 * while a tab shows the Hangar Manager or "My Gear". Only the page is observed; nothing is clicked
 * or sent on RSI's pages.
 *
 * As a fallback, in case the confirmation page wasn't seen (closed early, another path of RSI's
 * checkout), opening the cart from the Hangar Manager is remembered: the tab checks once when it
 * is shown again.
 */

/** RSI's order confirmation page, optionally with a locale prefix: "/en/store/pledge/cart/confirm/<order>/hangar". */
const CONFIRMATION_PATH =
  /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?store\/pledge\/cart\/confirm\/([^/?#]+)/i;

/** The order of RSI's confirmation page at `path`, or `undefined` for any other page. */
export const orderOfConfirmationPath = (path: string): string | undefined =>
  CONFIRMATION_PATH.exec(path)?.[1];

interface Purchase {
  /** When its confirmation page was seen (epoch ms). */
  at: number;
  /** RSI's order, so a reload of its confirmation page doesn't open the window again. */
  order: string;
  /** A check found the change, so the window is closed early. */
  done?: boolean;
}

const purchaseItem = storage.defineItem<Purchase | null>('local:smartUpdate.purchase', {
  fallback: null,
});
/** When the Hangar Manager opened RSI's cart (epoch ms), until a tab checked for it. */
const cartOpenedItem = storage.defineItem<number | null>('local:smartUpdate.cartOpenedAt', {
  fallback: null,
});

/** The confirmation of `order` was seen: opens the window, once per order. */
export async function rememberPurchase(order: string, now = Date.now()): Promise<void> {
  await cartOpenedItem.removeValue();
  if ((await purchaseItem.getValue())?.order === order) return;
  await purchaseItem.setValue({ at: now, order });
  await resetBackoff();
}

/** When the purchase of the open window was confirmed (epoch ms), or `undefined` without one. */
export async function purchaseWindowStart(now = Date.now()): Promise<number | undefined> {
  const purchase = await purchaseItem.getValue();
  if (!purchase || purchase.done) return undefined;
  return now - purchase.at < SMART_UPDATE.afterPurchase.windowMs ? purchase.at : undefined;
}

/** A check found the change in the hangar or the buy back: the set interval applies again. */
export async function endPurchaseWindow(): Promise<void> {
  const purchase = await purchaseItem.getValue();
  if (purchase && !purchase.done) await purchaseItem.setValue({ ...purchase, done: true });
}

/**
 * Whether a check is due within the window: none ran since the confirmation (`purchaseAt`), or the
 * last one is at least `SMART_UPDATE.afterPurchase.intervalMs` old.
 */
export const isPurchaseCheckDue = ({
  checkedAt,
  purchaseAt,
  now,
}: {
  checkedAt: number;
  purchaseAt: number;
  now: number;
}) => checkedAt < purchaseAt || now - checkedAt >= SMART_UPDATE.afterPurchase.intervalMs;

/** The Hangar Manager opened RSI's cart for a purchase (the fallback). */
export const rememberCartOpened = (now = Date.now()) => cartOpenedItem.setValue(now);

/**
 * Whether the cart was opened at most `SMART_UPDATE.afterPurchase.cartMaxAgeMs` ago and no
 * confirmation was seen since; it is taken, so only one check runs for it.
 */
export async function takeCartOpened(now = Date.now()): Promise<boolean> {
  const at = await cartOpenedItem.getValue();
  if (at === null) return false;
  await cartOpenedItem.removeValue();
  return now - at <= SMART_UPDATE.afterPurchase.cartMaxAgeMs;
}
