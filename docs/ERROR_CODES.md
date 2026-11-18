# Error codes

The error log in the settings ("Error log") lists the errors the Hangar Manager handled, each
with a code. The code says what didn't work and what the Hangar Manager did instead. Copy the
log into a bug report when an error keeps coming back (see below).

Each line of the log reads `<time> <code> <message>`, with `(×N)` when the same error happened
N times in a row. Below an entry, indented, it can show:

- `URL:` the full address the failed request asked for,
- the place in the code of an unexpected error (the first lines of its stack trace),
- `Outline:` how an entry of RSI's page was built that couldn't be read – tags, classes and
  attribute names, never texts or values,
- `↳` sub-errors: the errors that led to the entry, e.g. the larger pages that failed before a
  single pledge was found to break a buy back page. Their entry is marked with `►`: it is the one
  closest to the cause.

The codes are defined in `src/errors/codes.ts`.

## Reporting an error

In the settings under "Error log", click "Copy log" and paste it into a
[bug report](https://github.com/exrelax/star-citizen-hangar-manager/issues/new/choose). The copy
starts with the extension's version, the browser, the language and theme of the extension, and
whether the demo mode is on. It names the pledges an error is about – their title, kind and what
RSI says they contain – so we can find out together what is special about them. It holds no pledge
or order IDs (they read `<id>`), no name and no address.

## Refreshing

| Code                | What didn't work                                           | What the Hangar Manager did                                               | What you can do                                                               |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `SYNC-HANGAR-FAIL`  | Reading My Hangar stopped                                  | Kept the hangar of the last refresh; buy back and orders were read anyway | Refresh again; if it keeps failing, copy the error log into a bug report.     |
| `SYNC-BUYBACK-FAIL` | Reading the buy back stopped                               | Kept the buy back of the last refresh; hangar and orders were read anyway | Refresh again; if it keeps failing, copy the error log into a bug report.     |
| `SYNC-ORDERS-FAIL`  | Reading the order history stopped                          | Kept the orders of the last refresh; hangar and buy back are stored       | Refresh again later; refund tags and order details may be missing until then. |
| `SYNC-DATA-FAIL`    | Reading one storage again (settings, "Stored data") failed | Kept its last state                                                       | Read it again later.                                                          |
| `SYNC-UNEXPECTED`   | A refresh stopped with an unexpected error                 | Kept what was stored; the parts read before are stored                    | Copy the error log into a bug report.                                         |

## Smart updates

| Code                | What didn't work                                          | What the Hangar Manager did                                         | What you can do                              |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `SMART-CHECK-FAIL`  | A smart update check of the hangar or the buy back failed | Kept the stored list; the next check comes after the usual interval | Nothing; if it keeps failing, refresh fully. |
| `SMART-ORDERS-FAIL` | A smart update of the order history failed                | Kept the stored orders; hangar and buy back were checked anyway     | Nothing; the next check tries again.         |

## Buy back

| Code             | What didn't work                                                         | What the Hangar Manager did                                                 | What you can do                                                                               |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `BB-DETAIL-SKIP` | A buy back pledge's detail page couldn't be read during a refresh        | Kept the pledge without its items and price; read again on the next refresh | Nothing; open the pledge or refresh later to read it again.                                   |
| `BB-DETAIL-OPEN` | A buy back pledge's detail page couldn't be read when its row was opened | Left its items or price unknown; read again when it is opened next time     | Open the pledge again later.                                                                  |
| `BB-PAGE-SKIP`   | RSI failed to show a page of the buy back because of one pledge on it    | Read the page in smaller parts and left out only that pledge                | Nothing; the next refresh tries again. If it stays, report it: RSI fails to show that pledge. |
| `BB-LINKS-FAIL`  | FleetYards didn't answer for the links of the buy back's ships           | Kept the links known before; new ships have none until the next refresh     | Nothing; the next refresh tries again.                                                        |
| `BB-CART-FAIL`   | A buy back pledge couldn't be put into RSI's cart                        | Left the cart as it was and said why at the pledge                          | Try again, or buy it back on RSI's buy back page.                                             |

## My Hangar

| Code                      | What didn't work                                             | What the Hangar Manager did                                                      | What you can do                                                   |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `HANGAR-IMAGES-FAIL`      | The Ship Matrix didn't answer for the images of CCUs         | Stored the hangar; some CCUs show no ship image                                  | Nothing; the next refresh tries again.                            |
| `HANGAR-LINKS-FAIL`       | FleetYards didn't answer for the links of the hangar's ships | Kept the links known before; new ships have none until the next refresh          | Nothing; the next refresh tries again.                            |
| `HANGAR-EXCHANGE-FAIL`    | Melting (exchanging) a pledge failed at RSI                  | Nothing was melted; the dialog showed the reason                                 | Check the reason in the dialog (e.g. the password) and try again. |
| `HANGAR-GIFT-FAIL`        | Gifting a pledge failed at RSI                               | Nothing was gifted; the dialog showed the reason                                 | Check the reason in the dialog and try again.                     |
| `HANGAR-UPGRADE-LOG-FAIL` | A pledge's upgrade log couldn't be read                      | Showed the pledge without its applied upgrades; read again when opened next time | Open the pledge again later.                                      |

## Reading RSI's pages

| Code                   | What didn't work                                                                    | What the Hangar Manager did                           | What you can do                             |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| `PARSE-HANGAR-NO-ID`   | An entry of a My Hangar page had no pledge id                                       | Left the entry out                                    | Report it: RSI may have changed its page.   |
| `PARSE-BUYBACK-NO-ID`  | An entry of a buy back page had no pledge id                                        | Left the entry out                                    | Report it: RSI may have changed its page.   |
| `PARSE-ORDER-NO-ID`    | An entry of the billing list had no order id                                        | Left the order out; its pledges show no order details | Report it: RSI may have changed its page.   |
| `PARSE-UPGRADE-DIALOG` | RSI's ship upgrade dialog didn't have the target ship list the Hangar Manager knows | Showed no "Always available" labels in it             | Report it: RSI may have changed its dialog. |

## Orders

| Code              | What didn't work                    | What the Hangar Manager did           | What you can do             |
| ----------------- | ----------------------------------- | ------------------------------------- | --------------------------- |
| `ORDER-LOAD-FAIL` | An order's details couldn't be read | Showed the reason in the order dialog | Open the order again later. |

## Pledge Store and account

| Code                    | What didn't work                                                                     | What the Hangar Manager did                                       | What you can do                        |
| ----------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------- |
| `STORE-ITEMS-FAIL`      | The Pledge Store's items couldn't be read                                            | Kept the items of the last read; tried again on the next schedule | Nothing; the next read tries again.    |
| `STORE-UPGRADES-FAIL`   | RSI's ship upgrade tool (ships, warbond CCUs) couldn't be read                       | Kept the data of the last read; tried again on the next schedule  | Nothing; the next read tries again.    |
| `STORE-BACKGROUND-FAIL` | Reading the Pledge Store in the background (no RSI tab open) failed                  | Kept the data of the last read; tried again on the next schedule  | Nothing; the next read tries again.    |
| `STORE-CREDIT-FAIL`     | The account's store credit couldn't be read                                          | Kept the store credit of the last read                            | Nothing; the next refresh tries again. |
| `SHIP-MATRIX-FAIL`      | RSI's Ship Matrix (ship status) couldn't be read                                     | Kept the ship status of the last read                             | Nothing; the next read tries again.    |
| `SITE-DATA-FAIL`        | A data file of the project website (ships, events, price increases) couldn't be read | Kept the data of the last read; tried again on the next schedule  | Nothing; the next read tries again.    |

## Paint Discount Consultant

| Code                   | What didn't work                                        | What the Hangar Manager did                                  | What you can do                            |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `PAINT-CART-FAIL`      | The consultant's paints couldn't be put into RSI's cart | Left the cart as it was and said why                         | Check the reason shown and try again.      |
| `PAINT-CART-READ-FAIL` | RSI's cart couldn't be read for the running plan        | Showed the plan without the cart check; it can be read again | Read the cart again from the running plan. |
