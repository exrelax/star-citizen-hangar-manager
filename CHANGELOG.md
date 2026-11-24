# Changelog

## [1.2.0] – 2026-11-24

Tools for planning a hangar: a CCU Check that tells which CCUs have a base ship to start from,
watchlists, ships leaving the Pledge Store, a grouped view and Export & Import. All features in
detail:
[docs/FEATURES.md](https://github.com/exrelax/star-citizen-hangar-manager/blob/main/docs/FEATURES.md).

### CCU Check

- A new tab **Tools** with the **CCU Check** and the Paint Discount Planner
- The **base ship coverage** of every CCU: covered by a ship or CCU in your hangar, only via your
  buy back, by a ship the store always sells, or not at all; on the CCU rows in My Hangar, as
  labels ("Base ship missing", "Base always available") and as a box in the sidebar
- A **simple view** with a card per base ship and the ways to it, and a **deep view** that follows
  whole CCU chains: how many ways your discounted CCUs need, which are missing, and what to buy
  to secure them, also through CCUs in your buy back
- **CCUs soon without base ship** when a ship leaves the store, and **CCUs losing their
  discount** before a price increase
- Counts of your ships and CCUs and the "Always available" label in **RSI's ship upgrade
  dialog**, with a countdown on target ships that are on sale for a short time only

### Pledge Store

- **All ships by value**: a table of every ship with its price, warbond price, price increases,
  ships leaving the store and your CCUs from and to it; sorting, search and filters that include or
  exclude
- **Ship Removals**: ships leaving the Pledge Store, with a countdown, the CCUs from and to them
  and a warning on CCUs in My Hangar that would lose their base ship
- The **expected end** of current warbond CCUs and their sorting, an "x from <ship>" badge, and
  a sortable "Your CCUs between" table with the discount in USD and percent
- **Ship upgrade** and **Warbond upgrade** buttons that open RSI's ship upgrade dialog with both
  ships chosen

### Watchlists

- **Watchlists** of pledges, buy back items and Pledge Store items, with a reminder date and
  notifications when a watched store item changes
- "Put on a watchlist" buttons on RSI's own store pages and in its ship upgrade dialog
- **Fill the cart** from a watchlist, and put the selection of My Hangar on a watchlist

### My Hangar and Buy Back

- A **grouped view**: equal pledges in one row with their sums, labels and a dialog
- **Filters you refine in their pill**: ships by kind, CCUs by base ship coverage and contents,
  paints by the ships you own
- **List shortcuts** like "Ready to melt", "Paints to optimize" and "Melt and rebuy"
- **Melt and Rebuy**: pledges you can melt and buy again at the same price, with a watchlist to
  rebuy them
- Ship packs at a glance, **select all**, mark the selection to melt, melt marks of a group
- Buy back tokens also at 0, with the date of their next renewal
- A paint discount note in **RSI's cart**

### Settings and safety

- **Export & Import** of your hangar (JSON, CSV, HangarXPLOR and FleetYards) and of your settings
  and own data, with a preview that merges an import with what you have
- **Paint plans and watchlists in the synced storage**, so they follow you to every browser of
  your profile; the stored data in groups, with the synced data and its limits
- **Account Safety**: a note on RSI's Terms of Service, a question before turning on bulk
  melting, a check of the pledges right before bulk melting, and a limit of how many pledges are
  melted at once
- The Settings tab as an icon; the tab Tools opens at `#hangar-manager-tools`

### Fixed

- The buy back is updated after an order in another tab
- Layout fixes in both themes: chevrons in an expanded group, the "Ship upgrade" button behind an
  overlay, a badge over a note in Classic RSI, tables and long texts in every language

## [1.1.1] – 2026-11-15

Reading the buy back no longer stops at a pledge RSI can't show, and a new error log tells what
went wrong when something can't be read.

### Fixed

- **Buy back**: a pledge or page RSI fails to show no longer stops reading the buy back. Failed
  requests are tried again, a page that keeps failing is read in smaller parts so only the pledge
  that breaks it is left out, and the list says how many were left out. Hangar and orders are read
  even if the buy back fails.
- **Firefox**: when the browser doesn't let the extension run on RSI's website – the Hangar
  Manager then doesn't show up at all –, the popup of the toolbar icon says so and allows it with
  one click; open RSI tabs load again.

### Added

- An **error log** in the settings: the last 500 errors the Hangar Manager handled, newest first,
  each with a code that says what didn't work and what it did instead (listed in
  [docs/ERROR_CODES.md](https://github.com/exrelax/star-citizen-hangar-manager/blob/main/docs/ERROR_CODES.md))
- **Copy the log** into a bug report: it names the pledges and pages an error is about, but holds
  no pledge or order IDs, no name and no address; the bug report form asks for it
- The status line says what failed during a refresh

### Also

- The README and the website explain Chrome's warning "not trusted by Enhanced Safe Browsing":
  it is about the new developer account, not the extension, and installing is safe

## [1.1.0] – 2026-11-13

Everything around the Pledge Store, in time for the Intergalactic Aerospace Expo: warbond CCUs,
price increases and a consultant for paint discounts. All features in detail:
[docs/FEATURES.md](https://github.com/exrelax/star-citizen-hangar-manager/blob/main/docs/FEATURES.md).

### Pledge Store

- A new **Pledge Store tab** with the current warbond CCUs: price, discount, the ships with the
  cheapest CCUs to them (and whether they are always available) and your own CCUs that can't be
  chained with them; opens RSI's upgrade dialog with both ships preselected
- **Warbond CCU History**: the warbond offers seen so far, with their events, by period, with
  search and sorting
- **Event notices** like the Intergalactic Aerospace Expo, with countdowns to the start, the next
  phase and the end

### Price increases

- **Buy Back Reminder**: buy back items whose price is expected to rise carry a label with a
  countdown, with a filter and a notification
- **Price Increase Advisor**: CCUs that lose or gain upgrade value when a ship's price rises are
  marked, with advice on how to keep the discount
- **CCUs to secure before a price increase**: the cheapest CCUs to each ship about to rise, also
  from your buy back for ships RSI sells no CCUs to

### Paint Discount Consultant

- Shows how to get **more store credit from your paints** with RSI's volume discount: which paints
  to melt and buy again, with cheap filler paints, on two ways – buy first or melt first
- **Start a plan** and follow it step by step: the cart, paying, melting; it checks the cart,
  the store credit and the prices along the way, and keeps the completed plans
- Paints worth buying again are marked in My Hangar

### My Hangar and Buy Back

- **Discounts for all kinds of pledges**, a "Discount" filter and **sorting** by date, value or
  discount; the values a filter or sorting is about are highlighted
- **Select pledges** and see their summary; **bulk melting** of the selection as an experimental
  setting
- **Mark pledges to melt later** and get told when RSI's 24 hours are over
- A lock tag for pledges RSI protects as your game access
- Buy back: the **buy back price** of each pledge, better images, pledges RSI can't sell again
  marked "Not available", a stricter "probably giftable" and more filters
- Store credit and buy back tokens above the refresh button

### Sidebar and notifications

- A **sidebar** with boxes to reorder: notifications, summary, selection and paint discount
- **Notifications** about pledges ready to melt, Pledge Store changes, events and price
  increases – in the sidebar and, only if you turn them on, as **browser notifications**, each
  kind on its own

### Under the hood

- **Smarter smart updates**: the pledge log names the pledges that changed, own actions on RSI's
  pages are noticed right away, the Pledge Store is read around the full hour; interval and spot
  checks are settings
- **Stored data** in the settings: everything that is stored, with size, last read and last
  check, and each part read again or deleted on its own
- The **settings** regrouped into sections; the status line shows what a refresh reads
- A **demo mode** with a generated hangar that shows every feature without your data
- The "Modern Hangar" theme refined, tooltips in the manager's own style, counts in the singular
  and plural

## [1.0.0] – 2026-11-05

The first release of Star Citizen Hangar Manager for Chrome and Firefox. All features in detail:
[docs/FEATURES.md](https://github.com/exrelax/star-citizen-hangar-manager/blob/main/docs/FEATURES.md).

- **Built for speed**: opens instantly from local data, searches thousands of pledges as you type
  and keeps itself up to date with smart updates that check a few RSI pages in the background
  instead of reading the whole hangar again
- **Private by design**: no account, no tracking, no server of its own; hangar, buy back and orders
  are stored only in your browser
- A **Hangar Manager** page in the RSI account navigation with your whole hangar and buy back,
  in the look of RSI's website or in its own "Modern Hangar" theme
- Search and filters that include or exclude: ships, CCUs, paints, game access, rewards, LTI,
  warbond, giftable, meltable, valuable
- Discounts compared to the original price, insurance tags and the full CCU history of upgraded
  ships
- Orders with invoices, refund countdown and a prefilled refund request
- Exchange (melt) and gift dialogs with notes on the pledge and its value
- Buy back with "probably giftable" hints, straight into the RSI cart
- Links to erkul.games and FleetYards.net, and from CCU Game (ccugame.app) to the manager
- Options to hide IDs, name, address and values for screenshots and streams, and a demo mode
- English, German, French and Spanish
