# Changelog

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
