# SC Hangar Manager – Features

SC Hangar Manager is a browser extension for Chrome and Firefox that turns the Star Citizen hangar
on [robertsspaceindustries.com](https://robertsspaceindustries.com) into a fast, searchable
overview. **Speed is what sets it apart**: it opens instantly, searches thousands of pledges as you
type, and keeps itself up to date in the background with a handful of requests instead of
re-reading the whole hangar – without ever blocking you. **And it is private**: your hangar data
never leaves your browser.

It adds a **Hangar Manager** page to the RSI account navigation – right on the RSI website, with
its look and feel. Everything is read with your own RSI session and stored locally in your
browser.

This document briefly explains every feature. It is the basis for store listings and
announcements.

---

## Tech stack

- **[WXT](https://wxt.dev)** – framework for cross-browser extensions: one code base, built as
  Manifest V3 for **Chrome and Firefox** today, with more browsers possible
- **[Vite](https://vite.dev)** – fast builds and hot reload during development
- **[Vue 3](https://vuejs.org)** – the manager's interface, integrated into RSI's own pages
- **TypeScript** – typed throughout
- **Vitest** – unit and component tests, plus ESLint and Prettier for consistent code
- **No runtime dependencies besides Vue** – no tracking, analytics or third-party SDKs

---

## At a glance

- **Built for speed**: opens instantly from local data, searches as you type, and checks your
  hangar for changes in under a second – in the background, while you keep working
- **Private by design**: no account, no tracking, no server of its own – your hangar, orders and
  pledge IDs stay in your browser; options to hide IDs, name, address and values for screenshots
  and streams
- Your whole hangar and buy back on one page, instead of RSI's 10 pledges per page
- Instant search and filters that include or exclude (ships, CCUs, paints, LTI, warbond, giftable,
  meltable, valuable, rewards, …)
- Discounts of ships and CCUs compared to their original price
- The best insurance of every pledge as a tag (LTI, 10 years, …)
- The full CCU history of upgraded ships, with the discount of every step
- Orders of your purchases with invoices, refund countdown and a prefilled refund request
- Buy back pledges straight into the RSI cart
- Links from CCU Game (ccugame.app) straight to the pledge in the Hangar Manager
- An addition to RSI's website: "My Gear" and "Buy Back Pledges" stay untouched and usable
- A demo mode with anonymized data for screenshots
- English, German and French

---

## Built for speed

Performance is the core of the extension. RSI shows 10 pledges per page; a large hangar has
hundreds of pages, and a buy back thousands of pledges. The manager is designed so that size
doesn't matter.

### Instant start

The manager shows your pledges right away from the browser's local storage – no waiting for RSI.
Switching between the manager and RSI's own pages doesn't reload anything.

### Smart updates: a few pages instead of all

A full refresh reads every page of the hangar and buy back – for a hangar of ~1,000 pledges and a
buy back of ~4,000 that takes 15–20 seconds. Smart updates find changes with a fraction of that:

- **A handful of pages per check**: the first page (new purchases), the last page – together they
  show whether pledges were added or removed anywhere – and two rotating spot-check pages (one in
  the much larger buy back), which cover the whole hangar over time.
- **Exact, not guessed**: RSI lists pledges strictly by ID, newest first. So every page covers a
  closed range of pledge IDs, and comparing it with the stored pledges of that range shows exactly
  what was added, removed or changed. If the number of pledges between two checked pages differs,
  the page in the middle is checked next (binary search) until the change is found.
- **Follows the consequences**: an applied CCU disappears and changes another pledge, which is
  refreshed as well; new orders and their refund periods are picked up from the first page of the
  pledge log and billing history.
- **Measured**: an unchanged hangar of ~1,000 pledges is checked in 0.4–0.7 seconds, the buy back of
  ~4,000 pledges in 1–3 seconds.
- **Only when useful**: at most every 5 minutes, and right away when you come back from RSI's "My
  Gear" page, where you may just have melted or gifted something. If too much changed, it suggests
  a full refresh instead of loading page after page.

### Never in your way

Smart updates and refreshes run in the background. While they read RSI's pages you can search,
filter, open pledges and switch tabs as usual; the list updates itself when new data arrives. A
status line tells you what happened ("Up to date · checked 2 min ago", "Updated 1 min ago: 1 new,
0 removed, 0 changed").

### Fast with thousands of pledges

- **Search and filters as you type**: every pledge's searchable text is prepared once, so each
  keystroke only compares short strings – instantly, also for thousands of pledges.
- **Rows are drawn while you scroll**, in small steps between frames, so scrolling stays smooth and
  a search never waits for thousands of rows to render.
- **Details on demand**: the CCU history and order details are loaded only when you open them.

### Gentle on RSI

Only a few requests run at a time, and RSI's own throttling is respected: when RSI asks to slow
down while orders are read, the extension waits and tries again. After the first full refresh,
orders are read only as far as there is something new – usually a single page.

---

## Private by design

Your hangar is nobody else's business. The extension is built so that your data stays with you.

### Your data stays in your browser

- **No server of its own, no account, no tracking, no analytics.** There is nothing to sign up for
  and nothing that reports back.
- **Everything is stored locally** in your browser's extension storage: hangar, buy back, orders
  and ship prices. It never leaves your computer, and removing the extension removes it. The CCU
  history is not even stored – it is loaded from RSI when you open it.
- **Only RSI, with your own login**: pledges, orders and prices are read from RSI's website with
  the session you are already logged in with. The extension never sees or stores your password.
- **The one exception: ship links.** To link your ships to FleetYards.net and erkul.games, the
  extension asks FleetYards' public API for the matching ship pages. It sends nothing but ship
  model names (e.g. "polaris") – no pledge data, no IDs, no login, no cookies. Turn both ship
  links off in the settings, and the extension talks to RSI only. The icons of both sites are part
  of the extension, so showing the links doesn't contact them.

### Only your settings sync – through your browser

Your settings (language, display options, …) are saved in the browser's sync storage, so they
follow you to your other devices if you use a browser account (Google account in Chrome, Firefox
account in Firefox). That is your browser's own sync; the extension has no server for it. Your
hangar data is never synced.

### It acts only when you click

Nothing is bought, gifted, melted or submitted on its own. Smart updates only read. Adding to the
cart, opening an invoice or a refund request always takes your click – and a refund request opens
RSI's form for you to review and send yourself.

### Anonymization for content creators

Sharing your hangar in a screenshot, a stream or a video? The settings group **Hide sensitive
information (for screenshots or content creators)** keeps private details off screen:

- **Hide pledge and order IDs, name and address**: hides every pledge and order ID – also those
  of applied upgrades and in the order details – and blurs your name and billing address in the
  order details. The real name and address don't even reach the page then, only a placeholder of
  the same shape. Searching by ID still works.
- **Hide melt value**: hides all amounts – pledge values, discounts, upgrade costs, amounts paid
  and the amounts in the order details.
- **Demo mode**: shows a fixed selection of 100 hangar and 50 buy back pledges with made-up pledge
  and order IDs (e.g. `99FE3X712`). Order details show a dummy billing address and payment
  provider instead of the real ones; links to RSI, the cart, invoices and refund requests are
  disabled. A **Demo** badge shows on every tab. The made-up IDs are derived from a random key
  that exists only in your browser, so they can't be traced back to the real ones.

---

## The Hangar Manager page

A new **Hangar Manager** entry at the top of the RSI account navigation opens the manager.
Switching between the manager and the original RSI pages is instant – no page reload. The manager
has three tabs, each with its own link to bookmark or share:

- **My Hangar** – all pledges of your hangar
- **Buy Back** – all pledges you melted and can buy back
- **Settings**

### An addition, not a replacement

The Hangar Manager adds to the RSI website – it doesn't take anything away. RSI's own **My Gear**
and **Buy Back Pledges** pages stay exactly as they are and remain fully usable, with all of RSI's
functions (gift, melt, apply upgrades, buy back, …): one click on their entry in the account
navigation, and you are back on RSI's original page. The extension doesn't overwrite or change
any area of the RSI website: it adds its own navigation entry, shows the manager in the content
area only while you have it open, and highlights a pledge on RSI's lists when you opened it via
"Show in My Gear" or "Show in Buy Back".

### Compact, expandable rows

Every pledge is one compact row: image, title, pledge ID, value, purchase date and tags. A click
opens the row with everything RSI knows about the pledge: the contained items (ships, insurances,
paints, …), the ships of a CCU and further details. If a search leaves only one pledge, it opens
on its own.

- **Upgraded ships show what they are now**: after a CCU, the row shows the current ship with its
  image, and the original pledge name below it ("Originally: …").
- **CCUs show their target ship** as image.

### Tags

- **Insurance**: the best insurance of the pledge – `LTI`, or the duration such as `10 years` or
  `6 months` (months are shown as years when they add up to whole years). A pledge can contain
  several insurances, but only the best one counts – so only that one is shown. CCUs show the
  insurance they bring.
- **Upgraded**, **Gift** and **Melt** show at a glance whether a CCU was applied and whether the
  pledge can be gifted or melted.
- **Refund countdown** (see [Orders](#orders-invoices-and-refunds)).

---

## Search and filters

- **Live search** as you type – by title, ship name, pledge ID or order ID. Words are matched at
  their start, so `f8c` finds the "F8C Lightning".
- The search is part of the URL (`?search=…`): searches can be bookmarked or shared, and other
  tools can link to a pledge.
- **Filters** in two groups:
  - **Types** – what a pledge is: Ships, CCUs, Paints, Game access (game packages and other
    pledges that contain the game) and Rewards (Concierge, event and referral rewards).
  - **Features** – what it has: LTI, Warbond (bought with money, i.e. with an order ID),
    Giftable, Meltable and Valuable (worth more than $0).
- **Include or exclude**: each click on a filter cycles through off → only pledges with it →
  only pledges without it ("−Rewards" hides all rewards). All active filters combine with "and";
  one click on "Reset filters" turns them all off.
- **Live counts**: each filter shows how many pledges it would leave in combination with the
  other active filters – a filter showing 0 would empty the list.
- Thousands of pledges stay fast: rows are drawn while scrolling, in small steps between frames.

---

## Discounts

For ships and CCUs, the row shows the **discount compared to the original price** – in dollars and
percent, e.g. `−$25 (62.5%)` – right next to the pledge value. The original prices come from RSI's
own ship upgrade tool ("All ships"):

- **CCUs** are compared with the price difference of their two ships.
- **Ship pledges** are compared with the price of the ship.
- A tooltip explains the calculation, e.g. "Constellation Mk V Centaurus $300 − Guardian QI
  $260 = $40".
- If a pledge cost more than the original price, the difference is shown in orange.

---

## Applied upgrades (CCU history)

Upgraded ships get an extra section **Applied upgrades** in their opened row: the full chain of
CCUs that were applied to the pledge, oldest first, loaded from RSI on demand. Every step shows:

- the date it was applied and the CCU with its pledge ID,
- the original price of the target ship,
- the pledge value afterwards,
- what the step really cost (orange) and its discount compared to the original price
  difference (green).

---

## Orders, invoices and refunds

The extension links your pledges to the **orders** they were bought with (from RSI's pledge log
and billing history). For pledges paid with money (not store credit), the opened row shows the
order – e.g. "Order #… · paid €20.71 EUR · 2026-09-30" – and marks pledges that were bought back.
For upgraded ships it is labelled **Base Order**: the order of the original pledge.

- **Order details**: a click on the order ID opens an overlay with everything RSI's billing page
  shows for it – items, totals, credits used, VAT, billing address and payments.
- **Retrieve invoice** opens RSI's invoice of the order.
- **Refund countdown**: CIG refunds purchases paid with money within 30 days. Such pledges get a
  tag with the days left (e.g. `Refund: 26 days`), highlighted in the last week.
- **Refund Request**: a button in the order details opens RSI's support form in a new tab, already
  filled in for a refund of the order – category, subject and message included. You only review
  and send it.

The first refresh reads the whole pledge log once; after that only new entries are read.

---

## Exchange (melt) with a safety net

**Exchange** under the image of a pledge opens RSI's exchange dialog of "My Gear" in the
manager's design – with RSI's texts, its two acknowledgements and your password, sent to RSI
only. On top, the dialog makes clear what you are about to give up:

- **What and how much** up front: the kind of pledge (ship, ship with applied upgrades, CCU,
  paint, game package, …) and the store credit you receive.
- **Warnings** for what can't be undone: applied upgrades, the discount you give up (e.g.
  "$705 (72.3 %)" with original price and pledge value), no buy back, the last pledge with game
  access (with RSI's waiting time before you can continue). Notices for giftable pledges and a
  refund period that still runs – a refund pays back money instead of store credit.
- With any of these warnings, an **extra acknowledgement** is needed before the button
  "Exchange for $…" is enabled.

## Gift

**Gift** under "Exchange" (for giftable pledges) opens RSI's gift dialog of "My Gear" in the
manager's design: RSI's texts, recipient name and email, and your password, sent to RSI only.
The pledge is shown up front with its kind and value, notices tell when it is your last pledge
with game access or carries applied upgrades, and the email address is entered twice, so a typo
doesn't send your gift to someone else. Until it is claimed, the gift can be cancelled in
"My Gear".

## Buy back

The **Buy Back** tab lists all melted pledges with the same search and filters (Ships, CCUs,
Paints, Game access, LTI, Warbond, Probably giftable, Rewards), plus:

- **Probably giftable**: pledges bought before 30 Oct 2026 are probably giftable again when bought
  back with money (warbond).
- **Add to cart**: one click puts a buy back pledge – or a buy back CCU – into the RSI cart and
  opens it, without going through RSI's pages.
- **Show in Buy Back**: opens the pledge on RSI's own buy back page (only this pledge, or the list
  page with the pledge highlighted).
- Insurances, ships and orders as in "My Hangar".

---

## Links to RSI and other sites

- **Show in My Gear / Show in Buy Back**: opens the pledge on RSI's original page, scrolled to it
  and highlighted – also when it moved to another page in the meantime.
- **External links**: ships link to their pages on **erkul.games** and **FleetYards.net** (can be
  turned off in the settings).
- **CCU Game** (ccugame.app): in CCU Game's detail view of an item (ships, CCUs, paints, equipment
  and more), the extension adds a link **"Open in Hangar Manager"** right below CCU Game's link to
  RSI. It opens the pledge directly in the Hangar Manager – found by its pledge ID and opened –
  for hangar items in "My Hangar", for buy back items in "Buy Back" (placed right before CCU
  Game's "Add to cart on RSI").

---

## Keeping the data current

- **First start**: when no pledges are stored yet, opening the manager starts the first refresh
  by itself.
- **Refresh** reads hangar, buy back and orders from RSI. Large hangars take a moment; a progress
  bar shows pages and percentage, weighted by how long each kind of page takes.
- **Smart updates** (on by default): check a few RSI pages for changes and update the list
  without a full refresh – see [Built for speed](#built-for-speed).
- Requests are gentle on RSI's servers – see [Gentle on RSI](#gentle-on-rsi).

---

## Settings

- **Language**: automatic, English, German or French.
- **Show only the best insurance of upgraded ships** (on by default): after upgrades a pledge lists
  the insurance of every step; only the one that counts (LTI, otherwise the most months) is listed.
- **Hide sensitive information**: see [Private by design](#private-by-design).
- **Theme**: Default RSI or Modern Hangar.
- **Smart updates**: on or off.
- **Show refund period**: refund countdown and "Refund Request" button (on by default).
- **Filters**: order and selection of the filter buttons, separately for My Hangar and Buy Back
  and for types and features – drag a filter (or use its arrows) to move it within its group,
  uncheck it to hide its button.
- **"Show in Buy Back" opens**: only the pledge, or the list page with the pledge highlighted.
- **Show links for ships**: erkul.games and FleetYards.net, each on or off.

Settings follow your browser profile to your other devices (see
[Private by design](#private-by-design)).
