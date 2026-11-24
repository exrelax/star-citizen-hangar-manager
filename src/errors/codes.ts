/*
 * The error codes of the error log (#341): each names what didn't work and what the Hangar Manager
 * did instead, as `AREA-WHAT`. Documented for users in `docs/ERROR_CODES.md` – a test checks that
 * every code is there.
 */

export interface ErrorCodeInfo {
  /** What didn't work. */
  failed: string;
  /** What the Hangar Manager did instead. */
  instead: string;
}

export const ERROR_CODES = {
  // A refresh of everything ("Refresh" button, initial load) or of one storage (settings).
  'SYNC-HANGAR-FAIL': {
    failed: 'Reading My Hangar stopped',
    instead: 'Kept the hangar of the last refresh; buy back and orders were read anyway',
  },
  'SYNC-BUYBACK-FAIL': {
    failed: 'Reading the buy back stopped',
    instead: 'Kept the buy back of the last refresh; hangar and orders were read anyway',
  },
  'SYNC-ORDERS-FAIL': {
    failed: 'Reading the order history stopped',
    instead: 'Kept the orders of the last refresh; hangar and buy back are stored',
  },
  'SYNC-DATA-FAIL': {
    failed: 'Reading one storage again (settings, "Stored data") failed',
    instead: 'Kept its last state',
  },
  'SYNC-UNEXPECTED': {
    failed: 'A refresh stopped with an unexpected error',
    instead: 'Kept what was stored; the parts read before are stored',
  },
  // Smart updates.
  'SMART-CHECK-FAIL': {
    failed: 'A smart update check of the hangar or the buy back failed',
    instead: 'Kept the stored list; the next check comes after the usual interval',
  },
  'SMART-ORDERS-FAIL': {
    failed: 'A smart update of the order history failed',
    instead: 'Kept the stored orders; hangar and buy back were checked anyway',
  },
  // Buy back.
  'BB-DETAIL-SKIP': {
    failed: "A buy back pledge's detail page couldn't be read during a refresh",
    instead: 'Kept the pledge without its items and price; read again on the next refresh',
  },
  'BB-DETAIL-OPEN': {
    failed: "A buy back pledge's detail page couldn't be read when its row was opened",
    instead: 'Left its items or price unknown; read again when it is opened next time',
  },
  'BB-PAGE-SKIP': {
    failed: 'RSI failed to show a page of the buy back because of one pledge on it',
    instead: 'Read the page in smaller parts and left out only that pledge',
  },
  'BB-LINKS-FAIL': {
    failed: "FleetYards didn't answer for the links of the buy back's ships",
    instead: 'Kept the links known before; new ships have none until the next refresh',
  },
  'BB-CART-FAIL': {
    failed: "A buy back pledge couldn't be put into RSI's cart",
    instead: 'Left the cart as it was and said why at the pledge',
  },
  // My Hangar.
  'HANGAR-IMAGES-FAIL': {
    failed: "The Ship Matrix didn't answer for the images of CCUs",
    instead: 'Stored the hangar; some CCUs show no ship image',
  },
  'HANGAR-LINKS-FAIL': {
    failed: "FleetYards didn't answer for the links of the hangar's ships",
    instead: 'Kept the links known before; new ships have none until the next refresh',
  },
  'HANGAR-EXCHANGE-FAIL': {
    failed: 'Melting (exchanging) a pledge failed at RSI',
    instead: 'Nothing was melted; the dialog showed the reason',
  },
  'HANGAR-EXCHANGE-CHECK-FAIL': {
    failed: "The pledges to melt couldn't be read from RSI again right before melting",
    instead: 'Nothing was melted; the dialog showed the reason',
  },
  'HANGAR-GIFT-FAIL': {
    failed: 'Gifting a pledge failed at RSI',
    instead: 'Nothing was gifted; the dialog showed the reason',
  },
  'HANGAR-UPGRADE-LOG-FAIL': {
    failed: "A pledge's upgrade log couldn't be read",
    instead: 'Showed the pledge without its applied upgrades; read again when opened next time',
  },
  // Reading RSI's pages.
  'PARSE-HANGAR-NO-ID': {
    failed: 'An entry of a My Hangar page had no pledge id',
    instead: 'Left the entry out',
  },
  'PARSE-BUYBACK-NO-ID': {
    failed: 'An entry of a buy back page had no pledge id',
    instead: 'Left the entry out',
  },
  'PARSE-UPGRADE-DIALOG': {
    failed: "RSI's ship upgrade dialog didn't have the target ship list the Hangar Manager knows",
    instead: 'Showed no "Always available" labels in it',
  },
  'PARSE-ORDER-NO-ID': {
    failed: 'An entry of the billing list had no order id',
    instead: 'Left the order out; its pledges show no order details',
  },
  // Orders.
  'ORDER-LOAD-FAIL': {
    failed: "An order's details couldn't be read",
    instead: 'Showed the reason in the order dialog',
  },
  // Pledge Store, account and website data.
  'STORE-ITEMS-FAIL': {
    failed: "The Pledge Store's items couldn't be read",
    instead: 'Kept the items of the last read; tried again on the next schedule',
  },
  'STORE-UPGRADES-FAIL': {
    failed: "RSI's ship upgrade tool (ships, warbond CCUs) couldn't be read",
    instead: 'Kept the data of the last read; tried again on the next schedule',
  },
  'STORE-BACKGROUND-FAIL': {
    failed: 'Reading the Pledge Store in the background (no RSI tab open) failed',
    instead: 'Kept the data of the last read; tried again on the next schedule',
  },
  'STORE-CREDIT-FAIL': {
    failed: "The account's store credit couldn't be read",
    instead: 'Kept the store credit of the last read',
  },
  'SHIP-MATRIX-FAIL': {
    failed: "RSI's Ship Matrix (ship status) couldn't be read",
    instead: 'Kept the ship status of the last read',
  },
  'SITE-DATA-FAIL': {
    failed: "A data file of the project website (ships, events, price increases) couldn't be read",
    instead: 'Kept the data of the last read; tried again on the next schedule',
  },
  // Paint Discount Consultant.
  'PAINT-CART-FAIL': {
    failed: "The consultant's paints couldn't be put into RSI's cart",
    instead: 'Left the cart as it was and said why',
  },
  'PAINT-CART-READ-FAIL': {
    failed: "RSI's cart couldn't be read for the running plan",
    instead: 'Showed the plan without the cart check; it can be read again',
  },
  'PAINT-PLAN-MOVE-FAIL': {
    failed: "The paint plans of an earlier version couldn't be moved to the synced storage",
    instead: 'Kept them in this browser, where they are still shown; tried again on the next start',
  },
  // Watchlists.
  'WATCHLIST-CART-FAIL': {
    failed: "A watchlist's Pledge Store items couldn't all be put into RSI's cart",
    instead: 'Put in the others, left the cart as it was otherwise and said why',
  },
  'WATCHLIST-RSI-PAGE-FAIL': {
    failed: "A page of RSI's website lacked what the watchlist button needs",
    instead: 'Showed no watchlist button there',
  },
} as const satisfies Record<string, ErrorCodeInfo>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** The code of a storage's failed refresh. */
export function syncFailCode(storage: string): ErrorCode {
  if (storage === 'hangar') return 'SYNC-HANGAR-FAIL';
  if (storage === 'buyback') return 'SYNC-BUYBACK-FAIL';
  if (storage === 'orders') return 'SYNC-ORDERS-FAIL';
  return 'SYNC-DATA-FAIL';
}
