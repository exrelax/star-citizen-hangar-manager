# Star Citizen Hangar Manager – Features

Star Citizen Hangar Manager is a browser extension for Chrome and Firefox that turns the Star Citizen hangar
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

## At a glance

- **Built for speed**: opens instantly from local data, searches as you type, and checks your
  hangar for changes in under a second – in the background, while you keep working
- **Private by design**: no account, no tracking, no server of its own – your hangar, orders and
  pledge IDs stay in your browser; options to hide IDs, name, address and values for screenshots
  and streams
- Your whole hangar and buy back on one page, instead of RSI's 10 pledges per page
- Instant search and filters that include or exclude (ships, CCUs, paints, LTI, warbond, giftable,
  meltable, valuable, discount, rewards, …), sorting by date, value or discount
- Discounts compared to the original price: ships and CCUs, paints, gear, packs and more
- The best insurance of every pledge as a tag (LTI, 10 years, …)
- The full CCU history of upgraded ships, with the discount of every step
- Orders of your purchases with invoices, refund countdown and a prefilled refund request
- Buy back pledges straight into the RSI cart
- A Paint Discount Consultant: more store credit from your paints with RSI's volume discount
- The current warbond CCUs of the pledge store, with the cheapest ships to start from and your own
  CCUs in the same price range
- Links from CCU Game (ccugame.app) straight to the pledge in the Hangar Manager
- An addition to RSI's website: "My Gear" and "Buy Back Pledges" stay untouched and usable
- Transparent storage: the settings list everything that is stored, with size and the time of the
  last read and check, and read again or delete each part on its own
- A demo mode with anonymized data for screenshots
- English, German, French and Spanish

---

## Built for speed

Performance is the core of the extension. RSI shows 10 pledges per page; a large hangar has
hundreds of pages, and a buy back thousands of pledges. The manager is designed so that size
doesn't matter.

### Instant start

The manager shows your pledges right away from the browser's local storage – no waiting for RSI.
Switching between the manager and RSI's own pages doesn't reload anything.

### Smart updates: a few pages instead of all

Reading everything from RSI – every page of the hangar and buy back, plus the orders – takes
about **20 seconds for 1,000 pledges** and about **1.5 minutes for 5,000 pledges** (hangar and buy
back together; the times the manager shows before the first load). Smart updates find changes with
a fraction of that:

Each check works in three steps:

1. **The pledge log first**: RSI lists every action on your account in its pledge log – newest
   first, by the time of the action, also for old pledges. Its first page shows whether anything
   happened since the last check and which pledges it was about (bought, melted, bought back,
   upgraded, gift claimed, …). It also brings in new orders and their refund periods.
2. **Then the buy back**: its first and last page and the pages of the pledges named by the log,
   all with small pages of 10 pledges (~80 KB instead of ~1 MB for RSI's 250), and one rotating
   spot-check page in full size. A pledge new in the buy back was melted, so it has to be gone
   from the hangar.
3. **Then the hangar**: its first and last page, two rotating spot-check pages (a setting, up to 10) and the pages of the pledges named by the log and of those just melted.

- **Exact, not guessed**: RSI lists pledges strictly by ID, newest first. So every page covers a
  closed range of pledge IDs, and comparing it with the stored pledges of that range shows exactly
  what was added, removed or changed. If the number of pledges between two checked pages differs,
  the page in the middle is checked next (binary search) until the change is found.
- **How reliable**: added or removed pledges – a purchase, a melt, a buy back, a gift sent or
  claimed, an applied CCU – are found by the next check, by the pledge log and by the number of
  pledges. A change within a pledge that RSI makes without a log entry (new items, gift status, a
  ship's name) is found by the spot checks only: with 2 of ~100 hangar pages in about 4 % of the
  checks, and for sure once they have gone through all pages (the settings show how long that
  takes for your hangar). The refresh button always reads everything.
- **Follows the consequences**: an applied CCU disappears and changes another pledge, which is
  refreshed as well.
- **Measured**: an unchanged hangar of ~1,000 pledges is checked in 0.4–0.7 seconds, the buy back of
  ~4,000 pledges in under 2 seconds with about 1.2 MB (3 MB before the small pages).
- **Regular, but only when useful**: every 5 minutes (a setting; longer while nothing happens, see
  below) while the manager is open in a visible tab – it looks 10 seconds after its last look, once any check is done, whether the
  interval has passed (only a look into the stored data, no request to RSI) – and right away when
  you come back from RSI's "My Gear" page, where you may just have melted or gifted something. A
  hidden tab sends no requests and checks when it is shown again. Several open tabs check only
  once per interval together. If too much changed, it suggests a full refresh instead of loading
  page after page.
- **Slower when nothing happens**: while checks find nothing and nobody uses the tab, the interval
  doubles after each check – 5, 10, then 20 minutes at most (4 times the setting). Any input in a
  tab (mouse, keys, scrolling), a check that finds a change or your own exchange, gift or upgrade
  on RSI's pages goes back to the set interval at once, and a check follows as soon as it is due.
  The tabs share it, so they never check more often together.
- **Also from RSI's own pages**: opening "My Gear" or "Buy Back Pledges" – in any tab, without the
  Hangar Manager – starts a check too when one is due (paging through them doesn't check on every
  page). What it finds shows in every tab with the Hangar Manager open within seconds, without
  reloading it, including the time of the check below the refresh button; while it runs, those
  tabs show "Checking …" as well.
- **Right after your own actions**: when you confirm an exchange (melt), a gift or an applied
  upgrade in RSI's own dialogs in "My Gear", a check runs a few seconds later, whatever the
  interval – also when RSI reloads the page after it. Every tab with the Hangar Manager open
  shows the change within seconds. Only your confirming click counts (the button in the step
  with your password); opening a dialog, going a step back or cancelling it starts nothing. The
  extension only watches your clicks: it never clicks or sends anything on RSI's pages. A buy
  back is checked out in RSI's store and found by the next regular check.

### Never in your way

Smart updates and refreshes run in the background. While they read RSI's pages you can search,
filter, open pledges and switch tabs as usual; the list updates itself when new data arrives. A
status line tells you what happened ("Up to date · checked 2 min ago", "Updated 1 min ago: 1 new,
0 removed, 0 changed"); its tooltip lists the steps of the last check – pledge log, buy back,
hangar – with the pages each read and what it found.

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

Your hangar is nobody else's business. The extension is built so that your data stays with you
(in detail: [privacy policy](../PRIVACY.md)).

### Your data stays in your browser

- **No server of its own, no account, no tracking, no analytics.** There is nothing to sign up for
  and nothing that reports back.
- **Everything is stored locally** in your browser's extension storage: hangar, buy back, orders,
  ship data and the items of the Pledge Store. It never leaves your computer, and removing the
  extension removes it. The settings show all of it ("Stored data"), and each part can be read
  again or deleted on its own. The CCU
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
account in Firefox). That is your browser's own sync; the extension has no server for it. Besides
them, only pledge IDs sync: of the pledges [marked to melt](#mark-to-melt-later) and of the paints
whose consultant notification you dismissed. Your hangar data itself is never synced.

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
- **Hide melt value**: hides all amounts – pledge values, discounts, upgrade costs, amounts paid,
  the amounts in the order details and the values in the exchange and gift dialogs.
- **Hide refund period**: hides the refund countdown of purchases paid with money and the
  "Refund Request" button in the order details (off by default).
- **Demo mode**: shows a fixed selection of 100 hangar and 50 buy back pledges with made-up pledge
  and order IDs (e.g. `99FE3X712`). Order details show a dummy billing address and payment
  provider instead of the real ones; links to RSI, the cart, invoices and refund requests are
  disabled. A **Demo** badge shows on every tab. Purchase dates are made up as well (newest first,
  two of them recent enough for the refund tags), and the dates of applied upgrades follow them:
  after the purchase, in their real order. The newest meltable pledge bought with store credit was
  bought a few hours ago, so marking it to melt shows the countdown; marks set in the demo are kept
  apart from the real ones. The top right shows a made-up store credit between $0
  and $100 instead of the account's. The made-up IDs, dates and store credit are derived from a random key
  that exists only in your browser, so they can't be traced back to the real ones.

---

## The Hangar Manager page

A new **Hangar Manager** entry at the top of the RSI account navigation opens the manager.
Switching between the manager and the original RSI pages is instant – no page reload. The manager
has three tabs, each with its own link to bookmark or share:

- **My Hangar** – all pledges of your hangar
- **Buy Back** – all pledges you melted and can buy back
- **Settings**

At the top right, above the refresh button, every tab shows the account's figures, each with an
icon and a tooltip that names and explains it:

- **Store credit**, as RSI's account menu shows it, read with every refresh and smart update.
  Hidden with "Hide melt value"; the demo mode shows its made-up one.
- **Buy back price**: what buying a pledge back costs, in USD without taxes like the other values,
  next to its pledge ID (hidden with "Hide melt value"). RSI's buy back list shows no price, so a
  tooltip names where it comes from (checked against RSI in November 2026):
  - pledges with several items: the price on the pledge's own buy back page, read with its items
    (RSI shows it with the taxes of your country; they are taken off) – the only source for game
    packages, which cost more than the ship of the same name,
  - CCUs: the difference of the standard prices of their ships, as RSI's upgrade dialog charges,
  - what the Pledge Store sells under the pledge's name (paints, gear, ships with their insurance,
    packs, …): its standard price there – RSI's buy back costs the current standard price, not a
    warbond or sale price,
  - standalone ships (also with insurance and extras like "10 Year" or "ILW") and pledges that are
    just a ship: the ship's standard price; an upgraded one only from its buy back page,
  - a single item the store doesn't sell any more (e.g. an event paint): its buy back page, read
    once when its row is opened ("Price …" meanwhile) and kept, as a melted pledge doesn't change –
    no request for rows nobody opens. Its copies with the same title show the same price.

  A full refresh reads the prices of pledges with several items stored before prices were shown.

- **Buy back tokens**: how many pledges can still be bought back with store credit, as RSI shows
  it above its buy back list, read with every refresh and smart update.

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
- **Games Library**: the details of every pledge with the game (game packages, and packages like
  "VIP High Admiral" that contain it) link to RSI's Games Library, which lists the protected pledge
  of each game – below the applied upgrades and above the external links.

### Tags

- **Insurance**: the best insurance of the pledge – `LTI`, or the duration such as `10 years` or
  `6 months` (months are shown as years when they add up to whole years). A pledge can contain
  several insurances, but only the best one counts – so only that one is shown. CCUs show the
  insurance they bring.
- **Upgraded**, **Gift** and **Melt** show at a glance whether a CCU was applied and whether the
  pledge can be gifted or melted.
- **Protected game access**: since October 1, 2026, RSI protects one pledge per game as the
  account's game access. Such a pledge gets a lock tag with its game – `SC`, `SQ42` or `SC · SQ42`
  – and a tooltip that explains it. It can't be melted or gifted (no Exchange and Gift, struck
  through tags, not counted as giftable or meltable in the filters), but if it contains a ship,
  it can still be upgraded with CCUs (a reward without a ship like "VIP High Admiral" can't). The
  lock is read during a refresh: after updating the extension, a full refresh shows it on every
  protected pledge at once.
- **Refund countdown** (see [Orders](#orders-invoices-and-refunds)).

---

## Selection and summary

- **Select pledges** in "My Hangar" with the round control in the top right corner of each row.
- **Sidebar** below RSI's page navigation on the left, a column of boxes:
  - **Notifications** (only while there is one):
    - When pledges [marked to melt](#mark-to-melt-later) can be melted now: how many, with two
      buttons. **Show** lists only them in "My Hangar" (without a filter button there); while it
      is on, it turns into **Show all** with a crossed-out filter icon and shows all again, like
      "Reset filters" – and the list shows all on its own once none is left. **Select** selects
      them, so the "Selected" box offers to melt them all at once with bulk melting on. It stays
      while there are any and can't be checked off.
    - When the [Paint Discount Consultant](#paint-discount-consultant) finds paints to buy again
      with more discount: how many (not with "Hide melt value"). Its **×** dismisses it for exactly
      these paints, kept in the sync storage so it stays dismissed on your other browsers too; it
      comes back with the count of all of them as soon as another paint can be bought again, or
      with "Show dismissed paint notifications again" in the settings.
    - Until browser notifications are on in this browser: a hint that they can be turned on, with a
      **Settings** button that opens the settings at "Browser notifications". Its **×** removes it
      for good (synced).
    - Other notifications, newest first, each removed with the **×** in its top right corner or all
      at once; removed ones don't come back. Changes in the Pledge Store (#164), found by its
      schedule around the full hour: **new and gone warbond CCUs** with their prices, and how many
      **Pledge Store items** changed, with the list (new, gone, new price, on sale) to open; both
      with **Show in Pledge Store**. Only new warbond CCUs also show as a browser notification –
      time-limited offers worth knowing while away; a click (or its button in Chrome) opens the
      Pledge Store tab at the warbond CCUs.
    - When filler paints of the [Paint Discount Consultant](#paint-discount-consultant) are among
      them: how many, with **Melt the filler paints**, which melts exactly them at once (bulk
      melting on; otherwise it leads to the setting).
    - Below them, the marked pledges still waiting, with the time left.
    - Works without the browser's notification permission.
  - **Summary**: number, value and discounts of the pledges shown in "My Hangar" (after search and
    filters). Discounts sum only real ones – a pledge that cost more than the original price
    doesn't reduce them.
  - **Selected** (with a selection): number, value and discounts of the selected pledges, how many
    of them search or filters hide, and a button that clears the selection. Below them, a button
    across the box for [bulk melting](#exchange-melt-with-a-safety-net) – or, with that setting
    off, one that leads to it.
  - **Paint Discount** (only while there is a paint to buy again): how many paints can be bought
    again with a higher volume discount and the store credit it frees, with a link to the
    [consultant](#paint-discount-consultant) and a filter button: **Show these paints** lists
    only them in "My Hangar" (its icon then shows the filter is on); **Show all pledges** or
    "Reset filters" shows all again, and so does the list once none is left.
- The sidebar stays on every tab of the manager (Buy Back, Pledge Store, Settings) and keeps
  showing the hangar's figures.
- **Reorder the boxes** by dragging their title: the dragged box follows the pointer, the places
  of the boxes show as the sidebar's grid, and the other boxes glide out of the way. Or focus a
  title and use the arrow keys up and down. The order is kept in the settings, which can reset it.
- **Collapse a box** to its title with the arrow in its top right corner; it stays collapsed
  (also kept in the settings).
- It sticks while scrolling as long as it fits into the window; a higher sidebar scrolls with the
  page, so its lower boxes stay reachable.
- Settings switch the sidebar or single boxes off and add the number of pledges per type (ships,
  CCUs, paints, …).
- Values and discounts are left out when "Hide melt value" is on.

## Search, filters and sorting

- **Live search** as you type – by title, ship name, pledge ID or order ID (also of orders paid with
  store credit, which are shown nowhere). Words are matched at their start, so `f8c` finds the
  "F8C Lightning".
- The search is part of the URL (`?search=…`): searches can be bookmarked or shared, and other
  tools can link to a pledge.
- **Filters** in two groups:
  - **Types** – what a pledge is: Ships, CCUs, Paints, Game access (game packages and other
    pledges that contain the game) and Rewards (Concierge, event and referral rewards).
  - **Features** – what it has: LTI, Warbond (bought with money, i.e. with an order ID),
    Giftable, Meltable, Valuable (worth more than $0) and Discount (bought for less than the
    original price, see [Discounts](#discounts); pledges whose original price isn't known, or
    that cost more, don't count).
- **Include or exclude**: each click on a filter cycles through off → only pledges with it →
  only pledges without it ("−Rewards" hides all rewards). All active filters combine with "and";
  one click on "Reset filters" turns them all off.
- **Live counts**: each filter shows how many pledges it would leave in combination with the
  other active filters – a filter showing 0 would empty the list.
- **Sorting** at the top right of the list: newest or oldest first, highest or lowest value first,
  or highest discount first. The buy back sorts by date only, as RSI shows no value there. The
  choice is kept per list.
- Thousands of pledges stay fast: rows are drawn while scrolling, in small steps between frames.

---

## Discounts

The row shows the **discount compared to the original price** – in dollars and percent, e.g.
`−$25 (62.5%)` – right next to the pledge value:

- **CCUs** are compared with the price difference of their two ships (RSI's ship upgrade tool).
- **Ship pledges** are compared with the price of the ship (packages with the game are left out
  there: their value also pays for the game).
- **Everything else** – paints, gear, add-ons, packs, game packages, … – is compared with the item
  of the same name in the Pledge Store (its standard price, not a warbond or sale price). Only items
  the store sells now have a price.
- **Paints** are rounded to RSI's volume discount tiers (2 paints 15%, 3 paints 20%, 5 paints 25%,
  7 paints 30%, 10 or more 35%) when within 0.2 percentage points of one, e.g. 24.85% → 25%. Older
  paint packages with other discounts keep theirs.
- **Free pledges** (rewards, referral bonuses with a value of $0) show no discount.
- **Bundles of several ships** the store doesn't sell are compared with the sum of their ships'
  prices (without the game, and only if every ship's price is known).
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

The initial load reads the whole pledge log once; after that only new entries are read.

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

**Bulk melting** (an experimental setting, off by default): with it on, the "Selected" box of the
sidebar gets a button that exchanges all selected pledges at once. Its dialog lists the pledges
with their warnings, sums the warnings up (e.g. the discounts you give up, how many can't be
bought back), warns when the selection takes every pledge with game access, and asks for RSI's
acknowledgements, an extra one for the experimental feature and your password, entered once.
The pledges are exchanged one after the other, a second apart; the first one RSI refuses (e.g. a
wrong password) stops the rest, and the dialog says what was exchanged and what wasn't. Pledges
that can't be melted are left out; in the demo mode the button is disabled.
With it off, the "Selected" box shows **Bulk melting disabled** instead (with meltable pledges
selected): a click opens the settings at the setting and marks it for a moment.

## Mark to melt later

RSI lets a pledge be melted only 24 hours after it was bought (with store credit or money). **Mark
to melt** under the image of a meltable pledge keeps it in mind: a badge in its row counts down
("Melt in 5 hr 12 min") and turns into **Melt now** once RSI allows it; its tooltip gives the exact
time. The purchase time comes from the pledge log; with only the purchase date, the end of that
day counts, and as RSI doesn't say which time zone it uses, the later reading counts – the badge
may turn a little late, never too early. The mark goes once the pledge is gone from the hangar.
The marks are kept in the browser's sync storage, so they follow your browser profile to your
other devices; in the demo mode the marks are the demo's own. Once marked pledges can be melted, the sidebar's
**Notifications** box says how many, with **Show** to list just them.

## Gift

**Gift** under "Exchange" (for giftable pledges) opens RSI's gift dialog of "My Gear" in the
manager's design: RSI's texts, recipient name and email, and your password, sent to RSI only.
The pledge is shown up front with its kind and value, notices tell when it is your last pledge
with game access or carries applied upgrades, and the email address is entered twice, so a typo
doesn't send your gift to someone else. Until it is claimed, the gift can be cancelled in
"My Gear".

This concerns pledges bought **before 30 Oct 2026**: those can still be gifted with RSI's legacy
gifting system – once per pledge, and only if no store credit was used. Since 30 Oct 2026, RSI has
new rules for gifting: a pledge is a gift only if it is bought as one in the pledge store. The
rules in detail:

- [Gifting FAQs](https://support.robertsspaceindustries.com/hc/en-us/articles/115013325608-Gifting-FAQs)
  in RSI's knowledge base – the current rules, including what can't be gifted and gifting after a
  buy back
- [Updates to pledge gifting and game access](https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/updates-to-pledge-gifting-and-game-access)
  and its [FAQ](https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/updates-to-pledge-gifting-faq)
  on Spectrum – the announcement of the change

## Buy back

The **Buy Back** tab lists all melted pledges with the same search and filters (Ships, CCUs,
Paints, Game access, LTI, Warbond, Probably giftable, Rewards), plus:

- **Probably giftable**: a pledge bought back keeps the giftable status it had when it was
  melted, and buying back with store credit makes it ungiftable (see RSI's
  [Gifting FAQs](https://support.robertsspaceindustries.com/hc/en-us/articles/115013325608-Gifting-FAQs),
  "If I use the Buy Back Tool to recover a pledge, can I gift it to someone else?"). So pledges
  bought before 30 Oct 2026 are probably giftable again when bought back with money (warbond) –
  "probably", as the extension can't tell whether a pledge was giftable when it was melted (e.g.
  bought with store credit, or already gifted once).
- **Buy back tokens**: how many pledges can still be bought back with store credit, as RSI shows
  it above its buy back list – at the top right of the manager, on every tab (see
  [The Hangar Manager page](#the-hangar-manager-page)).
- **To Cart**: a button in the opened item, under "Show in Buy Back": one click puts a buy back
  pledge – or a buy back CCU – into the RSI cart and opens it, without going through RSI's pages.
- **Show in Buy Back**: opens the pledge on RSI's own buy back page (only this pledge, or the list
  page with the pledge highlighted).
- Insurances, ships and orders as in "My Hangar".

---

## Pledge Store: current warbond CCUs

The **Pledge Store** tab lists the warbond CCUs RSI currently offers – read from RSI's own ship
upgrade tool and stored in the browser, so the tab shows them at once. CIG changes the Pledge Store
mostly at the full hour, sometimes a few minutes late, so smart updates read it on a schedule around
the full hour (local clock), while the manager is open in a visible tab:

- **Warbond CCUs**: every 30 seconds from xx:59 to xx:10, otherwise once they are older than
  5 minutes (a setting).
- **Pledge Store items** (about 13 requests): only at xx:00, xx:05, xx:10, xx:30 and xx:35.
- A read missed meanwhile (browser closed, computer asleep) runs once at the next chance, not once
  per missed time. Only one tab reads at a time.
- With **browser notifications** on, the extension reads the Pledge Store on the same schedule
  also while no RSI page is open (an alarm every 30 seconds looks whether a read is due). It uses
  your RSI cookies; signed out of RSI, it waits until you sign in again. Tabs and the background
  never read at the same time.

That is about 34 reads of the upgrade tool and 65 requests for the items per hour, instead of 12
and 156 with the former 5-minute interval of the items. The refresh button and the initial load
always read both; the count line says when the offers were updated. For each warbond ship:

- **Prices**: the warbond price, the standard price (struck through) and the discount in dollars
  and percent, with the ship's image.
- **Ship upgrade**: opens RSI's own ship upgrade dialog with the warbond edition of the ship
  already chosen as target – only the ship to start from is left to pick.
- **Cheapest warbond CCUs** (in the opened item): the discount is the same whichever ship you start
  from, so the CCU from a more expensive ship costs less. The 10 ships with the cheapest CCU are
  listed with the CCU's price and how often you already have each ship in your hangar and buy back
  – as a ship and as the target of a CCU –, to choose the ship to buy the CCU from.
- **Your CCUs between the warbond price and the standard price**: every warbond CCU spans this
  range, whatever ship it starts from. The CCUs of your hangar that overlap it can't be chained
  with it, so you see at a glance how many discounted CCUs you already have there – in a small
  table with their ship prices, count, value and discount. CCUs ending at or below the warbond
  price (e.g. to a ship listed above) are left out: they can be chained. The count is also a tag on
  the item.

## Paint Discount Consultant

RSI gives a volume discount on paints in the cart: 15 % from 2 paints, 20 % from 3, 25 % from 5,
30 % from 7 and 35 % from 10. Below the warbond CCUs, the **Pledge Store** tab shows how to turn
it into store credit with the paints you already own:

- **The idea**: melt own paints that were bought with less discount than reachable now, buy them
  again together with cheap filler paints at the higher discount, and melt the fillers again after
  RSI's 24-hour cooldown – RSI lets a pledge be melted only 24 hours after it was bought
  ([RSI Support: Reclaim a Pledge](https://support.robertsspaceindustries.com/hc/en-us/articles/115013193627-Reclaim-a-Pledge)).
  The fillers melt for what they cost, so the own paints free the difference between their melt
  value and their new, discounted price as store credit.
- **Store credit only**: the cart is paid with the melt value of the own paints and, if the
  setting allows, the current store credit – never with new money, so warbond paints are left out.
  No taxes are counted: there are none on store credit.
- **The best tier**: the tiers are tried from 35 % down, and the first one the store credit pays
  is taken. Own paints count when their discount, rounded to the tiers, is below it. Fillers are the
  cheapest paints, up to 5 of the same (RSI's limit per item in the cart).
- **Shown with the real values**: the tier, the store credit freed (also in % of the melt value),
  the store credit needed and what is missing for the next tier; the cart broken down, e.g.
  `(5 × $5 + 5 × $3) × 0.65 = $26`; the own paints with price, melt value, price in the cart and
  their discount now and then; the filler paints with their count.
- **Honest about the result**: the melt value of the own paints drops by the store credit freed –
  the account's total value stays the same. Paints bought again with store credit are no longer
  giftable.
- **Giftable paints are left out** by default, as they would lose that status; the consultant says
  how many. Turned off (in the consultant or the settings), they are included and marked
  "Giftable".
- **Order**: fill the cart and check it first, melt only after that.
- **Into the cart**: one button puts all paints of the plan – the own paints and the fillers with
  their counts – into RSI's cart, with the requests RSI's own paint pages send, and opens it.
  Nothing is bought: you check the final price and every paint there and pay with store credit.
  The cart is read first: if it already holds items, which would change the tier, it says so and
  offers to open the cart, add anyway or cancel. A paint RSI refuses (e.g. no longer available)
  is listed with RSI's reason, and the cart isn't opened on its own then. The plan is kept in this
  browser (Settings → Stored data → "Paint plan"), so the filler paints can be found again later.
  Disabled in the demo mode.
- **Two ways**: buying first and melting after (recommended, safer, but the store credit of the
  own paints isn't free for the cart yet), or melting first and buying after.
- **Both ways side by side** (the default layout; the setting "Layout" switches to the tables):
  - **Buy first** pays the whole cart from the store credit before any paint is melted, so it
    takes the best tier the store credit pays alone – the same as melting first, a lower one, or
    none ("Needs $… more store credit").
  - **Melt first** fills the cart and keeps the plan, melts the own paints (with bulk melting on,
    once its cart was filled) and pays with their melt value.
  - On top, the store credit each way frees and the discount tiers they reach. Below that, the
    cart as cards: own paints ("Yours") and fillers, with the standard price and the price in the
    cart – for both carts when the tiers differ.
  - When the ways differ, "Why they differ" compares what each needs before melting with the store
    credit there is. Each way has its own card: discount, store credit freed, what it needs
    upfront, its steps with the store credit after each one, a hint and its cart button.
  - A chart shows the store credit along both ways, and short notes say what to know before you
    start.
- **Melt the own paints at once** (with the experimental bulk melting on): a button opens the bulk
  melting dialog with exactly the own paints of the plan and the store credit they give. Once these
  paints were put into the cart, the dialog asks to confirm that the cart was checked. Before that
  the button melts them first (way 2), with its own acknowledgement: buy them again right away.
  The plan is kept then, so the paints to buy again are known although the hangar no longer shows
  them.
- **Filler paints bought**: the kept plan is checked against the orders and the hangar whenever
  they are read. An order made on the plan's day or later, paid with store credit, that created
  own paints and filler paints of the plan confirms the purchase. The filler paints it created are
  [marked to melt](#mark-to-melt-later) by their pledge ids – never others of the same name, so an
  older copy is never melted – and can be melted 24 hours after that order. The sidebar's
  **Notifications** box then counts them among the marked pledges that can be melted now, with
  **Melt the filler paints** (bulk melting on; otherwise it leads to the setting), which opens the
  bulk melting dialog with exactly them. With browser notifications on, a notification tells it
  also while no RSI page is open; a click opens My Hangar. Without such an order within 7 days,
  the plan isn't checked any more (it is kept for the paints bought again and those left to buy).
- **Left to buy**: own paints of a kept plan that are gone from the hangar – melted – and not
  bought again since are listed with the tier the store credit pays now (fewer filler paints if it
  is short; it says what the planned tier misses) and their own "Put the paints into the cart"
  button, which keeps the tier and fillers really put into the cart. Afterwards the hangar is read again, as after every bulk melting. With bulk
  melting off, **Bulk melting disabled** opens the settings at that setting instead.
- **Bought again**: once the paints were bought, the hangar holds each own paint twice – the old
  pledge without the discount and the new copy with it. The consultant pairs each copy with one
  old pledge of the same paint (the oldest one with less discount; the copy is younger). By
  default a pair counts only when the old pledge was in a plan whose paints were put into the cart
  and the copy was bought that day or later; the setting "Paints bought again" can also show other
  pairs as a guess to check, which change nothing. For a counted pair it shows
  "cart filled" and "bought" as done, with the date, and only "melt the old paints" as open, with
  the store credit it gives. Melting them is safe – the paints are in the hangar again – so a
  button melts them at once (with bulk melting on; otherwise it leads to the setting). The pairs
  are not planned again; other paints can form a new plan next to them. In My Hangar the old
  pledges carry "Melt – bought again at 35%", and the sidebar box counts them.
- **In My Hangar**: the paints it would buy again carry a tag "Rebuy 0% → 35%" (their discount now
  and then; its tooltip says the store credit freed), which opens the consultant. The filter
  button of the sidebar box **Paint Discount** shows just them.
- Only pledges with exactly one paint that can be melted, and single paints of the Pledge Store;
  paint packs come later. Hidden while "Hide melt value" is on.

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

- **First start**: when no pledges are stored yet, the lists show an **Initial Load** button
  instead, with how long the first load takes: about 20 seconds for 1,000 pledges, about
  1.5 minutes for 5,000 (hangar and buy back together; from `INITIAL_LOAD_EXAMPLES` in
  `src/config.ts`). The extension never reads the hangar on its own; after the click the refresh
  button shows the progress and the lists appear when it is done.
- **Refresh** reads hangar, buy back and orders from RSI. Large hangars take a moment; a progress
  bar shows pages and percentage, weighted by how long each kind of page takes, and the status line
  which part is being read ("Refreshing Buy Back: page 3 of 16 …").
- **Smart updates** (on by default): check a few RSI pages for changes and update the list
  without a full refresh – see [Built for speed](#built-for-speed).
- Requests are gentle on RSI's servers – see [Gentle on RSI](#gentle-on-rsi).

---

## Settings

In the order of the settings tab:

- **Language**: automatic, English, German, French or Spanish. The exchange and gift dialogs
  show RSI's own texts in RSI's English by default, as its wording counts; translating them too
  is an experimental option (see below).
- **Theme**: Modern Hangar (the default) or Classic RSI.
  - **Font size** (the same for both themes): small, medium (the default) or large – for the
    lists, the settings and the dialogs (the factors are in `FONT_SIZE_SCALES` in
    `src/config.ts`).
  - **Compact view** (off by default, the same for both themes): in Modern Hangar the items as one
    grouped list with separators instead of cards with gaps; in Classic RSI the items without
    gaps, separated by a 1 px border.
  - The exchange and gift dialogs look like RSI's own dialogs in "My Gear" by default (with the
    manager's summary and warnings); an option shows them in the selected theme instead.
- **Hide sensitive information**: see [Anonymization for content creators](#anonymization-for-content-creators).
- **General**:
  - **Show only the best insurance of upgraded ships** (on by default): after upgrades a pledge
    lists the insurance of every step; only the one that counts (LTI, otherwise the most months)
    is listed.
  - **"Show in Buy Back" opens**: only the pledge, or the list page with the pledge highlighted.
- **Sidebar**:
  - **Show the sidebar** (on by default) – see [Selection and summary](#selection-and-summary).
  - **Boxes** (all on by default, only while the sidebar is shown): notifications, summary,
    selected and Paint Discount Consultant. Without the "Selected" box, the rows have no select
    control.
  - **Reset order** (only while the boxes aren't in their default order): puts the boxes back
    into their default order; which boxes are shown and which are collapsed stays as it is.
  - **Count the pledges per type in the summary** (off by default): only for the "Summary" box;
    the "Selected" box always counts the selected pledges per type.
- **Notifications**:
  - **Browser notifications** (off by default, only for this browser): also while no RSI page is
    open. Turning it on opens a page of the extension where the browser asks for the permission to
    display notifications (never at install or update); a first notification confirms it. Refused,
    it stays off and says so; turned off – here or in the browser's own settings – the permission
    goes back. The sidebar's "Notifications" box needs no permission. They tell when pledges
    marked to melt can be melted – one notification for all that are due, each pledge once, by the
    pledges of this browser's stored hangar, and only for pledges that were still waiting for RSI's
    24 hours when marked (a mark on a pledge that can be melted already shows "Melt now" at once and
    needs no notification) – and when the Paint Discount Consultant's filler
    paints can be melted (a notification of their own). A click opens the Hangar Manager – in
    an RSI tab already open (My Hangar focused, else another RSI tab), or a new one. In Chrome the
    notification about marked pledges has the sidebar's buttons too: **Show** lists only the
    pledges that can be melted now, **Select** selects them for melting them at once (Firefox shows
    no buttons in notifications; there the click opens the manager).
    Browser notifications are used sparingly – only for what is worth knowing while no RSI page is
    open – and each goes away on its own: once its pledges are melted or unmarked, once the Hangar
    Manager is shown (its sidebar tells the same), or when closed. A sidebar notification that can
    be checked off and also shows in the browser stays in step: checked off in the sidebar, it goes
    in the browser; closed in the browser, it is checked off in the sidebar. With them on, the extension also reads
    the Pledge Store on its schedule while no RSI page is open (see
    [Pledge Store](#pledge-store-current-warbond-ccus)).
  - **Kinds of notifications** (#197), each on by default and turned off on its own:
    - **Marked pledges can be melted** (below "Browser notifications", only while they are on): the
      browser notifications about marked pledges and the consultant's filler paints; the sidebar
      tells it anyway.
    - **Pledge Store changes**: **Warbond CCUs changed** (in the sidebar, new ones also in the
      browser) and **Pledge Store items changed** (in the sidebar only). Turned off, a kind adds no
      notification, and its open ones go – in the sidebar and in the browser.
  - **Show dismissed paint notifications again**: the Paint Discount Consultant's notification
    shows again for all paints, also those dismissed with its × (on all browsers, as the dismissed
    paints are synced).
- **Paint Discount Consultant** (it always buys with store credit, never with new money):
  - **Include my store credit** (on by default): the cart may also be paid with the current store
    credit; off, only with the melt value of the own paints.
  - **Use filler paints** (on by default): cheap extra paints reach a higher volume discount and
    are melted again after RSI's 24-hour cooldown; off, only the own paints count.
  - **Leave out giftable paints** (on by default): bought again with store credit, they would no
    longer be giftable. Also right in the consultant.
  - **Paints bought again**: only those of a plan put into the cart (default, safe), or also guessed
    from discount and age – shown as a guess to check, without acting on it.
  - **Layout**: both ways ("Buy first", "Melt first") side by side as cards (default), or the plan
    and its paints in tables.
- **Smart updates**:
  - **Check hangar, buy back and orders for changes** (on by default) – see
    [Built for speed](#built-for-speed).
  - **Check for changes every** 5 minutes (1 to 1440; the default) while the manager is open in a
    visible tab; up to 4 times as long while checks find nothing and nobody uses the tab (see
    [Built for speed](#built-for-speed)).
  - Besides, a check runs when the manager is opened or shown again, when "My Gear" or "Buy Back
    Pledges" is opened (when due), and a few seconds after an own exchange, gift or upgrade there.
  - **Spot checks per check (only for changes within an existing pledge)**: 2 hangar pages (1 to 10; the default) besides the first and the
    last one. Added or removed pledges are found by every check anyway; the spot checks find
    changes within a pledge (new items, gift status, …). The hint below shows, for your number of
    hangar pages, how likely such a change shows in the next check and after how many checks every
    page was checked. The buy back always takes one spot check page in full size (its count is
    compared with small pages).
  - **Outside the full hour, read the warbond CCUs of the Pledge Store again after** 5 minutes
    (1 to 1440; the default), together with the ships and their prices. From xx:59 to xx:10 they
    are read every 30 seconds, and the Pledge Store items at xx:00, xx:05, xx:10, xx:30 and xx:35
    (see [Pledge Store](#pledge-store-current-warbond-ccus)); the hint explains the schedule.
    Both while the manager is open in a visible tab, and with browser notifications on also while
    no RSI page is open. With smart updates off, both once a day and with the refresh button.
- **Filters**: order and selection of the filter buttons, separately for My Hangar and Buy Back
  and for types and features – drag a filter (or use its arrows) to move it within its group,
  uncheck it to hide its button.
- **Show links for ships**: erkul.games and FleetYards.net, each on or off.
- **Experimental** (all off by default), with a clear warning: these features may not work as
  intended, and using them is at your own risk – the developer accepts no liability.
  - **Bulk melting**: exchange all selected pledges at once – see
    [Exchange (melt) with a safety net](#exchange-melt-with-a-safety-net).
  - **Translate RSI's texts in the exchange and gift dialogs**: RSI's changes to its texts reach
    the translations only later.
- **Stored data**: a table of everything the extension keeps in this browser – My Hangar, Buy
  Back, order history, ships, ships on sale, warbond offers, Pledge Store items and the store
  credit – with the number of entries, the
  size, the last full read and the last check. Each can be read again from RSI on its own (the
  refresh icon; ships, ships on sale and warbond offers are one read) and deleted on its own; the
  confirmation
  says what is missing until it is read again (by the next refresh, or on its own for the small
  data of the upgrade tool). Not possible during a refresh.
  - **Reset**, below the table, each after a confirmation:
    - **Delete all local data**: removes the whole copy listed in the table; nothing changes on
      RSI's website, and the lists offer the initial load again. Not possible during a refresh.
    - **Reset settings**: all settings back to their defaults (on all synced devices); the stored
      hangar stays.
- **About**: the extension's version, and links to the source code, the issue forms (bug
  reports; ideas link to GitHub Discussions), the privacy policy, the changelog and the license. The popup of the
  toolbar icon shows the version, too.

Settings follow your browser profile to your other devices (see
[Private by design](#private-by-design)).

---

## Tech stack

- **[WXT](https://wxt.dev)** – framework for cross-browser extensions: one code base, built as
  Manifest V3 for **Chrome and Firefox** today, with more browsers possible
- **[Vite](https://vite.dev)** – fast builds and hot reload during development
- **[Vue 3](https://vuejs.org)** – the manager's interface, integrated into RSI's own pages
- **TypeScript** – typed throughout
- **Vitest** – unit and component tests, plus ESLint and Prettier for consistent code
- **No runtime dependencies besides Vue** – no tracking, analytics or third-party SDKs
