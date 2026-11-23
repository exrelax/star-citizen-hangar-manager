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

## Versions

A storage's `version` is the format of its value (`HANGAR_SNAPSHOT_VERSION` and the like; `1` for
values without a version of their own). An import runs older values through the same checks and
migrations as an update of the extension (`src/storage/migrate.ts`).
