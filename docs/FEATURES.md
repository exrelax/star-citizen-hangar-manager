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
  meltable, valuable, discount, rewards, …), refined right in their pill (solo ships or packs, CCUs
  without base ship, paints for ships you own), sorting by date, value or discount
- A grouped view: equal pledges in one row with their count and sums
- List shortcuts like "Ready to melt", "Paints to optimize" and "Melt and rebuy"
- Discounts compared to the original price: ships and CCUs, paints, gear, packs and more
- The best insurance of every pledge as a tag (LTI, 10 years, …)
- The full CCU history of upgraded ships, with the discount of every step
- Orders of your purchases with invoices, refund countdown and a prefilled refund request
- Buy back pledges straight into the RSI cart, and the buy back tokens with the date of their
  next renewal
- A CCU Check in the tab "Tools": which CCUs have a base ship to start from – in your hangar, only
  via your buy back, by a ship the store always sells, or not at all –, a deep view that follows
  whole CCU chains and what to buy to secure them, CCUs soon without base ship and CCUs whose
  discount is at risk; counts of your ships and CCUs right in RSI's ship upgrade dialog
- A Paint Discount Planner: more store credit from your paints with RSI's volume discount,
  as a plan you start and follow step by step, and a note in RSI's cart when its paints miss the
  best tier
- Melt and Rebuy: the pledges you can melt now and buy again later at the same price, with a
  watchlist to rebuy them
- Watchlists of pledges, buy back items and Pledge Store items, with a reminder date, notifications
  when a store item changes and "Put on a watchlist" buttons on RSI's own store pages
- The current warbond CCUs of the pledge store, with the cheapest ships to start from and your own
  CCUs in the same price range, sorted by when they are expected to end, ship value or discount,
  and a history of the warbond offers seen so far
- All ships by value in one table, with prices, warbond prices, price increases and your CCUs from
  and to each ship
- Expected price increases: a reminder on buy back items that get more expensive, advice for CCUs
  that lose or gain upgrade value, and the CCUs to secure before a ship's price rises
- Ships leaving the Pledge Store, with a countdown and a warning on the CCUs that would lose their
  base ship
- Event notices like the Intergalactic Aerospace Expo, with countdowns
- Notifications in the sidebar and, if you turn them on, from the browser – each kind on its own
- Links from CCU Game (ccugame.app) straight to the pledge in the Hangar Manager
- An addition to RSI's website: "My Gear" and "Buy Back Pledges" stay untouched and usable
- Transparent storage: the settings list everything that is stored, in groups by where it comes
  from, with size and the time of the last read and check, and read again or delete each part on
  its own
- Watchlists, marks to melt and paint plans follow your browser profile to your other devices
- Export & Import: the hangar as JSON, CSV or in HangarXPLOR's format for FleetYards, and your
  settings and own data as a backup, merged on import
- Account Safety: a note on RSI's Terms of Service, a question before bulk melting is turned on,
  a check of the pledges right before they are melted and a limit of how many melt at once
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
  extension only watches your clicks: it never clicks or sends anything on RSI's pages.
- **After a purchase**: once RSI's store shows the order confirmation, the next check runs at once.
  RSI often lists a bought pledge a little later than it confirms the order, so the checks then
  run every 30 seconds for up to 5 minutes, until the hangar or the buy back changed; then the set
  interval applies again. If the confirmation wasn't seen, the tab that opened the cart (e.g. "To
  Cart" in the buy back) checks once when you come back to it.

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
  ship data, the items of the Pledge Store, the events and the expected price increases. It never leaves your computer, and removing the
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
- **Events and expected price increases from the project website**: the list of events in the
  Pledge Store tab and the list of ships whose price is expected to rise are read from the
  project's own website on GitHub Pages, every two hours, more often in the afternoon and
  evening (at most every 15 minutes) – public files, the same for
  everyone; the requests carry nothing but your IP address, like any request.

### Only your settings and what you made sync – through your browser

Your settings (language, display options, …) are saved in the browser's sync storage, so they
follow you to your other devices if you use a browser account (Google account in Chrome, Firefox
account in Firefox). That is your browser's own sync; the extension has no server for it. Besides
them, only what you made yourself syncs: the [watchlists](#watchlists), the pledge IDs of the
pledges [marked to melt](#mark-to-melt-later) and of the paints whose planner notification you
dismissed, and the running and completed plans of the
[Paint Discount Planner](#paint-discount-planner) (#635, the last 10 completed ones), so a plan
started on one device can be finished on another. Every write is measured against the sync
storage's limits first; one that wouldn't fit changes nothing and says so. Your hangar data itself
is never synced.

### It acts only when you click

Nothing is bought, gifted, melted or submitted on its own. Smart updates only read. Adding to the
cart, opening an invoice or a refund request always takes your click – and a refund request opens
RSI's form for you to review and send yourself.

### Anonymization for content creators

Sharing your hangar in a screenshot, a stream or a video? The settings categories **Privacy** and
**Demo mode** keep private details off screen:

- **Hide pledge and order IDs, name and address**: hides every pledge and order ID – also those
  of applied upgrades and in the order details – and blurs your name and billing address in the
  order details. The real name and address don't even reach the page then, only a placeholder of
  the same shape. Searching by ID still works.
- **Hide melt value**: hides all amounts – pledge values, discounts, upgrade costs, amounts paid,
  the amounts in the order details and the values in the exchange and gift dialogs.
- **Hide refund period**: hides the refund countdown of purchases paid with money and the
  "Refund Request" button in the order details (off by default).
- **Demo mode** (its own category): shows a hangar generated from the public catalog – the ships of RSI's upgrade
  tool and the items of the Pledge Store, or a small bundled catalog before they are read – instead
  of your own (#175): standalone ships, game packages, CCUs (also warbond), paints, gear, add-ons,
  packs and rewards, with plausible values and discounts, nothing of your hangar – neither the
  items nor their number nor the value. It stays the same on every visit. The buy back is
  generated the same way (#177): melted ships, game packages, CCUs, paints, gear, add-ons and
  rewards, some bought with money, with buy back prices of every source and an item without a
  price, and made-up buy back tokens (0 to 2, as an account has at most two). Its rewards are event
  rewards only: referral bonuses and the like can't be melted. Its orders and remembered gift flags show every case of
  "probably giftable" (#205): money only before 2026-10-30 (also a buy back paid with money),
  store credit only, both, money after the date, no known order, a gift flag overruling the order,
  and two pledges of one order. Two CCUs can't be bought back (#208): one whose base ship now costs
  more than its target, one where both cost the same. Instead of the website's file, made-up
  expected price increases (#194) fit the generated hangar and buy back, with dates relative to
  now: a ship whose flight ready date is ahead (with its module and a CCU to it), an already
  flight ready one with only the day, one within the hour and one outside the period – so the
  labels, the filter and the sidebar notification show every case. The Pledge Store tab shows
  made-up events (#210) instead of the website's – one running with description, image and
  phases, one upcoming without – and the sidebar shows sample notifications of its own instead of
  the real ones, among them those of these events and of the Pledge Store's changes (new and gone
  warbond CCUs, changed items, #131); checking them off in the demo changes nothing real. The
  Paint Discount Planner has a kept plan of its own (#131), never the account's: a paint bought
  again with its old pledge left to melt, paints melted first and left to buy again, and its
  filler paints marked to melt – one waiting, one ready. Exchange, Gift and bulk melting (also
  the planner's) open their dialogs in the demo too, with the made-up ids; only the button that
  would send them is disabled. The
  settings show no account data meanwhile (#132): "Stored data" shows the demo's numbers of the
  account's data (My Hangar, buy back, orders, store credit, paint plan, events, price increases)
  with made-up sizes and times, and their buttons to read again and delete are disabled, so
  nothing real changes; the public data (ships, Pledge Store items) shows as it is. The spot
  checks count the demo hangar's pages, and "Show checked-off notifications again" is off.
  Development builds also offer an **invisible demo mode** for screenshots (#133, in the
  Development section): the same demo without its badge and with every button looking enabled
  (clicks still do nothing); it ends on its own after 10 minutes, also across reloads, and the
  normal demo mode with its badge is back. The Pledge Store tab shows warbond CCUs of the demo's
  own, next to its CCUs in the same price range (#130), so every case shows on any account; with
  the demo setting **Show real Pledge Store data** (#310) it shows the real warbond CCUs, their
  history, the events and the CCUs to secure before a price increase instead – public data –,
  still counted against the demo hangar and buy back, whose CCUs then also lead to the real ships
  RSI sells no CCUs to before their price increase. The ships leaving the Pledge Store are the
  demo's own too (#292), picked for the demo hangar and buy back. The upgrade buttons of the tab
  are disabled in the demo, since RSI's dialog shows your real ships and CCUs. The hangar's pledges
  have every
  state (#176): meltable or not, giftable or not, LTI and insurances in years and months (also
  several at once), upgraded ships with made-up "Applied upgrades", protected game access – one
  pledge per game like RSI's, by the demo settings `SC` on a reward without a ship and `SQ42` on a
  game package, or `SC · SQ42` on one –, and orders paid with money, in part with
  store credit or with store credit only, with made-up invoices. Two of them have the refund
  countdown, the newest was bought a few hours ago, and a new demo hangar starts with two marks to
  melt – one still waiting, one ready. Everything has made-up pledge and order
  IDs (e.g. `99FE3X712`). Order details show a dummy billing address and payment
  provider instead of the real ones; links to RSI, the cart, invoices and refund requests are
  disabled. A **Demo** badge shows on every tab. Purchase dates are made up as well (newest first,
  two of them recent enough for the refund tags), and the dates of applied upgrades follow them:
  after the purchase, in their real order. The newest meltable pledge bought with store credit was
  bought a few hours ago, so marking it to melt shows the countdown; marks set in the demo are kept
  apart from the real ones. The top right shows the demo's store credit instead of the account's. The made-up IDs, dates and store credit are derived from a random key
  that exists only in your browser, so they can't be traced back to the real ones.

---

## The Hangar Manager page

A new **Hangar Manager** entry at the top of the RSI account navigation opens the manager.
Switching between the manager and the original RSI pages is instant – no page reload. The manager
has six tabs, each with its own link to bookmark or share:

- **My Hangar** (`#hangar-manager`) – all pledges of your hangar
- **Buy Back** (`#hangar-manager-bb`) – all pledges you melted and can buy back
- **Pledge Store** (`#hangar-manager-store`) – warbond CCUs, events, price increases and ships
  leaving the store (see [Pledge Store](#pledge-store-current-warbond-ccus))
- **Tools** (`#hangar-manager-tools`, #653; the former `#hangar-manager-consultants` still opens
  it) – the [CCU Check](#ccu-check) and the [Paint Discount Planner](#paint-discount-planner)
- **Watchlists** (`#hangar-manager-watchlists`) – see [Watchlists](#watchlists)
- **Settings** (`#hangar-manager-settings`) – only its icon, with the tooltip "Hangar Manager
  Settings" (#513)

Once a label would be cut at a narrow width, every tab shows only its icon, with its label as
tooltip; the labels come back when the window is wider again. Above the tabs, on every tab, the
buttons **All ships** (see [All ships by value](#all-ships-by-value)) and **Ship upgrade** (see
[Links to RSI and other sites](#links-to-rsi-and-other-sites)).

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
  it above its buy back list, read with every refresh and smart update – also 0 when none are left
  (#433). Its tooltip names the next date RSI renews them (#434), with a link to its source: CIG
  announces the dates once a year on Spectrum (in 2026 the first Monday of each quarter). A date not announced yet is estimated from the earlier schedule
  and says so. The dates come from the project website (`data/buyback-tokens.json`); without a
  known date the tooltip leaves it out. The tooltip opens on hover and with Tab, and its link can
  be focused.

### An addition, not a replacement

The Hangar Manager adds to the RSI website – it doesn't take anything away. RSI's own **My Gear**
and **Buy Back Pledges** pages stay exactly as they are and remain fully usable, with all of RSI's
functions (gift, melt, apply upgrades, buy back, …): one click on their entry in the account
navigation, and you are back on RSI's original page. The extension doesn't overwrite or change
any area of the RSI website: it adds its own navigation entry, shows the manager in the content
area only while you have it open, and highlights a pledge on RSI's lists when you opened it via
"Show in My Gear" or "Show in Buy Back". The few additions to RSI's own pages are added from
outside, in RSI's look, and never change how RSI's pages work: labels and counts in RSI's
[ship upgrade dialog](#ccus-in-rsis-ship-upgrade-dialog), the
[paint discount note](#paint-discount-note-in-rsis-cart) in the cart (both can be turned off
under "RSI website" in the settings) and the "Put on a watchlist" buttons of the
[watchlists](#watchlists). When RSI changes its markup, they don't show, and the error log notes
it.

### Compact, expandable rows

Every pledge is one compact row: image, title, pledge ID, value, purchase date and tags. A click
opens the row with everything RSI knows about the pledge: the contained items (ships, insurances,
paints, …), the ships of a CCU and further details. If a search leaves only one pledge, it opens
on its own.

- **Upgraded ships show what they are now**: after a CCU, the row shows the current ship with its
  image, and the original pledge name below it ("Originally: …").
- **CCUs show their target ship** as image. Opened, a CCU has the section **Base ship** with its
  [base ship coverage](#ccu-check).
- **Ship packs at a glance** (#515): a pledge with several ships shows their images fanned out and
  the number of ships ("4 ships in this pack"); a long title is shortened, with the full one as
  tooltip. Opened, it shows a tile per ship. In My Hangar and the Buy Back.
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
- **Price increase**: a ship whose price is expected to rise soon – e.g. when it becomes flight
  ready at the IAE – gets a quiet tag with a countdown on its ships, packages, CCUs and related
  items such as modules: melting it before then means buying it back at the higher price (see
  [Buy back](#buy-back)). Where the new price is announced (#251), the tag tells the change: a
  ship's price ("Price +$20"), a CCU's upgrade value with the ship as target ("Upgrade value
  +$20"); the tooltip gives the old and new price, the upgrade value and the discount now and
  after. A CCU with the ship as **base** loses upgrade value: it gets a warning instead ("Upgrade
  value −$20", without a known price "Upgrade value drops"), also when its value falls to $0 or
  below – a CCU already owned can still be applied. Its details offer **Keep the discount**
  (#252): a dialog with small images of both ships per pair of base and target ship. With the new
  price known, it recommends melting these CCUs before the increase and buying as many CCUs **to
  the rising ship** with the store credit they give back: those gain the discount the old ones
  lose (e.g. 8 × Prospector → Vulture for $5 each, −$5 of discount after the Prospector rises from
  $155 to $175, become 8 × Freelancer MAX → Prospector for $5 each, $20 of discount each after).
  The base ship is one you can always get onto later to apply the CCU (#263): the next ship below
  the rising one that is always available in the Pledge Store (the project website's ship facts),
  with a note saying so; without such data or ship, the next one on sale right now, with a note
  that it may not always be; ships about to rise are left out. Cheaper CCUs from the base ships
  in between are listed below as alternatives in a small table. For the recommended base ship and
  every alternative it tells how many of the ship you have in My Hangar, and how many CCUs to it in
  My Hangar and in the buy back. It shows the cost, the store credit needed besides the
  melt value (and the account's), the discount after the increase compared with keeping them, and
  how many of the old CCUs can be gifted – the new ones, bought with store credit, can't. It
  recommends nothing where keeping them leaves more discount, or while RSI sells no CCU to the
  rising ship. Without the new price it only warns that a discount may be lost, and tells when
  the target ship isn't flight ready yet (from RSI's Ship Matrix, the most current source; for ships it has no value for, from the project website's ship facts, #265), so its price will probably rise
  too. A suggestion only: nothing is melted or bought from there.
- **Base ship missing** and **Base always available** on CCUs, from the [CCU Check](#ccu-check).
- **Base ship leaves the store**: a warning triangle on CCUs whose base ship leaves the Pledge
  Store (see [Ship Removals](#ship-removals)).
- **Rebuyable** on pledges you can melt and buy again later without loss (see
  [Melt and Rebuy](#melt-and-rebuy)).

---

## Selection and summary

- **Select pledges** in "My Hangar" with the round control in the top right corner of each row.
  **Select all** above the list (#620) selects every pledge that search, filters and a
  [List Shortcut](#list-shortcuts) leave visible, and clears them again; pledges selected before
  and hidden now stay selected. In the [grouped view](#grouped-view) a group counts with all its
  pledges.
- **Sidebar** below RSI's page navigation on the left, a column of boxes:
  - **Notifications** (only while there is one):
    - When pledges [marked to melt](#mark-to-melt-later) can be melted now: how many, with two
      buttons. **Show** opens the [List Shortcut](#list-shortcuts) "Ready to melt" in "My Hangar";
      while it is on, it turns into **Show all** with a crossed-out filter icon and shows all
      again, like the × of the shortcut or "Reset filters". **Select** selects
      them, so the "Selected" box offers to melt them all at once with bulk melting on. It stays
      while there are any and can't be checked off.
    - When the [Paint Discount Planner](#paint-discount-planner) finds paints to buy again
      with more discount: how many (not with "Hide melt value"). Its **×** dismisses it for exactly
      these paints, kept in the sync storage so it stays dismissed on your other browsers too; it
      comes back with the count of all of them as soon as another paint can be bought again, or
      with "Show checked-off notifications again" in the settings.
    - When buy back pledges are [expected to cost more](#buy-back) within the period of the
      settings (14 days by default): how many, with **Show**, which opens the buy back with the
      filter "Price increase expected" on. Its **×** dismisses it for exactly these pledges (synced,
      like the planner's); it comes back with the count of all of them as soon as another pledge
      enters the period. Pledges whose price increase is over don't count any more. Once a pledge
      has less than 2 days left, a browser notification tells it too – one for all pledges crossing
      that limit at the same time, each pledge once; a click opens the filtered buy back.
    - Until browser notifications are on in this browser: a hint that they can be turned on, with a
      **Settings** button that opens the settings at "Browser notifications". Its **×** removes it
      (synced) until "Show checked-off notifications again" in the settings.
    - Other notifications, newest first, each removed with the **×** in its top right corner or all
      at once; removed ones don't come back on their own, only with "Show checked-off
      notifications again" in the settings, while they still matter. Changes in the Pledge Store (#164), found by its
      schedule around the full hour: **new and gone warbond CCUs** with their prices, and how many
      **Pledge Store items** changed, with the list (new, gone, new price, on sale) to open; both
      with **Show in Pledge Store**. Only new warbond CCUs also show as a browser notification –
      time-limited offers worth knowing while away; a click (or its button in Chrome) opens the
      Pledge Store tab at the warbond CCUs. Their texts, prices and lists follow the language set,
      also after a change of the language (only the browser notification keeps the language it
      was shown in). An **event** like the Intergalactic Aerospace Expo,
      once its notice starts (see [Pledge Store](#pledge-store-current-warbond-ccus)), with **Show
      in Pledge Store** – in the sidebar only.
    - Reminders of [watchlists](#watchlists) at their date, with **Show watchlist**, and changes
      of the Pledge Store items on watchlists with these notifications on (a new price, no longer
      or again on sale). Each goes with its ×; a new date or the next change brings it back.
    - Ships leaving the Pledge Store (see [Ship Removals](#ship-removals)) and CCUs that lose
      upgrade value with a price increase (the Price Increase Advisor).
    - When filler paints of the [Paint Discount Planner](#paint-discount-planner) are among
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
    off, one that leads to it. Further actions for the selection:
    - **Mark to melt** (#551) marks every selected pledge that can be melted and isn't marked yet
      (see [Mark to melt later](#mark-to-melt-later)) and says how many it marked and how many it
      left as they were (not meltable or marked already). When all of them are marked already,
      **Remove marks to melt** removes their marks.
    - **Add to a watchlist** (#549) puts the selected pledges on one of your
      [watchlists](#watchlists) or on a new one; those on it already stay there once.
    - With [Melt and Rebuy](#melt-and-rebuy) on, the box also tells the store credit the
      rebuyable pledges among them free.
  - **CCU Check** (while the hangar has CCUs): how many CCUs have no base ship, will soon have
    none, or have too few ways to it, with a button to the [CCU Check](#ccu-check).
  - **Paint Discount** (only while there is a paint to buy again): how many paints can be bought
    again with a higher volume discount and the store credit it frees, with a link to the
    [planner](#paint-discount-planner) and a filter button: **Show these paints** lists
    only them in "My Hangar" (its icon then shows the filter is on); **Show all pledges** or
    "Reset filters" shows all again, and so does the list once none is left. It opens the
    [List Shortcut](#list-shortcuts) "Paints to optimize".
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
    that cost more, don't count) and Price change ahead (#256: a price increase expected within
    the period of the settings changes its value – ships and items whose price rises, CCUs to
    them and CCUs from them; offered only while there are any).
- **Include or exclude**: each click on a filter cycles through off → only pledges with it →
  only pledges without it ("−Rewards" hides all rewards). All active filters combine with "and";
  one click on "Reset filters" turns them all off.
- **Refine a filter in its pill** (#419): while some filters are included, their pill gets a
  chevron that opens a short list of choices; the pill then names the choice ("Paints · Owned
  ships"). Excluding the filter or turning it off goes back to "all". The choices, each with its
  count:
  - **Ships** by kind (#514): all ships, **solo ships** (only the ship with its insurance and
    hangar items), **ships with extras** (gear, paints, a starter package with game access) and
    **ship packs** (two or more ships).
  - **CCUs** by base ship (#461), from the [CCU Check](#ccu-check): all CCUs, **without base
    ship**, **base always available** and **base limited** (not always available) – the last two
    only with "Consider always available ships" on. And by contents (#566): **solo CCUs** (also
    with an insurance) and **CCUs with extras** (a paint, gear). My Hangar shows both parts in
    the sections "Base ship" and "Contents", the Buy Back only the contents.
  - **Paints** by the ships you own (#336): all paints, **for owned ships** and **for ships not
    owned**. A ship counts as owned as a standalone ship, in a package or as the target of an
    applied upgrade in your hangar; a paint for several ships counts once one of them is owned,
    and a model code finds its variants (a C8 paint fits the C8R). The Buy Back goes by the ships
    of your hangar too. Rewards that hold a paint count as paints (#581).
- **Live counts**: each filter shows how many pledges it would leave in combination with the
  other active filters – a filter showing 0 would empty the list.
- **Sorting** at the top right of the list: newest or oldest first, highest or lowest value first,
  or highest discount first. The buy back sorts by date only, as RSI shows no value there. The
  choice is kept per list.
- **Highlights**: while a filter is included or a sorting chosen, the rows highlight the values it
  is about, so the list shows at a glance why each entry is there – a stronger color and weight,
  no boxes of its own. In My Hangar: the value for Giftable, Meltable, Valuable, Warbond and the
  value sortings, the discount for Discount and its sorting, the Gift and Melt tags, the insurance
  for LTI, the game access lock for Game access, the price increase tag for Price change ahead.
  In the buy back: the price for Warbond and Available, the "Probably giftable" label, the price
  increase tag for Price increase expected and the insurance for LTI. Excluded filters highlight
  nothing. Which filter highlights what is one list in `config.ts` (`FILTER_HIGHLIGHTS`).
- Thousands of pledges stay fast: rows are drawn while scrolling, in small steps between frames.

## Grouped view

**Group** above the list (#445) shows equal items as one row with their count, e.g. all CCUs from
the same ship to the same ship – in My Hangar, the Buy Back, the [CCU Check](#ccu-check) (on there by default)
and the [watchlists](#watchlists), each remembered on its own.

- **What forms a group**: CCUs by base and target ship; ships and packages by their ships and the
  pledge's name; gear, paints and the rest by name and kind. Upgraded pledges group by what they
  are now. Extras don't split a group, the row names them instead: "some with gear", "some with
  BIS paint", "different insurance", "some upgraded". A group of one is a single row.
- **The group row**: the count, the name, the image and the ships as in a single row, and the
  sums of the value (in the Buy Back the buy back price) and the discount. A sum that misses a
  value sums the known ones and says how many are missing ("$120 + 2 unknown"). No pledge IDs or dates.
- **Labels taken from the items** (#487): "Gift", "Melt" and the others when all items have them,
  "Some gift", "Some melt", "Some base ship missing" and so on when only some do (the tooltip
  says how many), crossed out when none does. A refund countdown shows the shortest of its items,
  with how many can still be refunded. Marks to melt (#552) show as one label with the earliest
  and latest time ("Melt in 3 hr – 21 hr", "Melt now – 21 hr", or "Melt now" when all are ready)
  and a small count of the marked items; its tooltip says it in words ("4 of 12 marked to melt,
  the first ready in 3 hr").
- **Expand or open** (#488): a click expands the group in the list with its items as normal rows;
  a button opens it in a dialog with the sums and labels on top and every item below, with its
  pledge ID, details and buttons (exchange, gift, ship upgrade, …). An expanded CCU group shows the
  section **Base ship** for the whole group ("2 of 5 covered", #574).
- **Selection**: a group selects all its items at once; items selected in the dialog are selected
  in the list. A jump to a single pledge (e.g. from the CCU Check or a notification) opens its
  group with the pledge highlighted.
- Search, filters, List Shortcuts and sorting work as without groups.

## List Shortcuts

A List Shortcut (#427) opens My Hangar or the Buy Back with a named list: a bar above it shows
its title, icon and count, and its × (or "Reset filters") leaves it. Search, filters and sorting
work within it, and it stays while you switch tabs. When nothing is left in it, it says so. The
shortcuts:

- **Ready to melt**: the pledges [marked to melt](#mark-to-melt-later) that RSI lets you melt now,
  from the sidebar's notification.
- **Paints to optimize**: the paints the [Paint Discount Planner](#paint-discount-planner) would
  buy again, from the sidebar box and the new plan's "Show these paints" (#430).
- **Melt and rebuy**: the pledges you can melt now and buy again later without loss (see
  [Melt and Rebuy](#melt-and-rebuy)), with the store credit they free.
- **CCUs incompatible with a warbond CCU** (#429): "Show in My Hangar" of a warbond CCU's "Your
  CCUs between" lists your CCUs that overlap its price range.
- **CCU Check**: "Show N CCUs in My Hangar" of a group or base ship, and a base ship's "Buy Back",
  which opens its ships and CCUs in the Buy Back.

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
It melts at most a set number of pledges at once – **Most pledges per bulk melting**, 10 by
default, 2 to 99, below the setting. With more selected the button can't be used and says to
select fewer or raise the limit, with a button to the setting; the dialog checks the limit again
right before melting. Keep it low, or raise it only for a single melting: RSI's website melts each
pledge with a request of its own. The Paint Discount Planner's filler paints keep their own
number, at most 9.
With it off, the "Selected" box shows **Bulk melting disabled** instead (with meltable pledges
selected): a click opens the settings at the setting and marks it for a moment.

**Checked right before melting** (#415): after "Melt" and your password, and before the first
request, the pledges of the dialog are read from RSI again – only the list pages that hold them.
Each has to be there with the same ID, name, value and items, and still be meltable; otherwise
nothing is melted, and the dialog names each pledge that changed or is gone, and what changed
(e.g. an upgrade applied in "My Gear" or in another tab meanwhile). The stored hangar is updated
with what was read. If RSI can't be read (signed out, network error), nothing is melted and the
dialog says why. The filler paints of the Paint Discount Planner are checked the same way.

## Account Safety

CIG's Terms of Service forbid bots, and it isn't clear whether the smart updates could count as
one. The Hangar Manager sends as few requests to RSI as it can, never buys anything on its own
and gives no advantage over other players. Account Safety (#329) adds:

- **A note on the Terms of Service** (#330), with a link to them, in the settings under "About",
  below the version.
- **A question before bulk melting is turned on** (#331): it exchanges several pledges in a row
  with one click, RSI may count this as a macro under its Terms of Service, and melting can't be
  undone. Only **Turn on** turns it on; an imported settings file never does.
- **A check of the pledges right before bulk melting** (#415) and **a limit of how many pledges
  melt at once** (#622), both described above.

## Mark to melt later

RSI lets a pledge be melted only 24 hours after it was bought (with store credit or money). **Mark
to melt** under the image of a meltable pledge keeps it in mind: a badge in its row counts down
("Melt in 5 hr 12 min") and turns into **Melt now** once RSI allows it; its tooltip gives the exact
time. The purchase time comes from the pledge log; with only the purchase date, the end of that
day counts, and as RSI doesn't say which time zone it uses, the later reading counts – the badge
may turn a little late, never too early. The mark goes once the pledge is gone from the hangar.
The marks are kept in the browser's sync storage, so they follow your browser profile to your
other devices; in the demo mode the marks are the demo's own. Once marked pledges can be melted, the sidebar's
**Notifications** box says how many, with **Show** to list just them. The sidebar's "Selected" box
marks or unmarks all selected pledges at once (see [Selection and summary](#selection-and-summary)),
and a group of the [grouped view](#grouped-view) shows the times of its marked items.

## Melt and Rebuy

Melt and Rebuy (#527) finds the pledges you can melt now and buy again later in the Pledge Store
with store credit, without losing anything – e.g. to free store credit for an event and get the
same items back afterwards. A pledge counts as **Rebuyable** (#528) when all of this holds:

- it can be melted now: RSI offers the exchange, it was bought at least 24 hours ago, it is no
  protected game access and no reward, and no refund period still runs (melting ends it);
- it isn't giftable: bought again with store credit, it never could be again;
- it is a single paint, a standalone ship with its insurance only (not upgraded) or an unapplied
  CCU – no package, pack, gear or extra items;
- the Pledge Store sells exactly this item now (a CCU: RSI's upgrade tool, target pricier than
  base), with the same insurance or a better one, for the pledge's value or less – a discounted
  pledge (warbond, sale) would cost more;
- it stays available: no price increase (confirmed or expected) and no removal ahead for the ship,
  the CCU's base or target, and the ship is always available, not only on sale during an event.

Data the extension doesn't have yet (a store price, the ship facts) counts as not rebuyable, with
the reason "not known". Nothing extra is read from RSI for it.

- **The label** "Rebuyable" in the row, with a tooltip of the store credit melting frees and what
  rebuying costs now. Opened, a pledge that isn't rebuyable says why, with every reason at once
  (e.g. "Giftable", "Upgraded", "Not on sale now"). A paint bought at a volume
  discount (#593) says how many paints it needs in one cart to come back at its price. A group
  of the grouped view shows "Some rebuyable".
- **The List Shortcut** "Melt and rebuy" (#530), from the button in the sidebar's "Summary" box:
  only the rebuyable pledges, with the store credit they free. Its bar offers **Put on a
  watchlist to rebuy** (#531).
- **A watchlist to rebuy them**: the dialog puts them on an existing watchlist or a new one
  ("Rebuy after …"), as the Pledge Store items they are rebought as, each with its count, and can
  also mark them to melt – melting itself stays with RSI's dialog or bulk melting. The watchlist
  shows the total now against your store credit, each item's price when added, and items that
  can't be bought at that price any more. **Add to cart** fills RSI's cart from it (see
  [Watchlists](#watchlists)).
- **Show rebuyable pledges** under "My Hangar and Buy Back" in the settings (on by default) turns
  the label, the shortcut and the reasons off.

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
Paints, Game access, LTI, Warbond, Probably giftable, Available, Price increase expected, Rewards),
plus:

- **Probably giftable**: a pledge bought back keeps the giftable status it had when it was
  melted, and RSI then offers "Buying as a gift?" at checkout (see RSI's
  [Gifting FAQs](https://support.robertsspaceindustries.com/hc/en-us/articles/115013325608-Gifting-FAQs),
  "If I use the Buy Back Tool to recover a pledge, can I gift it to someone else?"). Only pledges
  bought before 30 Oct 2026 with money alone were giftable: any store credit, a gift received or a
  later purchase makes them ungiftable. So a pledge is marked if its order – known from the order
  history, all pledges of one order alike – was paid with money only before that date, without a
  further request to RSI. For pledges melted from now on the extension keeps RSI's own gift flag
  from My Hangar, which decides instead. "Probably", as a pledge may have lost the status in other
  ways (e.g. gifted once already), and buying back with store credit makes it ungiftable.
- **Not available**: RSI sells a CCU only from a cheaper ship to a more expensive one, at today's
  standard prices. A CCU whose base ship now costs as much as its target ship or more can't be
  bought back: it is labelled, its tooltip compares both ships' prices today, its "To Cart" is
  disabled, and it is never probably giftable. The filter **Available** shows only the pledges RSI
  can sell again, or, excluded, only those it can't.
- **Price increase**: a warning with a countdown on ships, packages, CCUs and related items (e.g.
  modules) whose price is expected to rise soon – buy them back or use them as a discount token
  before then. With a probable time it counts the days, on the last day hours and minutes and in the last hour
  minutes and seconds (`46:12`);
  otherwise it shows the day. Its tooltip gives the expected date, the expected flight ready date
  for ships not flight ready yet and a note, and says that the dates are expected, not confirmed
  by RSI. Where the new price is announced, it shows the change like My Hangar (#251): "Price
  +$20" on a ship, "Upgrade value +$20" on a CCU to it, and a warning "Upgrade value −$20" on a CCU
  from it – once its value falls to $0 or below, RSI can't sell it back any more (see **Not
  available**). The filter **Price increase expected** shows the pledges whose price is expected to rise
  within the next 14 days (set in the settings), and the CCUs from such a ship (#256); it is offered only while there are any. The
  project publishes the expected price increases on its website (`data/price-increases.json`),
  as RSI rarely lists them in advance.
- **Buy back tokens**: how many pledges can still be bought back with store credit, as RSI shows
  it above its buy back list – at the top right of the manager, on every tab (see
  [The Hangar Manager page](#the-hangar-manager-page)).
- **To Cart**: a button in the opened item, under "Show in Buy Back": one click puts a buy back
  pledge – or a buy back CCU – into the RSI cart and opens it, without going through RSI's pages.
- **Show in Buy Back**: opens the pledge on RSI's own buy back page (only this pledge, or the list
  page with the pledge highlighted).
- Insurances, ships and orders as in "My Hangar".

---

## Watchlists

The tab **Watchlists** (#464) collects items of My Hangar, the Buy Back and the Pledge Store under
a name of your choice, e.g. "Melt after the IAE" or "CCUs to buy when back in stock".

- **A watchlist** has a name, an optional description and an optional date (e.g. the end of an
  event) with a reminder. It shows its items with their search, filters and grouped view (hidden
  until you show them), and items no longer in My Hangar or the Buy Back say so ("No longer in My
  Hangar", "Now in the Buy Back").
- **Pledges and buy back items**: a notepad icon in the row of an item on a watchlist names its
  watchlists; opened, the item shows them, and it goes on another one or a new one from there. The sidebar's "Selected" box
  puts the whole selection on a watchlist (#549).
- **Pledge Store items** (#470): CCUs from the Pledge Store tab (the warbond CCUs and the table of
  all ships), standalone ships with their insurance and paints, each with a count – e.g. to buy a
  CCU three times once it is on sale. The watchlist shows each one's current price, whether it can
  be bought now, its price when added and the total now.
- **On RSI's own pages** (#471, #632): a **Put on a watchlist** button in RSI's look on a paint's
  page, on the cards of paints and standalone ships in the store's lists (icon only) and left of
  "Add To Cart" in RSI's ship upgrade dialog. A small window grows out of the button with the
  item's watchlists, adding to one and a new one; ×, Escape or a click elsewhere close it.
- **Reminders** (#469): at the date, a sidebar notification and, if allowed, a browser
  notification open the watchlist. Where the reminder is set, it says whether browser
  notifications are allowed in this browser, with a button to allow them.
- **Pledge Store changes** (#472): on a watchlist with these notifications on, a new price, an
  item no longer on sale or on sale again shows in the sidebar and, if allowed, in the browser.
  Both kinds can be turned off in the settings ("Watchlist reminders", "Pledge Store changes on
  watchlists").
- **Add to cart** (#529): puts the paints and standalone ships of a watchlist with their counts
  into RSI's cart, after showing what is still on sale, the total and your store credit. Items
  already in the cart stay; CCUs go through RSI's ship upgrade dialog. It says what went in and
  what RSI refused, with a link to the cart. Nothing is bought: you check the cart and pay there.
- **Select all** (#620) and a checkbox on every item: hangar items join the "Selected" box of My
  Hangar, and **Remove from this list** removes the selected items from this watchlist only,
  after a question when several go.
- **The Paint Discount Planner's filler paints** (#473) get a watchlist of their own once they
  are bought, with a reminder 24 hours after the order, when RSI lets you melt them.
- Watchlists are kept in the browser's sync storage and follow your browser profile to your other
  devices; a watchlist that wouldn't fit says so and changes nothing.

---

## Pledge Store: current warbond CCUs

**Events** come first while there are any: Star Citizen events like the Intergalactic Aerospace
Expo, when the Pledge Store usually has new ships and daily warbond offers. The list is a small file
on the project website (`data/events.json`), read every two hours (more often in the afternoon and evening, when the Pledge Store changes) and kept in the browser – data
only, checked field by field, its texts shown as plain text, in the language set. Each event shows
from a few days before it starts until it ends, with its name, start and end, a description and
image if given, and a live countdown to its start (with the first phase, e.g. "starts in 3 d
05:20:26 with RSI"). While it runs, it shows its current phase (e.g.
the manufacturer of the day), a countdown to the next one (the next manufacturer, "Best in Show",
the finale) and one to its end. Once its notice starts, the sidebar tells it once (the kind
"Events" in the settings); the notification follows changes of the file, e.g. a moved date, and
goes away on its own once the event is over.

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
always read both; the count line says when the offers were updated.

Below the events, the warbond CCUs have two views, chosen with tabs: **Current Discount CCUs** –
the warbond CCUs RSI sells now and the CCUs to secure before a price increase – and the **Warbond
CCU History** with the offers that are over (both below). A notification about new warbond CCUs
opens the current ones. For each warbond ship:

- **Prices**: the warbond price, the standard price (struck through) and the discount in dollars
  and percent, with the ship's image.
- **Expected end** (#569): when the warbond history knows when an offer is expected to go, a
  countdown says so ("Expected gone in 21 d", on the last day hours, minutes and seconds), with a
  tooltip that gives the date and time and says that it is expected, not confirmed. Offers without
  an expected end show none, and the countdown goes once its time has passed.
- **Sorting** (#628): with more than two offers, a menu next to the heading sorts them – ending
  soonest (the default) or latest first, lowest or highest ship value first, or highest discount
  first. Sorted by the end, offers without an expected end follow, the cheapest ship first.
- **In hangar**: tags with your hangar's CCUs straight to the ship ("2 to Liberator"), from the ship
  to another one ("2 from Liberator", #399; the buy back's don't count) and the other CCUs in its
  price range that can't be chained with it ("13 incompatible"); each only when there is one.
- **Warbond upgrade** (#392): opens RSI's own ship upgrade dialog with the warbond edition of the
  ship already chosen as target – only the ship to start from is left to pick. In the demo mode the
  upgrade buttons are disabled, since RSI's dialog shows your real ships and CCUs.
- **Cheapest warbond CCUs** (in the opened item): the discount is the same whichever ship you start
  from, so the CCU from a more expensive ship costs less. The 10 ships with the cheapest CCU are
  listed with the CCU's price, a check for the ships always available in the Pledge Store (so you
  can get onto them later to apply the CCU; from the project website's ship facts) and how often
  you already have each ship in your hangar and buy back – as a ship and as the target of a CCU –,
  to choose the ship to buy the CCU from. A click on a ship opens RSI's ship upgrade dialog with
  that ship as base and the warbond edition as target, both already chosen. The CCUs to secure
  before a price increase (below) use the same table.
- **Your CCUs between the warbond price and the standard price**: every warbond CCU spans this
  range, whatever ship it starts from. The CCUs of your hangar that overlap it can't be chained
  with it, so you see at a glance how many discounted CCUs you already have there – in a small
  table with their ship prices, count, value and discount in dollars and in percent. A click on a
  column head sorts the table by it, a second click reverses the order (#395): numbers start with
  the highest, names with A; a surcharge counts as a negative discount, CCUs without a known
  discount come last. The order applies to the tables of all warbond CCUs and is kept. CCUs ending
  at or below the warbond price (e.g. to a ship listed above) are left out: they can be chained.
  The count is also a tag on the item.
- **Earlier offers** (in the opened item): since when this offer was seen – with the event running
  then, if any – and the earlier offers of the same ship, also at other prices, or "No earlier
  offer of this ship seen yet".

The **warbond history** behind it: the Hangar Manager remembers every warbond offer it sees, with
price, standard price, first and last sighting and the events running meanwhile – in this browser
only, as no public record of past offers exists, so the list grows over time. Earlier offers
collected on the project website (`data/warbond-history.json`, read once a day) are added; an own
sighting of the same offer at the same time counts instead of the website's.

The view **Warbond CCU History** lists the offers RSI no longer sells, each with the ship, its
manufacturer, the warbond and standard price, the discount, when it was seen and its events. A
**period** narrows it – the running event's period (offered while an event runs), the last 30, 90
or 180 days –, a search finds ships and manufacturers, and the list sorts by date, standard price
or discount, each way round. The count line says how many offers show ("3 of 12 expired offers").

Below the current warbond CCUs, set apart, **CCUs to secure before a price increase** (#253): for
every ship whose price is expected to rise (the project website's list, see [Buy back](#buy-back))
and to which RSI sells CCUs right now – for every user, whether or not the hangar has CCUs to it. A CCU bought now
keeps its price, but its upgrade value grows with the ship's: that is the discount. Each ship shows
its price now and after (if announced), the countdown to the increase with the gain ("Price +$20:
7 days"), and **Ship upgrade** with the ship as target – with **Warbond upgrade** left of it
while a warbond CCU to the ship is offered (#392). Opened, it lists the 10 cheapest CCUs to it,
like the warbond CCUs, with the gain per CCU and how often you already have each base ship in your
hangar and buy back. Ships about to rise themselves aren't offered as base ships; a ship disappears
once its price increase is past.

A ship RSI sells **no CCUs to right now** (e.g. before it is flight ready) is listed as well when
your buy back has CCUs to it (#311): "No CCUs on sale · 2 in your buy back", without the "Ship
upgrade" button. Opened, it lists those buy back CCUs by base ship, the cheapest first, with their
buy back price (its source in a tooltip; without a known price last), the base ship's price,
whether it is always available and the count – CCUs RSI can't sell again are left out. Bought back
before the increase, they keep their price and gain the upgrade value.

### All ships by value

**All ships** (#385, #452), a button above the Hangar Manager left of "Ship upgrade", opens a table of every ship of
RSI's upgrade tool, the cheapest first, with a line at every $100. Each ship shows its value and
current warbond price (with what it saves), whether it is always available or not sold any more
(both from the project website's ship facts, the Star Citizen Wiki; ships no longer sold are
faded), how many standalone ships of it and CCUs to and from it your hangar and your buy back
have (tinted green and orange while they have any), and in the Pledge Store "Warbond" and
"Standard" or "Ship upgrade" for RSI's dialog, else "Not on sale now". Above it, a search finds
ships by name and manufacturer, the filters "Always available", "On sale", "Warbond", "Price
increase", "Leaving" and "In my hangar or buy back" narrow it, and the value range is chosen on a
slider below a histogram of the ships per $50. Like the filters of My Hangar, each filter
includes or excludes ("not Warbond", #413). A ship whose price rises shows the increase with its
countdown, and the new price if it is known; confirmed by CIG and only expected ones each say so.
A ship leaving the Pledge Store shows its date and countdown (#410). A click on a column head
sorts by it, a second click reverses the order (#406).
Counts of 0 show as a faint dot, lists not read yet say so. The head stays in view while the table
scrolls, also sideways on narrow windows; dollar amounts follow the setting that hides them. In
the demo mode the counts are the demo's and the upgrade buttons are disabled.

### Ship Removals

Below them, whichever view is shown, the **ships leaving the Pledge Store** (#288, part of Ship
Removals #285): ships CIG takes out of the store for good, e.g. the Constellation Mk IV when its
retirement window ends. They come from the project website's list and are grouped by date ("Jan
27, 2027 · 4 ships"); each ship shows the date, the countdown ("Removal: 71 days", in the last
hour "46:12") and a link to CIG's announcement; while RSI sells CCUs to it, its button "Ship
upgrade" (#391) opens RSI's ship upgrade dialog with the ship as target, "Warbond upgrade" (#392)
with its warbond edition while one is offered. A CCU from such a ship can afterwards only be
applied to a pledge with the ship you already have, or get with a CCU to it. Opened, a ship shows
your CCUs from and to it (#380) in a table – in the hangar, in the buy back and together – and
whether that is enough for the CCUs from it in your hangar – those in the buy back aren't yours
and don't count –, or how many CCUs to it are missing and until when to secure them. A ship disappears
once its date is past. The demo mode has removals of its own (#292), made for the demo hangar and
buy back, with dates ahead of today; with "Show real Pledge Store data" it shows the website's.

In **My Hangar**, a CCU whose base ship leaves the Pledge Store shows a yellow-orange warning
triangle (#289), red when you have fewer CCUs to that ship than from it in your hangar; its
tooltip names the ship and the date. Expanded, the CCU tells how many CCUs to that ship are in your
hangar and your buy back – the ways to get a ship to apply it to later. Its button "Show in Pledge
Store" (#381) opens the ship under "Ships leaving the Pledge Store", expanded with its table.

The **sidebar** tells each date in one notification with all ships removed on it (#290), and
**Show in Pledge Store** opens the section. Below the text all ships of the date are listed: first
those with CCUs from them in your hangar, with their counts ("Constellation Mk IV Taurus: 3 CCUs from it, 1 to it"), each
triangle yellow-orange or – with fewer CCUs to the ship – red; the notification's icon takes the
highest level; then the others by name. Its × closes it for these ships on this date: a new ship or another date brings it
back. It can be turned off in the settings ("Ships leaving the Pledge Store").

With browser notifications on, a **browser notification** tells each date a week before it (#291),
also while no RSI page is open: "The Constellation Mk IV Andromeda, … leave the Pledge Store on Jan
27, 2027." Each date is told once for its ships; a click opens the section of the Pledge Store tab.
It goes away once the date has passed or the Hangar Manager is seen. Never in the demo mode.

A ship leaving the store that is **on sale right now but not always available** (#293) may be
gone before its date, e.g. when the event it is sold in ends. The section, the CCUs in My Hangar
and the sidebar notification say so ("The Constellation Mk IV Andromeda is on sale right now, but
isn't one of the always available ships."), during an event also when it ends ("It may not be on
sale any more once Intergalactic Aerospace Expo 2956 ends on November 27, 2026."). The ships on
sale come from RSI's upgrade tool, which ships are always available from the ship facts of the
project website; without them there is no note.

## CCU Check

A CCU only works on a pledge with its base ship – in your hangar, or reached with a CCU to it. The
**CCU Check** (#106) in the tab **Tools** asks "Can you apply every CCU?" and answers it for every
CCU of your hangar.

- **Base ship coverage** (#108): each CCU is covered by your hangar (a ship, a package, an
  upgraded pledge or a hangar CCU to the base ship, which chains), else **only via buy back** (a
  ship or a CCU RSI can sell again), else by a base ship that is **always available** in the
  Pledge Store (the project website's ship facts, from the Star Citizen Wiki), else it is
  **without base ship**. Each ship or CCU to a base ship gives it to one CCU from it, so a base
  ship can be short of ways although some exist.
- **On the CCU rows in My Hangar**: the section **Base ship** of an opened CCU (#111) shows how it
  is covered, with a card per ship or CCU that covers it (#426: base and target ship, value or buy
  back price, discount or surcharge, giftable or not), each opened in My Hangar or the Buy Back
  and back again (#436). CCUs without coverage get the label **Base ship missing** and a note with
  a link to the base ship in the Pledge Store (#114); CCUs whose base ship RSI always sells get
  **Base always available** (#112).
- **The tab** (#113, #563): a bar of how many CCUs are covered in your hangar, by always available
  ships, only via buy back and not at all, and the groups as sub tabs with their counts: **No base
  ship**, **Buy back only**, **Always available** and **Discount at risk**. Each group has a
  heading, its count and a short hint; **Show N CCUs in My Hangar** opens them as a
  [List Shortcut](#list-shortcuts). The [grouped view](#grouped-view) is on here by default.
- **Simple view**: a card per base ship with its image and price, whether it is on sale now or
  always available, the ways to it in your hangar and buy back as small images ("+3" for more)
  and the CCUs from it. Its buttons open the CCUs in My Hangar, the ships and CCUs to it in the Buy
  Back, RSI's ship upgrade dialog ("Ship upgrade"), or the ship in the Pledge Store.
- **Deep view**: follows whole chains. Every CCU with a discount needs a way to its base ship – a
  ship, or a chain of CCUs from your hangar, your buy back or an always available ship; CCUs
  without a discount only link chains and aren't counted. The tab **Too few ways** lists the
  base ships with fewer ways than CCUs, each with a bar (ship and chain in your hangar, buy back,
  too few), the chains as chips and why a way doesn't count ("taken by other CCUs from it", "has
  no way itself"). It also finds base ships the simple view counts as covered whose ways have no
  way themselves ("Found by the deep view"), follows CCUs in your buy back to their base ship
  (#651), and names a link that would make them count ("Or make your buy back count"). **Secure
  now** shows what securing the missing ways costs with store credit – from the next cheaper always
  available ship (safe) or from the next cheaper ship (cheapest) – against your store credit, or
  "Not on sale now" for a ship RSI doesn't sell at the moment. The views are a toggle, **Simple |
  Deep view**, and the choice is remembered.
- **Soon without base ship** (#454): CCUs covered today only because RSI still sells their base
  ship, which leaves the Pledge Store (see [Ship Removals](#ship-removals)): per base ship the
  date and countdown, how many ways are missing, "Ship upgrade" and a link to the ship.
- **Discount at risk** (#455): CCUs whose base ship gets more expensive within the period of the
  settings lose upgrade value, and with it their discount. Each shows the price increase, confirmed
  by CIG or only expected, the discount today and after, and the way to keep it from the Price
  Increase Advisor: "Keep the discount" with the giftable trade-off and a note when the store
  credit isn't enough, and the CCUs to secure in the Pledge Store tab.
- **In the sidebar** (#115): a box with how many CCUs have no base ship, will soon have none or
  have too few ways, with a button to the CCU Check.
- **Settings** (under "CCU Check"): **Consider always available ships** (on by default). Off,
  every CCU without its base ship in your hangar or buy back counts as missing, and the label
  "Base always available" goes. Below it, the source of the list with its date and license.

### CCUs in RSI's ship upgrade dialog

RSI's own ship upgrade dialog – on "My Gear", in the Pledge Store and from the Hangar Manager –
gets labels from the Hangar Manager, added from outside, in the dialog's look:

- **Counts on the base ships** (#506): how often your hangar has the ship and how many CCUs to it
  are in your hangar and your buy back (only those RSI can sell again), e.g. "2 owned · CCUs 1 + 7",
  with a tooltip. Each ship or CCU to it gives the ship to one CCU from it, so you see while
  choosing which pledge to upgrade whether a ship is scarce as a base. Without a stored buy back
  that part is left out.
- **Always available** (#401) on base and target ships the ship facts list as always available.
- **A countdown on target ships** (#570) that aren't always available while an event runs:
  "Expected gone in …", to the event's end, or to the expected end of its warbond offer when that
  is known. Its tooltip gives the date and its source and says that it is expected.
- In the demo mode the counts are the demo's own, and "My ships" of the dialog is disabled, as it
  lists the ships of your real account (#586).

Each can be turned off under "RSI website" in the settings.

## Paint Discount Planner

RSI gives a volume discount on paints in the cart: 15 % from 2 paints, 20 % from 3, 25 % from 5,
30 % from 7 and 35 % from 10. The tab **Tools** shows how to turn it into store credit with
the paints you already own, next to the CCU Check (#453): each tool shows only while it
has something to offer – the Paint Discount Planner while paints can be bought again for less,
a plan runs or there are completed plans –, with a sub tab and its count for each; a single one shows its name as the
heading instead:

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
- **Giftable paints are left out** by default, as they would lose that status; the planner says
  how many. Turned off (in the planner or the settings), they are included and marked
  "Giftable".
- **Order**: fill the cart and check it first, melt only after that.
- **Tabs** (#244): the planner shows the **Running plan**, a **New plan** and the **Completed
  plans** in tabs, each only while it has something to show. With a single one there are no tabs,
  only its heading; without any, it says why no plan is possible. A plan that starts running is
  shown first.
- **Start plan** (#317): a new plan only shows what it would do; its button **Start plan** keeps
  it with its way and the store credit it starts from, and shows it as the running plan, step by
  step. Nothing goes into the cart and nothing is melted before; a plan runs only once it was
  started, until it is completed or discarded. While another plan runs, it asks first, since the
  new one replaces it. In the demo mode it starts the demo's own plan.
- **Running plan** (#245): one card with the way ("Running plan · Buy first"), since when it
  runs, the store credit when done and a bar of the steps done. Its steps follow the way – buying
  first: fill the cart and check it, pay with store credit, melt the old paints, melt the fillers
  after 24 hours; melting first: melt your paints, buy the paints, melt the fillers. The current
  step is open and checks what it needs on every refresh: whether all paints are in RSI's cart
  (read while the Pledge Store tab is open), whether other items in the cart change the tier,
  whether the store credit is enough, whether prices changed or a paint is no longer sold on its
  own – with the paints listed and what is wrong with each. It offers what helps: put the missing
  paints into the cart, go to the cart and pay, melt (bulk melting), read the cart or the store
  credit again, or **Recalculate** for today's prices and store credit, keeping the paints
  already melted. The purchase is found in the hangar and orders on the next refresh; the filler
  paints then count down RSI's 24 hours. **Discard plan** ends it after a question: nothing in the
  hangar or cart changes, pledges marked to melt stay marked. Hidden while the melt value is
  hidden.
- **Completed plans**: every plan carried through, the newest first, with its way, date, the own
  and filler paints, what was melted, bought, freed and paid and the discount reached; on top how
  many plans there are and the store credit they freed in all. Each opens for its details; the
  newest one starts open.
- **Into the cart** (a step of the running plan): one button puts all paints of the plan – the own paints and the fillers with
  their counts – into RSI's cart, with the requests RSI's own paint pages send, and opens it.
  Nothing is bought: you check the final price and every paint there and pay with store credit.
  The cart is read first: if it already holds items, which would change the tier, it says so and
  offers to open the cart, add anyway or cancel. A paint RSI refuses (e.g. no longer available)
  is listed with RSI's reason, and the cart isn't opened on its own then. The plan is kept in the
  browser's sync storage (Settings → Stored data → "Synced with your browser profile"), so the
  filler paints can be found again later, also on another device.
  Disabled in the demo mode.
- **Two ways**: buying first and melting after (recommended, safer, but the store credit of the
  own paints isn't free for the cart yet), or melting first and buying after.
- **Choose a way** (the default layout of a new plan; the setting "Layout" switches to the two
  below): both ways as two choices with what each frees, its tier, paints and what it needs
  upfront. The recommended one is chosen – buying first where the store credit pays it; a way
  that doesn't work is disabled and says why ("Needs $… more store credit"). Below, only the
  chosen way: its steps with the store credit after each one, a chart of the store credit along
  the way, a hint, "Start plan", and its cart as cards with the tier it reaches (and the tier of
  the other way, if different). The store credit the ways start from shows next to the title.
- **Both ways side by side** (the layout "Both ways side by side"; a third one shows the plan and
  its paints in tables):
  - **Buy first** pays the whole cart from the store credit before any paint is melted, so it
    takes the best tier the store credit pays alone – the same as melting first, a lower one, or
    none ("Needs $… more store credit").
  - **Melt first** fills the cart, melts the own paints (with bulk melting on) and pays with
    their melt value.
  - On top, the store credit each way frees and the discount tiers they reach. Below that, the
    cart as cards: own paints ("Yours") and fillers, with the standard price and the price in the
    cart – for both carts when the tiers differ.
  - When the ways differ, "Why they differ" compares what each needs before melting with the store
    credit there is. Each way has its own card: discount, store credit freed, what it needs
    upfront, its steps with the store credit after each one, a hint and "Start plan".
  - A chart shows the store credit along both ways, and short notes say what to know before you
    start.
- **Melt the own paints at once** (a step of the running plan, with the experimental bulk melting
  on): a button opens the bulk
  melting dialog with exactly the own paints of the plan and the store credit they give. Once these
  paints were put into the cart, the dialog asks to confirm that the cart was checked. Before that
  the button melts them first (way 2), with its own acknowledgement: buy them again right away.
  The running plan knows the paints to buy again although the hangar no longer shows them.
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
- **Left to buy** (in the running plan of melting first): own paints of the plan that are gone from the hangar – melted – and not
  bought again since are listed with the tier the store credit pays now (fewer filler paints if it
  is short; it says what the planned tier misses) and their own "Put the paints into the cart"
  button, which keeps the tier and fillers really put into the cart. Afterwards the hangar is read again, as after every bulk melting. With bulk
  melting off, **Bulk melting disabled** opens the settings at that setting instead.
- **Bought again**: once the paints were bought, the hangar holds each own paint twice – the old
  pledge without the discount and the new copy with it. The planner pairs each copy with one
  old pledge of the same paint (the oldest one with less discount; the copy is younger). By
  default a pair counts only when the old pledge was in a plan that was started
  and the copy was bought that day or later; the setting "Paints bought again" can also show other
  pairs as a guess to check, which change nothing. For a counted pair it shows
  "cart filled" and "bought" as done, with the date, and only "melt the old paints" as open, with
  the store credit it gives. Melting them is safe – the paints are in the hangar again – so a
  button melts them at once (with bulk melting on; otherwise it leads to the setting). The pairs
  are not planned again; other paints can form a new plan next to them. In My Hangar the old
  pledges carry "Melt – bought again at 35%", and the sidebar box counts them.
- **In My Hangar**: the paints it would buy again carry a tag "Rebuy 0% → 35%" (their discount now
  and then; its tooltip says the store credit freed), which opens the planner. The filter
  button of the sidebar box **Paint Discount** shows just them.
- Only pledges with exactly one paint that can be melted, and single paints of the Pledge Store;
  paint packs come later. Hidden while "Hide melt value" is on.

### Paint discount note in RSI's cart

While RSI's cart holds paints that don't get the best volume discount (#458), a note in the cart
shows the tiers – how many paints each needs and where the cart stands – and the filler paints
that reach a better one: the cheapest paints, at most 5 of one (RSI's limit), e.g. 5 of the
cheapest and 3 of the next. It says what that saves and what it costs of your store credit, or
how much store credit is missing; without a known store credit it asks to open the Hangar Manager
once. **Add filler paints for the best discount** puts them into the cart with the Paint Discount
Planner's requests; the planner keeps them and marks them to melt once you bought them. Nothing
is checked out. In the demo mode the button is disabled, as it would change your real cart. The
note can be turned off under "RSI website" in the settings ("Show the paint discount in RSI's
cart").

---

## Links to RSI and other sites

- **Show in My Gear / Show in Buy Back**: opens the pledge on RSI's original page, scrolled to it
  and highlighted – also when it moved to another page in the meantime.
- **Ship upgrade** (#374): above the Hangar Manager on the right, outside its tabs so every tab has
  it, opens RSI's ship upgrade dialog without a preset ship, as the button of RSI's "My Gear" does. A CCU bought there shows
  in My Hangar with the next smart update. Disabled in the demo mode: RSI's dialog shows your real
  ships and CCUs.
- **External links**: ships link to their pages on **erkul.games** and **FleetYards.net** (can be
  turned off in the settings).
- **CCU Game** (ccugame.app): in CCU Game's detail view of an item (ships, CCUs, paints, equipment
  and more), the extension adds a link **"Open in Hangar Manager"** right below CCU Game's link to
  RSI. It opens the pledge directly in the Hangar Manager – found by its pledge ID and opened –
  for hangar items in "My Hangar", for buy back items in "Buy Back" (placed right before CCU
  Game's "Add to cart on RSI").

---

## Export & Import

Export & Import (#1), in the settings and in My Hangar, makes files in this browser only and sends
nothing anywhere:

- **The hangar** as JSON (the Hangar Manager's own format, which can also restore the hangar in a
  new browser and skip the first full load), as CSV for spreadsheets, or in HangarXPLOR's format,
  which FleetYards imports. IDs and amounts can be left out. My Hangar exports just the pledges
  shown.
- **Your settings and your data** – watchlists, marks to melt, the paint plans and the warbond
  offers this browser saw – as a backup or for another browser. An import shows what it adds,
  changes and keeps, and merges with what is here or replaces it.

The details are under [Settings](#settings) and in the [format](EXPORT-FORMAT.md).

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
- **When RSI fails**: a failed request is tried again. A buy back page that keeps failing is read
  in smaller pages, down to single pledges, so only the pledge that breaks it is left out; the
  list says how many were left out, and the next refresh tries again. A part that can't be read
  (hangar, buy back or orders) keeps its last state while the others are read and stored. The
  status line says what failed, and the [error log](#settings) keeps the details.
- Requests are gentle on RSI's servers – see [Gentle on RSI](#gentle-on-rsi).

---

## Settings

The settings tab (#117) lists its categories on the left, in four groups – General (Appearance,
Privacy, Demo mode, RSI website), Lists (My Hangar and Buy Back, Filters, Sidebar), Automation (Notifications,
CCU Check, Paint Discount Planner, Smart updates) and More (Experimental, Stored data, Export & Import, Error log, About) – and shows
one category at a time on the right, as grouped rows like the system settings: a switch for each
on/off setting, a segmented control for the theme, selects and number fields for the rest. A
narrow window shows the categories as a row above. Settings that depend on a switch sit below it
and look off while it is off. A link to a setting (from the sidebar) opens its category. In the
order of the list:

- **Appearance**:
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
- **Privacy** (hide sensitive information): see [Anonymization for content creators](#anonymization-for-content-creators).
- **Demo mode**: the switch of the demo mode (see
  [Anonymization for content creators](#anonymization-for-content-creators)) and its own settings
  (#178, dimmed while it is off): where the demo hangar comes from – generated
  (the default) or a selection of your own pledges –, how many pledges of each kind it has, how
  many the buy back has, which states show (refund countdown, protected game access, upgraded
  ships, a pledge bought a few hours ago, marks to melt in a new demo hangar) and how many pledges
  can't be gifted or melted, and the **store credit of the demo** (#179), shown in the account
  figures and used by the Paint Discount Planner, with a quick choice for each of its cases on
  this demo hangar – same tier, lower tier, not possible, no store credit (a case the hangar can't
  show is disabled). **New demo hangar** makes another random one; **Reset demo** puts
  these settings back and clears the demo's marks. Changes apply at once.
- **RSI website** (additions to RSI's own pages): **Show always available ships in RSI's ship
  upgrade dialog** (#401, on by default) labels each ship of RSI's ship upgrade dialog – on the
  left ("From") and on the right ("To") – that the ship facts list as always available in the Pledge Store ("Always available", with its
  source as tooltip) – on "My Gear", in the Pledge Store and from the Hangar Manager. Ships are
  matched by RSI's ship id, else by name; without the ship facts, or when RSI changed the dialog,
  no label shows (and the error log notes `PARSE-UPGRADE-DIALOG`). While an event runs, target
  ships that aren't always available count down to when they are expected to go (#570). **Show
  CCUs and owned ships on the base ships of RSI's ship upgrade dialog** (#506, on by default):
  the counts of [CCUs in RSI's ship upgrade dialog](#ccus-in-rsis-ship-upgrade-dialog). **Show the
  paint discount in RSI's cart** (#458, on by default): the
  [paint discount note](#paint-discount-note-in-rsis-cart).
- **My Hangar and Buy Back** (formerly "General" and "Show links for ships"):
  - **Show only the best insurance of upgraded ships** (on by default): after upgrades a pledge
    lists the insurance of every step; only the one that counts (LTI, otherwise the most months)
    is listed.
  - **Show links for ships**: erkul.games and FleetYards.net, each on or off.
  - **"Show in Buy Back" opens**: only the pledge, or the list page with the pledge highlighted.
  - **Price increases within … days** (14 by default, 1 to 90): the period of the buy back filter
    "Price increase expected", My Hangar's filter "Price change ahead" and the notification.
  - **Show rebuyable pledges** (on by default): the label, the List Shortcut and the reasons of
    [Melt and Rebuy](#melt-and-rebuy).
- **Filters**: order and selection of the filter buttons, separately for My Hangar and Buy Back
  and for types and features – drag a filter (or use its arrows) to move it within its group,
  uncheck it to hide its button.
- **Sidebar**:
  - **Show the sidebar** (on by default) – see [Selection and summary](#selection-and-summary).
  - **Boxes** (all on by default, only while the sidebar is shown): notifications, summary,
    selected, CCU Check and Paint Discount Planner. Without the "Selected" box, the rows have no select
    control.
  - **Reset order** (only while the boxes aren't in their default order): puts the boxes back
    into their default order; which boxes are shown and which are collapsed stays as it is.
  - **Count the pledges per type in the summary** (off by default, right below the "Summary" box
    and only while it is shown): only for the "Summary" box;
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
    needs no notification) – and when the Paint Discount Planner's filler
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
      browser notifications about marked pledges and the planner's filler paints; the sidebar
      tells it anyway.
    - **Pledge Store**: **Warbond CCUs changed** (in the sidebar, new ones also in the browser),
      **Pledge Store items changed** and **Events** (both in the sidebar only), **Ships leaving the
      Pledge Store** (#290: in the sidebar, and a week before the date in the browser, #291).
    - **Buy Back**: **Expected price increases** (in the sidebar, and in the browser once less than
      2 days are left).
    - **Watchlists**: **Watchlist reminders** and **Pledge Store changes on watchlists** (both in
      the sidebar and, if allowed, in the browser; see [Watchlists](#watchlists)). Turned off, a kind adds no notification, and its open ones go – in the
      sidebar and in the browser.
  - **Show checked-off notifications again** (#213): brings back the sidebar notifications checked
    off or dismissed with their ×, as far as they still matter – an event while it is shown, new
    warbond CCUs while one is still offered, changed Pledge Store items while one of the new or
    repriced ones still has that price, the Paint Discount Planner's while paints can still be
    bought again (on all browsers, as the dismissed paints are synced), the expected price
    increases' while buy back pledges are in their period, the ship removals' while their date is
    ahead, and the hint on browser
    notifications while they are off. Kinds turned off stay hidden; notifications from before this
    version (without what they were about) don't come back. It says how many came back.
- **CCU Check**: **Consider always available ships** and the source of their list – see
  [CCU Check](#ccu-check).
- **Paint Discount Planner** (it always buys with store credit, never with new money):
  - **Include my store credit** (on by default): the cart may also be paid with the current store
    credit; off, only with the melt value of the own paints.
  - **Use filler paints** (on by default): cheap extra paints reach a higher volume discount and
    are melted again after RSI's 24-hour cooldown; off, only the own paints count.
  - **Leave out giftable paints** (on by default): bought again with store credit, they would no
    longer be giftable. Also right in the planner.
  - **Paints bought again**: only those of a started plan (default, safe), or also guessed
    from discount and age – shown as a guess to check, without acting on it.
  - **Layout** of a new plan: choose a way and see only that one (default), both ways ("Buy
    first", "Melt first") side by side as cards, or the plan and its paints in tables.
- **Smart updates**:
  - **Check hangar, buy back and orders for changes** (on by default) – see
    [Built for speed](#built-for-speed). The three settings below it only count while it is on.
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
- **Experimental** (all off by default), with a clear warning: these features may not work as
  intended, and using them is at your own risk – the developer accepts no liability.
  - **Bulk melting**: exchange all selected pledges at once – see
    [Exchange (melt) with a safety net](#exchange-melt-with-a-safety-net). Turning it on asks
    first (see [Account Safety](#account-safety)). Below it, **Most pledges per bulk melting**.
  - **Translate RSI's texts in the exchange and gift dialogs**: RSI's changes to its texts reach
    the translations only later.
- **Stored data**: a table of everything the extension keeps in this browser – My Hangar, Buy
  Back, order history, ships, ships on sale, warbond offers, the ships' status (in concept or flight ready, from the Ship Matrix, at the same minutes as the Pledge Store items, once a day without smart updates), the ships' facts of the project website (status, always available and standard price with their history, once a day; a copy bundled with the extension counts until then), Pledge Store items, events, expected price increases, earlier warbond offers of the project website (once a day) and the store
  credit – with the number of entries, the
  size, the last full read and the last check. Each can be read again from RSI on its own (the
  refresh icon; ships, ships on sale and warbond offers are one read) and deleted on its own; the
  confirmation
  says what is missing until it is read again (by the next refresh, or on its own for the small
  data of the upgrade tool). Not possible during a refresh.
  - **In groups** (#624), by where the data comes from: **Your RSI account**, **RSI's Pledge Store
    and ships**, **Project website** and **Made in this browser**. Collapsed, a group shows the
    number of its data sets, their entries and size, and its oldest last check; expanded, its
    rows. A group that can be read again has a refresh of its own, which reads its parts one after
    the other; deleting a group asks first and names what goes, and for data made in this browser
    says that it can't be restored. The open groups are remembered.
  - **Synced with your browser profile** (#560): the watchlists, the marks to melt and the paint
    plans with their entries and size, and how much of the sync storage's limits they use, with a
    warning near a limit. Nothing of it can be read again, and resetting the data in this browser
    keeps it; deleting a row asks first, as it goes on every device with this browser profile.
  - **Reset**, below the table, each after a confirmation:
    - **Delete all local data**: removes the whole copy listed in the table; nothing changes on
      RSI's website, and the lists offer the initial load again. Not possible during a refresh.
    - **Reset settings**: all settings back to their defaults (on all synced devices); the stored
      hangar stays.
- **Export & Import** (#1): files made in this browser only, nothing sent anywhere
  ([format](EXPORT-FORMAT.md)).
  - **Export the hangar**: the hangar, buy back, orders, store credit and the gift flags of
    melted pledges, as JSON (the Hangar Manager's own format), as CSV for spreadsheets (the buy
    back as a file of its own) or in HangarXPLOR's format, which FleetYards imports (JSON or CSV,
    one entry per ship; ships FleetYards may not find are named after the export). The ids and
    the amounts can be left out, by default as the "Privacy" section hides them. My Hangar has the
    same export for the pledges shown (search, filters, a List Shortcut).
  - **Restore the hangar** from a JSON export of the same account, e.g. in a new browser, to skip
    the first full load; data here that is newer stays, and the smart updates bring it up to
    date.
  - **Export settings and your data**: the settings with their decisions (notifications checked
    off, notes closed) and your own data – watchlists, marks to melt, the paint plan and its
    completed plans, the warbond offers this browser saw – either part or both.
  - **Import settings and your data**: a preview of what changes, with the added, changed and
    kept entries of each storage (#634); the settings are replaced – except bulk melting, which an
    import never turns on –, your data merged with what is
    here (by default) or replaced, per storage, and the paint plan to
    keep chosen when both have one. It goes into the storage synced with the browser profile and
    reaches every device; it is measured against the synced storage's limits first, and nothing
    is written if it wouldn't fit.
- **Error log**: the last 500 errors the Hangar Manager handled, newest first, in a read-only
  field – a page it couldn't read, an entry it left out, and what it did instead. Each has a code
  (listed in [ERROR_CODES.md](ERROR_CODES.md)); an error repeated in a row counts as one (`×3`),
  and a buy back page read in smaller parts shows as one entry with its failed attempts below it.
  **Copy log** puts it on the clipboard for a bug report, starting with the version, the browser,
  the language and theme and whether the demo mode is on; it names the pledges and the pages asked
  for, but holds no pledge or order IDs, no name and no address. **Clear log** empties it after a
  confirmation. The log stays in this browser and is never sent anywhere.
- **About**: the extension's version, and links to the source code, the issue forms (bug
  reports; ideas link to GitHub Discussions), the privacy policy, the changelog and the license. The popup of the
  toolbar icon shows the version, too. When the browser doesn't let the extension run on RSI's
  website – Firefox may leave that access off, e.g. for a temporary add-on or after it was taken
  back in `about:addons` –, the popup says so and asks for it with **Allow access**; once allowed,
  open RSI tabs load again and show the Hangar Manager.

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
