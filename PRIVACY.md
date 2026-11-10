# Privacy Policy

**Star Citizen Hangar Manager** (browser extension for Chrome and Firefox)

Last updated: 9 November 2026

The extension is built so that your data stays in your browser. It has no server of its own, no
user accounts, no analytics and no tracking. This policy explains which data the extension
handles, where it is kept and which websites it talks to.

## Who is responsible

The extension is an open source hobby project by exrelax, published at
<https://github.com/exrelax/star-citizen-hangar-manager>. Questions about privacy can be asked
in the repository's [issues](https://github.com/exrelax/star-citizen-hangar-manager/issues);
please don't post personal data there. Security problems can be reported privately via GitHub's
private vulnerability reporting of the repository.

## Data the extension reads

The extension reads data from the website of Roberts Space Industries
(robertsspaceindustries.com, "RSI") with the RSI session you are already logged in with. It never
sees or stores your RSI login.

- **Hangar ("My Gear")**: pledges with their IDs, names, values, contained items, insurances,
  purchase dates and whether they can be gifted, melted or upgraded.
- **Buy back**: the pledges you can buy back and the number of buy back tokens left, and for
  pledges that left your hangar whether they could be gifted then.
- **Orders**: from RSI's pledge log and billing history, the order IDs, amounts paid, store
  credit used and dates, and which pledge was bought with which order.
- **Order details**: items, totals, payments and your **name and billing address**, as RSI's
  billing page shows them. They are loaded only when you open an order's details and are **not
  stored**.
- **Applied upgrades (CCU history)** of a pledge: loaded only when you open it and **not stored**.
- **Ship data**: RSI's public ship list (images) and, from RSI's upgrade tool, all ships with
  their standard prices, images and Pledge Store links, the ships currently on sale and the
  warbond offers – the same for every account, nothing about yours.
- **Store credit**: the amount of your account's store credit, as RSI's account menu shows it.
- **Pledge Store items**: the items of RSI's Pledge Store (name, category, price without taxes,
  image, link, warbond, in stock) – the same for every account, nothing about yours.

## Data you enter

- **Exchange (melt) and gift dialogs**: your RSI password and, for a gift, the recipient's name and
  email address. They are sent **only to RSI** when you submit the dialog and are never stored by
  the extension.
- **Search terms and settings**: see below.

## Where the data is kept

- **In your browser only.** Hangar, buy back, orders, ship data (ships, ships on sale, warbond
  offers), Pledge Store items, your store credit, ship links and the state of the smart updates are kept in the
  extension's local storage (`storage.local`) on your device. They never leave your computer and
  are not synced. Settings → Stored data lists all of it, with the number of entries, the size and
  when it was last read.
- **Settings** (language, theme, display and privacy options, filters, sorting, intervals) are kept in the browser's
  sync storage (`storage.sync`). If you use a browser account (Google account in Chrome, Firefox
  account in Firefox), your browser syncs them to your other devices; this is your browser's own
  sync, the extension has no server for it. The settings contain no hangar data.
- **Position of the summary box**, if you moved it: kept in the extension's session storage
  (`storage.session`) and gone when the browser session ends.
- **Demo mode**: a random key, kept in the local storage, makes up the pledge IDs and dates of the
  demo; pledges marked to melt in the demo are kept there too, apart from the real marks. Neither
  leaves your browser.
- **Pledges marked to melt**: their pledge IDs and when they were marked, kept in the browser's
  sync storage until the pledge is gone from your hangar, so they follow your browser profile to
  your other devices – by your browser's own sync, like the settings.
- **Notifications** of the sidebar: their text, the pledge they are about and when they
  happened – also the changes in the Pledge Store (public offers and prices) – kept in the local
  storage, with which ones were shown as browser notifications; removed ones go after 30 days.
  They never leave your browser.
- **Paints whose consultant notification you dismissed**: their pledge IDs, kept in the browser's
  sync storage like the pledges marked to melt, until you dismiss it again or show it again in
  Settings → Notifications.
- **Browser notifications**: whether this browser allows them (and whether it refused the last
  time), kept in the local storage. Whether you removed the sidebar's hint about them is kept in
  the sync storage. The notifications themselves are made in the extension and
  shown by your browser and system; their content is not sent anywhere.
- **The Paint Discount Consultant's plan**, once its paints were put into the cart: when, the
  discount tier, the own paints (pledge IDs, titles, melt values) and the filler paints, kept in
  the local storage (Settings → Stored data → "Paint plan"). Once the order that bought them is
  found, its ID and time and the pledge IDs of the filler paints are kept with it; the filler
  paints are marked to melt like your own marks.
- The **search term** is put into the page's address (`?search=…`) so searches can be bookmarked;
  it is part of your browser history like any other address.

## Which websites the extension talks to

- **robertsspaceindustries.com**: to read the data listed above and, only after your click, to
  put a buy back pledge or the paints of the Paint Discount Consultant into your cart (it reads
  the cart first; nothing is ever checked out), to exchange (melt) or gift a pledge, and to open invoices.
  "Refund Request" opens RSI's support form (support.robertsspaceindustries.com) in a new tab,
  prefilled with the order ID; you review and send it yourself. With browser notifications on,
  the extension also reads the Pledge Store (warbond CCUs and store items, public data) from RSI
  while no RSI page is open, with your RSI cookies, on the same schedule as in the manager.
- **api.fleetyards.net** (FleetYards.net): to link your ships to their pages on FleetYards.net and
  erkul.games, the extension loads FleetYards' public list of ship models and the details of the
  models in your hangar. These requests contain nothing but ship model names (e.g. "polaris") –
  no pledge data, no IDs, no login, no cookies. Like every request on the internet, they reveal
  your IP address to FleetYards. Turn both ship links off in the settings ("Show links for ships")
  and the extension talks to RSI only.
- **exrelax.github.io** (this project's website on GitHub Pages): at most once a day, the
  extension loads the list of Star Citizen events it shows in the Pledge Store tab
  (`data/events.json`) and the list of ships whose price is expected to rise
  (`data/price-increases.json`), and while the tab shows an event, its image from the same
  website. All are public files, the same for everyone; the requests send no data, no cookies, nothing about
  your account. Like every request on the internet, they reveal your IP address to GitHub (see
  [This website](#this-website)).
- **ccugame.app**: on CCU Game's pages, the extension adds links to the Hangar Manager. It only
  reads the pledge ID shown on the page to build the link and sends nothing.

Links to erkul.games, FleetYards.net, GitHub and RSI's knowledge base open only when you click
them. The icons of erkul.games and FleetYards.net are part of the extension, so showing them
contacts nobody.

## What the extension does not do

- No analytics, telemetry, tracking, advertising or third-party SDKs.
- No data is sold, shared or transferred to anyone, and none is used for purposes other than
  showing your hangar to you.
- Nothing is bought, gifted, melted or submitted without your click.

## This website

The project's website, <https://exrelax.github.io/star-citizen-hangar-manager/>, is hosted on
GitHub Pages. Like any web host, GitHub may log visitors' IP addresses, e.g. for security; see
the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
The website itself sets no cookies and uses no analytics, tracking, or fonts and scripts from other
servers. Its roadmap is built from the repository's public issues when the site is published, so
visiting it doesn't contact GitHub's API.

## Permissions

- **storage**: keeps the data and settings described above in your browser.
- **unlimitedStorage**: large hangars and buy backs can exceed the default storage quota.
- **alarms**: timers in your browser, only with browser notifications on: for when pledges you
  marked to melt or the Paint Discount Consultant's filler paints can be melted, and to read the
  Pledge Store around the full hour while no RSI page is open.
- **notifications** (optional): asked for only when you turn on Settings → Notifications →
  "Browser notifications", on a page of the extension, never at install or update. Without it,
  nothing changes – the sidebar's notifications need no permission. Turning the setting off gives
  the permission back; you can also take it back in your browser's settings for the extension.
- **Access to robertsspaceindustries.com**: shows the Hangar Manager on RSI's account pages and
  reads your hangar there; with browser notifications on, also the Pledge Store from the
  background.
- **Access to ccugame.app** (content script): adds the links to the Hangar Manager.

## Deleting your data

- **Settings → Stored data**: the delete icon of a row removes that data set only, e.g. only the
  buy back or only the order history.
- **Settings → Stored data → Reset → "Delete all local data"** removes everything the extension
  stored in this browser: hangar, buy back, orders, ship data, Pledge Store items and the state of
  the smart updates.
- **Settings → Stored data → Reset → "Reset settings"** removes your stored settings (on all
  synced devices).
- **Removing the extension** removes all of its data from the browser.

Nothing is stored anywhere else, so there is nothing else to delete.

## Changes to this policy

Changes are published in the repository's
[PRIVACY.md](https://github.com/exrelax/star-citizen-hangar-manager/blob/main/PRIVACY.md), which
is also shown on the website; the date at the top shows the last change.
