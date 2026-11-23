# Working rules for Claude Code

The rules of this project for Claude Code and everyone who works with it. They always apply and
override defaults and anything a summary of an earlier conversation says. Personal rules of one
person or machine go into a `CLAUDE.local.md` next to this file (ignored by Git). Setup, commands
and how the extension works are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), how to contribute
in [CONTRIBUTING.md](CONTRIBUTING.md).

## Language

- Everything in the repo is English: code, comments, identifiers, docs, README, commit messages,
  GitHub issues and PRs. Only the `de` locale holds German texts.
- Write "Star Citizen Hangar" without hyphens, also in German ("Star Citizen Konto", never
  "Star-Citizen-Konto").
- German texts speak of store credit in the plural: "die Store Credits" ("Freigegebene Store
  Credits", "Deine Store Credits sind …"). Never "der Store Credit" or "Store-Guthaben".
- Use they/them for people whose pronouns aren't known.

## Design

- Build every feature so it fits all existing themes (currently "Modern Hangar" and "Classic RSI").
- Layouts and designs always follow the Apple Human Interface Guidelines, in the extension and on
  the website.
- Reuse existing components wherever possible instead of building new ones.
- Keep headings and texts consistent within each theme, e.g. no uppercase in "Modern Hangar" unless
  explicitly asked for.
- Use the skills `unslop` and `taste` for design decisions.
- To refine layouts and designs, use the skills `emil-design-eng`, `design-taste-frontend` and
  `impeccable` wherever possible.
- Icons are Font Awesome Free, unless custom icons are asked for explicitly. Every icon is loaded
  from the generated SVG icon sprite: put its SVG into `src/assets/svg-sprites/<set>/`, then run
  `pnpm svg-sprite` to build the sprite before using it (`SvgIcon`). See "Icons" in
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#icons).

## Notifications

When a new feature creates notifications (sidebar or browser), check whether it should be a kind of
its own in the settings' "Notifications" section, which can be turned on and off (#197). Raise it
with the user and add it to the feature's issue.

- Use browser notifications sparingly, so they don't annoy users: only for what is worth knowing
  while no RSI page is open (e.g. a pledge that had to wait can be melted now). Not every sidebar
  notification gets a browser notification.
- Each browser notification goes away on its own once its cause is gone or the Hangar Manager was
  seen (#155).
- Before adding a new kind of browser notification, ask the user whether it should be one.

## Demo mode

The demo mode is the tool for screenshots of every feature (parent issue #129). It must never reveal
the real account: no real pledge or order ids, dates, items, item counts or hangar value. The
generated demo hangar (#175) is built from the Pledge Store items and the ship catalog only.

It must always be able to show, in both themes:

- Every tag, filter, sorting and the search of My Hangar: insurance (LTI, years, months), upgraded,
  gift, melt, protected game access (`SC`, `SQ42`, `SC · SQ42`; one pledge per game, so `SC · SQ42`
  by the demo setting), discount, warbond, valuable, rewards; a refined filter pill (#419): its
  chevron, open list, each choice in the pill and the counts, excluded and off again back to "all";
  the "Paints" pill by owned ships (#336) in My Hangar and Buy Back: paints for a ship in the
  hangar (standalone, package, applied upgrade), for one only the base of a CCU, for several ships
  with one owned, a model code (C8 → C8R), a paint without its ship before its name, and each
  choice;
  a rewards pledge with a paint (#581) found by "Paints", "Rewards" and the "Paints" pill of its
  ship, one without a paint not by "Paints";
  the "CCUs" pill by base ship coverage (#461): all, without base ship (with "Consider always
  available ships" on and off), base always available and base limited (covered or not).
  The "Ships" pill by kind (#514): all ships, solo ships (insurance and hangar only), ships with
  extras (gear, paints, a starter package with game access) and ship packs (two ships, with
  extras, upgraded), each with its counts.
  The "CCUs" pill by contents (#566): solo CCUs (also with an insurance) and CCUs with extras
  (a paint, gear), in the section "Contents" below "Base ship" in My Hangar and without sections
  in the Buy Back, each with its counts.
- Every state per item: meltable or not, giftable or not, gifted, upgraded with "Applied upgrades",
  paid with money or store credit, refund countdown (normal and last week), bought a few hours ago,
  marked to melt (waiting and ready).
- Selection and summary, orders with invoices and the refund request, the sidebar boxes.
- Marking the selection to melt (#551, demo cases in #553): several selected pledges marked from
  the "Selected" box with some skipped (not meltable, marked already) and the counts; all marked
  already, "Unmark" removing their marks; the marked ones with "Melt in …" (the one bought a few
  hours ago) and "Melt now" in their rows and the sidebar; only the demo's own marks.
- Melt marks of a group (#552, demo cases in #554): a group with one marked item, one with several
  at different times ("Melt in 3 hr – 21 hr"), some ready and some waiting ("Melt now – 21 hr"),
  all ready ("Melt now"); the count badge and its tooltip; the label in the group dialog following
  a mark or unmark; My Hangar in both themes at a narrow width (after "Reset demo" for a demo
  hangar seeded before).
- Buy back pledges of each kind, with buy back prices of each source (buy back page, ships' standard
  prices, Pledge Store) and without a price (#185).
- "Probably giftable" in the buy back (#204, #205): bought with money before 2026-10-30, with store
  credit or mixed, after the date, without a known order, by the gift flag remembered at melt time,
  and several pledges of one order.
- Buy back CCUs RSI can't sell again (#207, #208): base ship pricier or as pricey as the target,
  with the label "Not available", its price tooltip, the disabled "To Cart" and the filter
  "Available" (included and excluded).
- Event notices in the Pledge Store (#69, #210): upcoming and running, with and without description
  and icon, and their sidebar notification (kind "Events") shown and closed.
- The Pledge Store tab: warbond CCUs and own CCUs in the same price range; by the demo setting "Show
  real Pledge Store data" (#310) the real warbond CCUs, history, events and price increases, with
  the counts from the demo hangar and buy back only; the demo buy back then also has CCUs to the
  real ships not on sale (e.g. a ship before its flight ready date), so they show as CCUs to secure.
- The "Ship upgrade" button above the manager, on every tab (#374, #388), disabled with its tooltip.
- The sortable "Your CCUs between" table of a warbond CCU (#395): at least three own CCUs with
  different discounts, one of them a surcharge, sorted by each column.
- The "x from <ship>" tag of a warbond CCU (#399): first, without "x to <ship>", on one offer (a
  demo warbond offer for a ship the hangar's CCUs only start from), and next to the other two tags.
- The table of all ships (#385, #390): counts from the demo hangar and buy back only; ships with and
  without a warbond price, always available and not, not purchasable at all, on sale now and not;
  CCUs from and to ships in hangar and buy back, standalone ships in both; "Ship upgrade" disabled
  with its tooltip; sorted by each column (value lowest first by default), searched by name and
  manufacturer, narrowed by the value range and each filter (also "In my hangar or buy back"), no
  match, the tinted groups "Hangar" and "Buy Back", the lines at every $100, faded ships not sold
  any more, warbond prices with what they save (#406); price increases confirmed and expected, with
  and without a new price, on their last day and before, leaving ships on a day and at a time, and
  the filters "Price increase" and "Leaving" (#410); each filter excluded, alone and with included
  ones, also hiding every ship (#413).
- The upgrade buttons of the Pledge Store tab (#392): a ship to secure and a leaving ship, each with
  and without a warbond CCU ("Ship upgrade" alone, "Warbond upgrade" left of it), the "Warbond
  upgrade" of a current warbond offer, all disabled in the demo with their tooltip.
- The warbond history (#4): an offer seen since a date with and without a running event, earlier
  offers at another price, with and without an event, and an offer never seen before.
- The Warbond CCU History (#297): at least 10 expired offers, 3 in the event period, 6 within 90
  days and 10 within 180 days, and older ones; expired offers in each period and outside them, with
  and without an event, a running event (event period selected) and none (demo setting "A running
  event"), search by manufacturer, each sorting.
- Every case of the Paint Discount Planner: ways `same`, `lowerTier`, `impossible`, in the layout
  "Choose a way" (#246, each way chosen, the one that doesn't work disabled) and "Both ways side by
  side", the table layout, nothing to rebuy, a kept plan with paints left to buy, paints bought
  again with the open melt step, filler paints waiting and ready to melt. The store credit of the
  demo is set in the demo settings (#179), since these cases depend on it. Every stage of the
  running plan (#245, #303: cart incomplete, not enough store credit, ready to pay, old paints left
  to melt, fillers waiting, fillers ready, no plan) is chosen in the demo settings, and the
  completed plans of both ways show collapsed and opened. The planner's tabs (#244, #306): all
  three, two of them, a single one with its heading instead of tabs (only a running plan, only a new
  plan, only completed plans) and none – by the stage of the running plan and the demo settings "A
  new plan" and "Completed plans". The tab "Tools" (#453): sub tabs for the CCU Check and the
  Paint Discount Planner with their counts (red without base ship, orange only via buy back), and
  a single tool as its heading (no plan and no completed plans, no CCUs); only completed plans with a tab without count. "Start plan" of a new plan (#317) on each layout, also its
  question while a plan runs; it starts only the demo's own plan.
- The Buy Back Reminder (#194): expected price increases with and without a flight ready date ahead,
  with and without a probable time, inside and outside the period; the label in the buy back
  (warning) and My Hangar (information) on a ship, a CCU and a module; the countdown of the last
  hour ("46:12"); the filter "Price increase expected", offered and not offered; the sidebar
  notification shown, closed and back for a new item (never a real browser notification).
- The Price Increase Advisor (#255): a price increase with a known new price; CCUs with the ship as
  base (warning, loses value) and as target (information, gains value), the ship itself; the filter
  "Price change ahead"; the advice with the giftable trade-off and with not enough store credit; the
  CCUs to secure in the Pledge Store tab, also of a ship not on sale with CCUs to it in the buy back
  (#311: several base ships, one without a price); the sidebar notification with and without
  affected CCUs, shown and closed.
- Price increases confirmed by CIG and only expected (#275): the texts of both, and a source link in
  the "Keep the discount" dialog and the CCUs to secure.
- CCUs to secure for a ship not on sale (#311): a ship with an upcoming price increase RSI sells no
  CCUs to, with CCUs to it in the demo buy back (several base ships, one without a known price) and
  their table expanded.
- Ship Removals (#292): several ships removed on one date and one ship alone, with and without a
  time; the section in the Pledge Store tab with its countdown, a ship of it expanded with enough,
  too few and no CCUs to it (#380); the yellow-orange and the red warning triangle on CCUs in My
  Hangar with the counts of CCUs to the base ship expanded and its button to the ship in the Pledge
  Store tab (#381); the "Ship upgrade" button on a leaving ship on sale and none on one not on sale
  (#391), disabled in the demo with its tooltip; the sidebar notification without CCUs, with the
  yellow-orange and with the red warning, shown and closed (never a real browser notification); a
  ship on sale now but not always available (#293), with its note in the sidebar, My Hangar and the
  Pledge Store tab, during an event and without one.
- QoL 1.2.0: the "Ship upgrade" button in My Hangar (#374, #388), shown but disabled with its
  tooltip; the table of all ships by value (#385, #390) with counts from the demo hangar and buy
  back only: ships with and without a warbond price, always available and not, not purchasable at
  all, on sale now (its "Ship upgrade" button disabled) and not, CCUs from and to a ship in the
  hangar and the buy back, standalone ships in both; "Warbond upgrade" (#392) left of "Ship upgrade"
  on a ship to secure and a leaving ship with a warbond CCU, none without one, and the renamed
  button of a current warbond offer.
  Marking the selection to melt from the "Selected" box (#551, demo cases in #553): several
  marked, some skipped (not meltable, marked already), all marked and "Unmark", only the
  demo's own marks. Melt marks of a group (#552, demo cases in #554): one marked item, several
  at different times ("Melt in 3 h – 21 h"), some ready ("Melt now – 21 h"), all ready, the
  count badge and its tooltip, in the list and the group dialog.
  The expected end of a current warbond CCU (#569, demo cases in #571): weeks ahead, the last
  day, none, its tooltip, and the real offers with "Show real Pledge Store data". The countdown
  of target ships in RSI's ship upgrade dialog (#570, demo cases in #572): to the event's end,
  to a later expected end of a warbond offer, none on always available and base ships, none
  without a running event, its tooltip.
  The base ship coverage of a CCU group (#574, demo cases in #575): covered fully, "2 of 5
  covered", base always available, not covered; collapsed and opened in the expanded group and
  the group dialog, with an entry opened and "Back", in My Hangar and the Buy Back.
- The counts on the base ships of RSI's ship upgrade dialog (#506, demo cases in #578): from the
  demo's own hangar and buy back only (owned, CCUs in the hangar and the buy back, all 0), none
  with the own pledges as demo source, the real ones again with demo mode off. The dialog on
  "All ships" with "My ships" disabled and its tooltip, never the real base ships (#586).
- The paint discount note in RSI's cart (#458, #459): made-up paints below the best tier and at
  it, the tiers, the demo's store credit enough for the best tier, for a lower one only, too
  little and none, fillers of one SKU and of two (5 + 3), "Add filler paints for the best
  discount" disabled with its tooltip, the setting under "RSI website" on and off.
- The paint discount note in RSI's cart (#458, #459): the demo's own cart (demo setting "Paints in
  the demo cart") below the best tier and at it (no note); the tiers with the current and the next
  one; the demo's store credit (#179) enough for the best tier, for a lower one only, too little
  and none; fillers of one SKU (6 paints) and across two (2 paints: 5 + 3); "Add filler paints for
  the best discount" disabled with its tooltip, never reading or changing the real cart or plan;
  the setting under "RSI website" on and off.
- Notifications with anonymized content, without real browser notifications or alarms; also the
  Pledge Store changes (#164): new and gone warbond CCUs, changed store items collapsed and opened,
  each with its ×.
- The CCU Check (#425): the base ship coverage on CCU rows (#111), collapsed and expanded,
  covered by a hangar ship, a package, an upgraded pledge, a hangar CCU, a buy back ship and a buy
  back CCU, several at once, and not at all (also with a buy back CCU RSI can't sell again); the
  card of an entry (#426) of a hangar CCU, a buy back CCU and a ship, with a discount and a
  surcharge, giftable and not; an entry opened in My Hangar and Buy Back and Back to the expanded
  CCU row (#436); its
  settings (#110) on and off; the "Base always available" label (#112); the label "Base ship missing" and the
  note on CCUs without coverage (#114), with and without a Pledge Store link, the setting on and off; the tab "Tools" with the CCU Check (#113): its bar, each group (without base ship,
  only via buy back, base always available) with entries and empty, "Consider always available
  ships" on and off, a buy back entry opened in Buy Back and Back, a Pledge Store link, no CCUs; the sidebar box (#115) with a
  count and with none (demo setting "CCUs without base ship coverage"); the section "Soon without
  base ship" (#454) with CCUs from a ship leaving on a day and at a time, one always available
  today, its countdown, "Ship upgrade" disabled with its tooltip, and empty; the tab "Discount at
  risk" (#455) with confirmed and expected price increases, the advice (giftable trade-off, not
  enough store credit), the "Keep the discount" dialog, and empty (demo setting "CCUs with their
  discount at risk"); a base ship without a Pledge Store link; the grouped view (#456) of a base
  ship's CCUs opened in My Hangar, with a group's dialog. Its layout (#563): the shared header
  with the coverage bar, the group tabs, the group's heading with its count, "Show N CCUs in My
  Hangar" and the toggle "Simple | Deep view" in both views, remembered; the simple view's base ship
  cards in each group (with and without image and price, on sale and not, always available, the
  ways to it as thumbnails with "+N", too few ways, a leaving ship with its countdown) and each
  action (Buy Back opening the demo's buy back pledges, "Ship upgrade" disabled with its tooltip,
  "Show in Pledge Store", Pledge Store), a card opening its CCUs in My Hangar; narrow. The deep
  view: the tab "Too few ways" with its count by the chain rule, "Secure now" with the demo's
  store credit (#179) and the totals from the next cheaper always available and the next cheaper
  ship; a row per base ship with image and price, on sale and not, its bar (ship and chain in the
  hangar, buy back, too few) and the legend, the chains as chips (from an always available ship
  with its star, starting in the buy back, cut with "+N"), those that don't count, "N in your
  hangar", "N in your buy back" opening the Buy Back; a base ship only the chain rule finds
  ("Found by the deep view", demo cases `chainStart` and `chainLink`, its start not on sale); the
  secure panel with both start ships, one that is also the cheapest, none always available, "Ship
  upgrade" disabled with its tooltip, "Not on sale now" with the prices each and the Pledge
  Store; a leaving ship with its countdown and "Show in Pledge Store"; the rows of "Only via buy
  back" and "Always available"; narrow (the panel below the row) and with "Hide melt value"; with
  the demo setting "CCUs without base ship coverage" off no base ship short of a way in either
  view.
- List Shortcuts (#431): each shortcut opened in My Hangar with its bar, title, icon, count and
  ×: "Ready to melt" (the demo's marks ready to melt, never the one still waiting), "Paints to
  optimize" from the sidebar box and the new plan's "Show these paints" (#430), "Melt and rebuy"
  (#530) and "Show in My Hangar" of a warbond CCU's "Your CCUs between" (#429, the demo's own
  CCUs); a search and a filter within it, also one leaving no match; its empty state: "Ready to
  melt" with the demo setting "Marks to melt in a new demo hangar" off and "Reset demo" (or its
  pledges unmarked), "Paints to optimize" with "A new plan" off, "Melt and rebuy" with
  "Rebuyable pledges" off; the former view filters "Melt now" and "Paint rebuy" on the new
  mechanism (#428). The CCU Check's "Buy Back" of a card (#563) opens the Buy Back.
- Grouped View (#450): the toggle on and off in My Hangar and Buy Back; groups of CCUs, ships,
  packages and gear next to single items; differing extras (some with gear, some with BIS paint,
  different insurance, some upgraded); all, some and none giftable and meltable; sums with a
  discount and a surcharge; with search, filters, a List Shortcut, each sorting and a group
  selected; the group dialog with an item selected and a jump to a pledge in a group; the labels
  taken from the items (#487): "Base ship missing" and "Base always available" on a CCU group, the
  refund countdown of one item among several, of several with different days left (the shortest
  shows) and in the last week; a group expanded and collapsed in the list and its dialog opened by
  its button (#488), with an item selected in either.
- Account Safety (#416): the Terms of Service note (#330) under the version in "About", with the
  feature toggle `tosSidebarNote` also first in the sidebar, closed with "Got it" (the demo's own
  state); the question before turning on bulk melting (#331), shown, "Turn on" and
  cancelled; the check right before bulk melting (#415), in the bulk melting dialog and for the
  filler paints: checking, all pledges match, a pledge changed, gone or no longer meltable, and RSI
  not readable, chosen in the demo settings, never reading or melting anything.
- The buy back tokens at the top right: 0 tokens and a count above 0 (#433); their tooltip (#434)
  with the next renewal date and its source link – the real one of the website, one announced by
  CIG, an estimated one with its note (demo setting "Next renewal of the buy back tokens") – and
  without a known date; the tooltip hovered and reached with Tab, its link focused.
- Watchlists (#464, demo cases in #474): several watchlists with and without a date, reminder on
  and off, empty and with items of each kind, a store item's count above 1, an item no longer in My
  Hangar; the notepad icon and the watchlists of an expanded item, a new watchlist created there; a
  watchlist's search and filters hidden and shown, its grouped view; the reminder and store change
  notifications in the sidebar, shown and closed (never a real browser notification), browser
  notifications allowed and not; the filler paints' watchlist of the Paint Discount Planner;
  the tab "Watchlists" second to last, before the Settings tab (icon only, #513); the selection
  of My Hangar put on a demo watchlist and on a new one from the "Selected" box (#549), also when
  all are on it already.
- Select all (#620): in My Hangar with and without filters and with a List Shortcut, some and all
  selected; on a demo watchlist with hangar, buy back and store items all selected, the hangar
  ones in "Selected", "Remove from this list" with its question, done and cancelled.
- Ship packs (#515, demo cases in #516): packs of two and of many ships with fanned images and
  the ship count, a pack with extras, a long title shortened with its tooltip, a pack expanded
  with its tiles next to an unchanged single ship, in My Hangar and the Buy Back, narrow.
- All store items in the Pledge Store tab (#535, demo cases in #538): the real store items with
  owned counts from the demo hangar and buy back only; every category, discounted, warbond, not in
  stock, without an image; search, each sorting, each filter included and excluded, no match; not
  read yet and an error while reading.
- The ship upgrade tool in the Pledge Store tab (#539, demo cases in #542): a pair with a standard
  and one with a warbond price, swapped; a base in the demo hangar, the demo buy back and nowhere;
  CCUs owned between both; a price increase and a removal ahead; recently used and preset pairs;
  "Add to cart" disabled with its tooltip, never touching the real cart.
- Melt and Rebuy (#527, demo cases in #532): rebuyable pledges of each kind (paint, standalone
  ship, CCU, one worth more than today's price); not rebuyable with each reason (giftable,
  discount, paint volume discount, upgraded, package, extra items, not on sale, insurance not
  offered, price increase or removal ahead, not always available, refund period, under 24 hours,
  unknown price) and several at once; the List Shortcut "Melt and rebuy" with count and freed
  store credit, empty; the label and its tooltip; a rebuy watchlist with counts and the total
  against the demo's store credit; "Add to cart" from a watchlist (#529) disabled with its
  tooltip, never touching the real cart; the setting on and off. The shortcut opened from the
  "Summary" box, its bar with "Put on a watchlist to rebuy" and the dialog (existing and new
  watchlist, "Also mark to melt"), the group label "Some rebuyable", the "Selected" box figure,
  the watchlist's "Total now" against the store credit and the "when added" price; the demo
  setting "Rebuyable pledges" on and off (empty shortcut).
- Grey Market Value (#492, demo cases in #499): ships of the demo hangar and buy back with a value,
  with a range, with too few sales and without data; each level of popularity; the tooltip with
  its sources, period, count and date; the column in the table of all ships; the setting on and
  off; real website data and made-up values.
- The synced data in the settings' stored data (#560): the demo's own watchlists and marks to
  melt with entries, empty and near a limit of the synced storage; the delete question shown and
  cancelled.
- Settings without real account data (#132); the error log (#340, #341, #342) with made-up entries
  of several codes: a narrowed page as main entry (►) with its sub-errors (↳), a repeated error
  (×3), URLs, a stack trace, an outline and pledge names from the Pledge Store; clearing off.

The demo is configurable in detail in its settings section (#178).

When a new feature needs demo mode changes (new data, a new state or case, a new place that shows
account data), plan them with the feature, never by reopening or extending #129 (closed, v1.1.0):

- A standalone issue covers its demo cases in its own body.
- Under a parent issue, one sub-issue of that parent ("<Parent>: Demo mode", labels `enhancement`
  and `internal`) collects the demo cases of all its sub-issues. Create it if missing (ask first),
  otherwise add the new cases to it. This holds only for a parent that is one self-contained feature
  (e.g. "Ship Removals").
- A parent that collects loose features (e.g. "QoL 1.2.0", "Layout 1.2.0", "Polishing 1.1.0") gets
  no shared demo sub-issue: each feature that needs demo cases gets its own sub-issue ("<Parent>:
  Demo mode of <feature>", labels `enhancement` and `internal`) under that feature's issue.

Add new cases to the list above.

How the demo mode works: "Demo mode" in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#demo-mode).

## Stored data

Users keep their data across every update, patches included.

- What the user made can't be read again from RSI: plans of the Paint Discount Planner, melt
  marks, completed plans, dismissed notifications, later named lists, and every storage with
  `readAgain: 'never'` in `src/storage/registry.ts`. It is always migrated, never dropped: never
  `obsoleteKeys` for it, and a migration may only add to it or reshape it, never lose entries.
- Check it while building a feature, not only before the release: a change of a stored key or
  shape gets its migration in `src/storage/migrate.ts` and a test in `migrate.test.ts` in the same
  branch. A new storage gets its registry entry with `readAgain` set.
- Data read from RSI or the website may be read again instead (`obsoleteKeys`), but only if
  nothing shows empty or breaks meanwhile (see "Migration check" under "Releases").

How the storage works: "Storage" in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#storage).

## Git

- Conventional Commits: `type(scope): Subject`, then one or two short sentences, `Closes #N` or
  `Refs #N`, and the `Co-Authored-By` trailer.
- New work goes on a new branch, not on `main`.
- Never work or commit on `main` directly: it is protected on GitHub, nobody may push or force push
  to it, so a local commit on `main` only gets in the way. Check the current branch
  (`git branch --show-current`) before every commit; if it is `main`, branch off first.
- Before branching for the next issue, check that the previous branch is merged into `main`
  (`git fetch`, then compare). If it isn't, ask the user first instead of branching from an old
  `main`.

## GitHub

- Use the `gh` CLI for GitHub (issues, labels, milestones, sub-issues, the board via `gh project`,
  `gh api` for the rest), not the browser. Use Chrome only for what `gh` can't do.
- Board: https://github.com/users/exrelax/projects/1 (Inbox → Backlog → Ready → In progress → In
  review → Done). New issues land in Inbox; "in the backlog" means the Backlog column.
- Before implementing an issue: set its status to "In progress" and assign the maintainer
  (exrelax) if missing.
- Draft new issues first and create them only after the user approves.
- The website's roadmap shows only main issues (a sub-issue is hidden where its parent is in the
  same milestone). So almost every new issue goes under a parent issue; a standalone issue only for
  a feature of its own. Parents get a short, concise name for the roadmap (e.g. "CCU Check",
  "Buy Back"); the explanation goes into the first sentence of the body. Sub-issues may nest. Work
  for the project itself (release, demo mode) gets the label `internal` and never shows on the
  roadmap, like `website`.

## Releases

When the user asks to prepare a new release (e.g. "Prepare version 1.2.0"), the issues below are
part of that request (no separate draft needed). The store review workflow, the roadmap and the
closing of the milestone depend on their exact form (#350, #354, #365); see "Store review" in
`docs/DEVELOPMENT.md`. `X.Y.Z` is the version, the milestone is `vX.Y.Z`.

- **Publish issue**, the parent, if it doesn't exist yet:
  - Title exactly `Publish vX.Y.Z` – "Publish", a space and the milestone's title, nothing else.
    Only then the roadmap shows the version "In review" and the milestone closes on its own.
  - Milestone `vX.Y.Z`, label `internal`, board status "Ready", no parent issue.
  - Body: one sentence on the release, then a checklist like #351: migration check of the stored
    data; version bump and CHANGELOG entry; tag `vX.Y.Z` and the GitHub release with the zips; final
    tests in Chrome and Firefox; upload the zips and request the reviews, then set this issue and
    its sub-issues to "In review".
- **One store issue per store worth waiting for**, as sub-issues of the publish issue – today the
  Chrome Web Store and Firefox Add-ons. Opera and Edge stay separate (#7, #8) until the user says
  otherwise: the version stays "In review" until the slowest store has published it.
  - Title `Publish vX.Y.Z: Chrome Web Store`, `Publish vX.Y.Z: Firefox Add-ons`.
  - Milestone `vX.Y.Z`, labels `internal` and `store-review`, board status "Ready".
  - Body: one sentence (upload X.Y.Z to the store and request its review; the store review moves it
    to "Done" once the store has published it), then the store lines, each on a line of its own and
    exactly in this form – the version without "v":

    ```
    Store: chrome
    Version: X.Y.Z
    ```

    `Store:` is `chrome`, `firefox`, `opera` or `edge` (Edge also needs `Id: <crx id>`). Then a
    short checklist: upload the zip (`star-citizen-hangar-manager-X.Y.Z-chrome.zip`, for Firefox the
    `-firefox.zip` and the `-sources.zip`) from the GitHub release; request the review and set the
    issue to "In review".
- Then the preparation itself, on a branch `release/X.Y.Z`, in separate commits: the CHANGELOG
  section (`node scripts/release-notes.js X.Y.Z` must read it), texts that name the version or the
  new features (`docs/FEATURES.md`, README, `store/review.md`'s Opera links), and last
  `chore(release): Set version X.Y.Z` in `package.json`. Tick "Version bump and CHANGELOG entry" in
  the publish issue.
- **Migration check**, before the version bump: compare the stored data of the last released version
  (`git diff vLAST..HEAD` of `src/storage/registry.ts` and of every stored type) with the new code,
  so users keep as much of their stored data as possible after the update:
  - Renamed or moved keys and changed shapes get a migration in `src/storage/migrate.ts` (it runs
    before anything reads, on the content script's start and on `onInstalled`), with a test in
    `migrate.test.ts`. Data a newer version already stored wins; old data is never thrown away while
    it can still be used.
  - Information the old data lacks (a new field, a new storage) is read from RSI or the website on
    its own at the first start after the update, and stored, instead of waiting for the next regular
    check or a full refresh. Nothing breaks or shows empty in the meantime.
  - Report the result to the user (what migrates, what is read again, or that nothing is needed) and
    note it in the publish issue. A needed migration is a commit of its own before the version bump,
    or an issue of its own if it is larger (ask first).
- The maintainer tags, publishes the release, uploads and sets the issues to "In review". Never close the
  publish issue, the store issues or the milestone by hand: the store review does it once the stores
  have published the version.

## Tooling

- Checks before a commit: `pnpm -s compile`, `pnpm -s lint`, `pnpm -s format:check`, `pnpm -s test`,
  and after changes to the extension also `npx wxt build` (catches build errors the other checks
  miss, e.g. in Vue style blocks; writes to `.output/chrome-mv3`, not the dev folder). Stop if any
  of them fails; format with `npx prettier --write <files>`.
- The development build reads every data file of the project website (`site/public/data/*.json`,
  event images) from the working copy, never from GitHub Pages, and reads it again on every check
  (`READ_ALWAYS` in `src/site-data/sync-site-data.ts`). A new data file of the website follows this
  rule too.
- The Hangar Manager opens at https://robertsspaceindustries.com/en/account/pledges#hangar-manager
  (tabs: `#hangar-manager-store`, `#hangar-manager-settings`, …). Without the hash, "My Gear" shows
  RSI's own page and no element of the extension, which doesn't mean it isn't running.

The commands: "Commands" in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#commands).

## How the RSI side works (domain knowledge)

What the Hangar Manager builds on, so features and advice fit how RSI really works. Sources: the
code (files named), the maintainer's experience (marked "user"), and pledges observed in a real
hangar. "Verify" marks general knowledge not checked here yet. Keep it current when something new
is learned.

### Pledges and My Hangar

- A **pledge** is one purchase with its items: ships, insurances, paints, gear, game downloads,
  hangar flair, name reservations. Its **id** grows over time and stays the same through melt and
  buy back (`probably-giftable.ts` relies on it). Its **value** is what was paid, in USD; it is what
  a melt gives back as store credit.
- Kinds: standalone ship, package (game access), CCU, paint, gear, add-on, flair, rewards (value
  $0, e.g. referral bonuses: not meltable, not giftable, `rewards.ts`).
- **Insurance**: only the best one counts (LTI, then the most months, `insurance.ts`). A pledge
  keeps its insurance through every CCU applied to it; a CCU may bring its own insurance (its
  target items), so upgraded pledges list several.
- **Melt** (RSI: Exchange, `exchange.ts`): the pledge becomes store credit of its value and moves
  to the buy back. Only 24 hours after the purchase (`melt-marks.ts`). Some pledges can't be bought
  back afterwards (`isBuybackable`). A pledge paid with money can be refunded within 30 days
  instead, which pays back money (`orders/refund.ts`).
- **Store credit** buys anything in the store except warbond offers (new money only). It can't be
  paid out.
- **Protected game access** (since 2026-10-01): RSI protects one pledge per game (SC, SQ42). It
  can't be melted or gifted, but upgraded with CCUs if it holds a ship.
- The **pledge log** (`orders/pledge-log.ts`) records every action: created, reclaimed (melted),
  buy-back, upgrade applied, CCU consumed on a pledge, gift claimed. Orders tell money vs. store
  credit (`orders/orders.ts`).

### CCUs (ship upgrades)

- A CCU upgrades a pledge from its **base ship** (from) to its **target ship** (to). RSI sells
  CCUs only from a cheaper ship to a pricier one, at today's standard prices (msrp, from RSI's
  upgrade tool, `ship-prices.ts`).
- **Price**: a standard CCU costs the msrp difference, payable with store credit. A **warbond**
  CCU costs the warbond price minus the base ship's msrp, new money only, and its discount is the
  same from every base ship – from the priciest base below the warbond price it costs least
  (`store/warbond.ts`, `cheapestBases`).
- An unapplied CCU is a pledge of its own: meltable, giftable by the gift rules, buy-backable.
- **Applying** a CCU (RSI's upgrade dialog) consumes it: the pledge's ship becomes the target, its
  value grows by the CCU's value, it keeps its name, insurance, order and gift status, and gets
  "Applied upgrades" (`upgrade-log.ts`). It can't be undone. Melting an upgraded pledge gives its
  whole value back as store credit; the applied CCUs are gone (the exchange dialog warns:
  "upgraded", danger). Verify what the buy back then holds.
- **Price changes**: when a ship's msrp rises, CCUs **to** it gain upgrade value (that's the
  discount of CCUs bought before), CCUs **from** it lose value. Once the base costs as much as the
  target or more, RSI can't sell the CCU again: its buy back is "Not available" (#207,
  `buyback-availability.ts`), while an owned one can still be applied. Price increases come from
  the website (`data/price-increases.json`), mostly when a ship becomes flight ready at an event.
- **Base ship coverage** (`ccu-consultant/coverage.ts`): a CCU is only useful with a pledge of
  its base ship. Covered by the hangar (a ship, or a hangar CCU to the base ship, which chains),
  else by the buy back (ship or CCU it can sell again), else the base ship is **always available**
  in the store (website ship facts, `always-available.ts`), else **missing**. Ships leaving the
  store for good (`data/ship-removals.json`) turn CCUs from them into "missing" later unless the
  user has ways to that ship.

### CCU chains

- A pledge can be upgraded by a long chain of CCUs in one go, e.g. from an Aurora with LTI to a
  Polaris by 19 CCUs, for a fraction of the Polaris' price.
- The steps alternate: **discount steps** (warbond CCUs, or CCUs bought before a price increase,
  e.g. Carrack → Perseus $15 for a $200 difference) and **bridge steps** (standard CCUs at the
  msrp difference, $0 discount, often bought with store credit right then) that connect one
  discount step to the next. A bridge costs as much as its price span; a discount step less.
- Two discounted CCUs whose price spans overlap can't be in the same chain: each needs a chain
  and a base pledge of its own (`ownedCcusInRange`, the "incompatible" count of warbond offers).
  So many discounted CCUs in one price range need as many chains.
- Each chain consumes one **base pledge**. LTI bases are the ones wanted (cheap LTI ships as "LTI
  tokens", e.g. an Aurora with LTI), so the number of LTI bases limits how many discounted chains
  make sense. A chain ends at the target its owner wants to keep (or whose value they want).
- Insurance and gift status of the result come from the base pledge, not from the CCUs.

### Buy Back

- Every melted pledge, newest first (`parse-buyback.ts`). It holds what the pledge held when it
  was melted, and its gift status at that time.
- **Price** (`buyback-price.ts`): today's **standard** price – a CCU the msrp difference of its
  ships, a ship its msrp, a store item its standard price. Never the warbond or sale price paid
  before: a melted warbond CCU loses its discount when bought back.
- **With money**: almost anything, as often as the buy back has it (user). RSI empties the cart
  before a buy back item goes in (`cart.ts`).
- **With store credit**: one **buy back token** per pledge. At most 2 per account, renewed back to
  2 at each renewal – not saved up (user). Renewals: the first Monday of each quarter in 2026
  (`data/buyback-tokens.json`, Spectrum "2026 Buy Back Token Schedule"); RSI shows the tokens left
  above its buy back list.
- **A personal store** (user): buy with store credit, melt, and the item waits in the buy back to
  be bought back later with money (or a token) – for items the store doesn't always sell: CCUs to
  ships not always on sale (e.g. before flight ready, event ships), seasonal paints. Limits: the
  price follows today's standard prices, and a CCU whose base ship caught up with its target can't
  be bought back.

### Gifting

- Cutoff in the code: **2026-10-30** (`BUYBACK_GIFTABLE_PURCHASED_BEFORE`; RSI's FAQ is the
  reference, `GIFTING_FAQ_URL`, also for the date it names).
- **Legacy pledges** (bought before the cutoff): giftable if paid with money only, once per pledge.
  Any store credit, a gift received, or a purchase on or after the cutoff makes them ungiftable.
- **New rules**: a pledge is giftable only if bought as a gift in the store ("Buying as a gift?").
  Store credit purchases never are.
- CCUs applied to a giftable pledge keep it giftable, also store credit CCUs (seen on a real
  pledge).
- A pledge bought back keeps the gift status it had when melted, and RSI offers "Buying as a
  gift?" at checkout; bought back with store credit it becomes ungiftable (`probably-giftable.ts`,
  `gift-flags.ts` remembers RSI's flag of each pledge that leaves the hangar).
- Gifting goes by email; the gift can be cancelled until it is claimed (`gift.ts`).
- So giftable LTI pledges are scarce and can't be made any more without new money bought as a
  gift; store credit CCUs can raise their value without losing the status.

### Store, warbond and events

- Warbond CCUs and offers are time-limited, new money only; events (IAE with a manufacturer per
  day and Best in Show, CitizenCon, Invictus) bring most of them (`data/events.json`,
  `data/warbond-history.json`).
- Ships not always on sale are sold only in some events or phases; the website's ship facts say
  which are always available.
- Paints get a volume discount by count in one cart: 2 → 15%, 3 → 20%, 5 → 25%, 7 → 30%,
  10+ → 35% (`PAINT_DISCOUNT_TIERS`, Paint Discount Planner).
