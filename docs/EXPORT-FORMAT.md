# Export format

The Star Citizen Hangar Manager exports two kinds of JSON files (#1): the **hangar export**
(#226) and the export of **settings and your data** (#229). Both are made in the browser only;
nothing is sent anywhere. This page describes them so other tools can read them.

## The frame

```json
{
  "format": "star-citizen-hangar-manager",
  "schemaVersion": 1,
  "kind": "hangar",
  "exportedAt": "2026-11-23T12:00:00.000Z",
  "extensionVersion": "1.2.0",
  "redacted": ["ids"],
  "partial": true,
  "storages": {
    "hangar": { "version": 3, "value": { "…": "…" } }
  }
}
```

- `format`: always `star-citizen-hangar-manager`.
- `schemaVersion`: the version of this frame. A reader should reject a higher one.
- `kind`: `hangar` or `settings`.
- `exportedAt`: the time of the export (ISO 8601, UTC); `extensionVersion`: the version that wrote
  it.
- `redacted` (optional): what was left out on request – `ids` (pledge and order ids; pledges are
  numbered from 1 instead, orders and gift flags are left out) and `amounts` (values, prices, the
  orders and the store credit). Such a file can't restore a hangar.
- `partial` (optional): only the pledges shown in My Hangar (its search and filters), without the
  buy back, the store credit and the gift flags.
- `storages`: each storage by its id in the registry (`src/storage/registry.ts`), with the format
  `version` of its value and the `value` itself, as the extension keeps it. A storage without data
  is left out. Readers should ignore storages they don't know.

## The hangar export (`kind: "hangar"`)

The storages with `transfer: 'hangar'` in the registry:

| Storage       | Value                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `hangar`      | `HangarSnapshot` (`src/hangar/pledge.ts`): `syncedAt`, `pledges` with their items, insurance, flags, value in USD, upgrades, `shipLinks` |
| `buyback`     | `BuybackSnapshot` (`src/buyback/buyback.ts`): the melted pledges with their items and buy back price, the buy back tokens                |
| `orders`      | `OrdersSnapshot` (`src/orders/orders.ts`): the order of each pledge (`pledgeOrders`) and the orders with what was paid                   |
| `storeCredit` | `StoreCreditSnapshot`: `credit.amount` and `credit.currency`                                                                             |
| `giftFlags`   | RSI's gift flag of each pledge that left the hangar, by pledge id (`{ "123456": true }`)                                                 |

Values are in USD where they are numbers (`valueUsd`, `price`); texts as RSI shows them
(`value`, `amount`) may be in another currency.

## CSV (#227)

The hangar export also comes as CSV for spreadsheets, made from the same file (the same pledges,
ids and amounts left out the same way): UTF-8 with a BOM, comma separated, lines ended by CRLF,
quoted where needed. A text starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a
leading `'`, so no spreadsheet runs it as a formula.

- **Hangar**: one row per pledge – `ID`, `Name`, `Items` (the item titles, separated by `; `),
  `Insurance` (`LTI` or `<n> months`, the best one), `Value (USD)`, `Giftable`, `Meltable`,
  `Upgraded` (`yes` or `no`), `Bought on` (`YYYY-MM-DD`), `Order`, `Paid` (as RSI shows it).
- **Buy back**, a file of its own: `ID`, `Name`, `Items`, `Melted on`, `Buy back price (USD)`.

The store credits are in the JSON only: a line above the table would break the header row that
spreadsheets sort and filter by.

## HangarXPLOR / FleetYards (#228)

For other tools the hangar export also comes in the format of
[HangarXPLOR](https://github.com/dolkensp/HangarXPLOR)'s `shiplist.json` and `shiplist.csv`, which
[FleetYards](https://fleetyards.net) imports: one entry per ship, not per pledge, with
`ship_code`, `ship_name`, `manufacturer_code`, `manufacturer_name`, `name`, `lti`, `warbond`,
`entity_type` (`ship`), `pledge_id`, `pledge_name`, `pledge_date` (`November 3, 2026`) and
`pledge_cost` (`$45.00 USD`). The CSV has HangarXPLOR's columns `Manufacturer`, `Ship`, `Lti`,
`Warbond`, `ID`, `Pledge`, `Cost`, `Date`.

- `name` and `ship_name`: the ship's name without its manufacturer in front; FleetYards finds the
  ship by it.
- `ship_code`: built like HangarXPLOR builds it, the manufacturer code and the name joined by `_`
  (`RSI_Aurora_Mk_I_ES`); no list of HangarXPLOR or FleetYards is taken over.
- Ships whose name isn't one of the ships RSI's upgrade tool lists are named after the export, as
  FleetYards may not find them. Modules and paints aren't written: they can't be told reliably.

## Settings and your data (`kind: "settings"`)

The storages with `transfer: 'settings'` and `transfer: 'yourData'` in the registry. `parts` says
which of the two the file holds (`["settings", "yourData"]` by default).

| Part       | Storage                   | Value                                                                      |
| ---------- | ------------------------- | -------------------------------------------------------------------------- |
| `settings` | `settings`                | The settings (`src/settings/settings.ts`); missing ones take their default |
|            | `notifications`           | The sidebar notifications, with those checked off                          |
|            | `dismissedPaints`         | SKUs of the paints whose note was closed                                   |
|            | `riskNoteSeen`            | Whether the Terms of Service note was closed                               |
|            | `dismissedPriceIncreases` | Price increases whose notification was closed                              |
|            | `dismissedPriceAdvisor`   | Price Increase Advisor notifications closed                                |
|            | `dismissedShipRemovals`   | Ship removal notifications closed                                          |
|            | `browserHintDismissed`    | Whether the hint to allow browser notifications was closed                 |
| `yourData` | `warbondHistory`          | The warbond offers this browser saw (`WarbondHistorySnapshot`)             |
|            | `paintPlan`               | The running plan of the Paint Discount Planner, or `null`                  |
|            | `paintHistory`            | Its completed plans (`CompletedPlansSnapshot`), newest first               |
|            | `watchlists`              | The watchlists with their items (`Watchlist[]`)                            |
|            | `meltMarks`               | When each pledge was marked to melt (ms), by pledge id                     |

Most of them live in the browser's synced storage. They are written decoded – the watchlists as
a list, the completed paint plans of the synced storage and of this browser together –, not in the
compact per-key format of the synced storage, so a file doesn't depend on how the synced storage
splits the data. Nothing of the account is in this file.

## Import of settings and your data (#230)

- A file is read only if `format` is ours, `schemaVersion` isn't newer and `kind` fits; storages
  this version doesn't know are ignored and named.
- Each storage goes through the same checks as a stored value of an earlier version (the
  settings' defaults, the plan's versions, the codecs of the synced storage); one that can't be
  read is named and left out.
- The settings and their decisions are replaced; your data is replaced or merged (#634).
- Everything for the synced storage is measured together against its limits (100 KB in all,
  8 KB per key, 512 keys) before anything is written; completed paint plans give way and stay in
  this browser. A write that fails puts everything back.
- The permission for browser notifications belongs to the browser and isn't in the file.

## Versions

A storage's `version` is the format of its value (`HANGAR_SNAPSHOT_VERSION` and the like; `1` for
values without a version of their own). An import runs older values through the same checks and
migrations as an update of the extension (`src/storage/migrate.ts`).
