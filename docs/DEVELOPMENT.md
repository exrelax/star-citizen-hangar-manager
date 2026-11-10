# Development

How to set up, run, build and release the extension. How to contribute – principles, coding
guidelines, pull requests – is described in [CONTRIBUTING.md](../CONTRIBUTING.md).

Built with [WXT](https://wxt.dev) (based on Vite), Vue 3 and TypeScript. Both browsers are built as
Manifest V3 from a single shared code base; WXT generates the matching manifest for each browser.
Browser-specific differences should live in `wxt.config.ts` wherever possible; the rest of the code
is the same for both browsers.

## Requirements

- **Node.js 24** (at least 22), the version is pinned in `.nvmrc`
- **pnpm 10** (the exact version is set in `packageManager` in `package.json`)
- Chrome and/or Firefox

## Installation

```bash
nvm use
pnpm install
```

`pnpm install` runs `wxt prepare` afterwards. It generates the `.wxt` folder with type definitions
and auto-imports that TypeScript and ESLint rely on.

## Commands

| Command              | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `pnpm dev:chrome`    | Dev server with hot reload, launches Chrome with the extension  |
| `pnpm dev:firefox`   | Dev server with hot reload, launches Firefox with the extension |
| `pnpm dev`           | Same as `dev:chrome` (Chrome is WXT's default)                  |
| `pnpm build`         | Production build for Chrome and Firefox                         |
| `pnpm build:chrome`  | Production build for Chrome only → `.output/chrome-mv3`         |
| `pnpm build:firefox` | Production build for Firefox only → `.output/firefox-mv3`       |
| `pnpm zip`           | ZIP packages for the stores (Chrome and Firefox) in `.output`   |
| `pnpm compile`       | Type check with `vue-tsc`                                       |
| `pnpm lint`          | ESLint (`pnpm lint:fix` fixes what can be fixed automatically)  |
| `pnpm format`        | Formats all files with Prettier                                 |
| `pnpm format:check`  | Checks formatting without changing files                        |
| `pnpm test`          | Unit tests with Vitest (`pnpm test:watch` for watch mode)       |
| `pnpm svg-sprite`    | Builds the icon sprites and icon names (see below)              |
| `pnpm icons`         | Renders the extension's icons from the logo (see below)         |
| `pnpm site:dev`      | Dev server of the project website with live reload (see below)  |
| `pnpm site:build`    | Builds the project website → `.output/site`                     |
| `pnpm site:preview`  | Serves the built website locally                                |

## Trying the extension in the browser

### Option 1: Dev mode (recommended)

`pnpm dev:chrome` or `pnpm dev:firefox` opens a separate browser window with a fresh profile that
already has the extension loaded. Code changes are picked up automatically.

If WXT cannot find the browser (e.g. because of an unusual install path), set the path in a local
`web-ext.config.ts`, see the
[WXT documentation](https://wxt.dev/guide/essentials/config/browser-startup.html). The file is listed
in `.gitignore`.

#### Using your own Chrome profile

The fresh profile has no RSI login. To develop against your logged-in account, run the dev server
without launching a browser and load the dev build into your own Chrome:

1. Create a local `web-ext.config.ts` (gitignored):

   ```ts
   import { defineWebExtConfig } from 'wxt';

   export default defineWebExtConfig({
     disabled: true,
   });
   ```

2. `pnpm dev:chrome`
3. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked** and select the
   `.output/chrome-mv3-dev` folder (only needed once)

The dev build reloads itself on code changes; reload open RSI tabs afterwards. The dev build is tied
to the dev server's port (3000, or a free port if 3000 is taken). If the port changes, reload the
extension in `chrome://extensions`.

Changing a locale file (`src/locales/*.json`) restarts the whole extension, after which RSI tabs
may keep getting an older content script. Reload the extension in `chrome://extensions` in that
case.

### Styleguide

The dev build adds a styleguide page with the manager's building blocks: the theme colors of the
current theme, all icons, the real hangar and buy back lists with made-up pledges of every kind
(filters, search, rows, their buttons and dialogs) and the settings. Open it with the
**Styleguide** link at the bottom of the manager's settings (dev builds only), or at
`chrome-extension://<extension id>/styleguide.html`.

- It shows the real components (`src/entrypoints/styleguide`), so it stays current with the code.
  New kinds of pledges or states go into `fixtures.ts` there.
- Theme, language and display options are the extension's own settings: switching the theme there
  switches the manager, too. Check changes in both themes and, for "Modern Hangar", in the light
  and dark system appearance.
- Requests to RSI fail on this page, so nothing can be exchanged, gifted or bought from it.
- `wxt build` leaves the page out (see `wxt.config.ts`); it is never part of a release.

### Option 2: Load a build manually

**Chrome**

1. `pnpm build:chrome`
2. Open `chrome://extensions` and switch on **Developer mode** in the top right corner
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder

**Firefox**

1. `pnpm build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on…** and select `.output/firefox-mv3/manifest.json`

Firefox removes temporary add-ons when it quits.

### How to tell the extension is running

- **Icon:** The extension shows up in the toolbar or the extensions menu (puzzle icon) as
  “Star Citizen Hangar Manager”, with the hangar logo.
- **Popup:** Clicking the icon opens a small popup with the extension's version and links to the
  Hangar Manager, its settings and the GitHub repository; each opens in a new tab.
- **Content script:** On the RSI account pages (e.g.
  [My Hangar](https://robertsspaceindustries.com/account/pledges)) the left navigation gets a new
  first entry “Hangar Manager”. It opens the manager view at `/account/pledges#hangar-manager`.
- **Background:** In Chrome, click **service worker** on the extension's entry in
  `chrome://extensions`; in Firefox, click **Inspect** in `about:debugging`. Errors and logs of the
  background script show up there. Whether it can read RSI without a page: **Settings →
  Development → Read the Pledge Store in the background**.

If the navigation entry does not appear in Firefox, check under `about:addons` → Star Citizen
Hangar Manager → **Permissions** that access to `robertsspaceindustries.com` is allowed.

## Version

The version lives only in `package.json`: WXT writes it into the manifest, and the extension reads
it from there (`src/shared/extension-version.ts`) for the settings ("About") and the popup.

## Releasing

1. Set the new `version` in `package.json` (the only place it lives, see [Version](#version)).
2. Add its section to [`CHANGELOG.md`](../CHANGELOG.md), e.g. `## [1.0.0] – 2026-11-30` followed by
   the changes. These become the notes of the GitHub release.
3. Commit, then tag and push: `git tag v1.0.0 && git push origin main v1.0.0`.

The [release workflow](../.github/workflows/release.yml) then checks that the tag matches
`package.json` and that the changelog has the version's section, runs the type check, ESLint and
the tests, builds the zips (`pnpm zip`) and creates a **draft** release on GitHub with them:
the Chrome and Firefox packages and the sources for addons.mozilla.org. Check the draft and publish
it on GitHub, then upload the zips to the stores (texts and images in [`store/`](../store/README.md)).

`node scripts/release-notes.js 1.0.0` shows locally what the release notes will be.

## Website

The project website lives in [`site/`](../site): one static page in plain HTML and CSS, built by
Vite ([`site/vite.config.ts`](../site/vite.config.ts)). Its colors and building blocks are CSS
custom properties and classes in [`site/styles.css`](../site/styles.css).

- **Images** are referenced with relative paths from where they already are – `store/`,
  `public/icon/`, `src/assets/logo/` – and copied into the build with hashed names. Don't copy
  them into `site/`.
- **Nothing from other servers**: no web fonts, scripts, analytics or embedded images from
  elsewhere, in line with [`PRIVACY.md`](../PRIVACY.md).
- **Current version**: the latest GitHub release (`/releases/latest`), loaded with the roadmap and
  shown in the hero and as the first, "released" step of the roadmap; without a release, the
  `version` of `package.json`. Publishing a release rebuilds the site.
- **Roadmap**: built from the repository's open milestones (with a due date) and issues while
  building, by [`site/roadmap/roadmap.ts`](../site/roadmap/roadmap.ts); open `enhancement` issues
  without a milestone are listed under "Later", issues labelled `website` or
  `internal` (work for the project itself, e.g. the release or the demo mode) never show. Sub-issues
  are left out where their parent issue is listed (same milestone or "Later"); the parent stands
  for them, also in the progress. A hidden parent (`website`, `internal`) hides its sub-issues too. With a `GITHUB_TOKEN` that can read the
  [project board](https://github.com/users/exrelax/projects/1), the issues are grouped by its
  columns, otherwise into open and done. Locally it works without a
  token (GitHub allows 60 requests an hour without one).
- **Privacy page**: `site/privacy.html` shows [`PRIVACY.md`](../PRIVACY.md), rendered while
  building by [`site/privacy/privacy.ts`](../site/privacy/privacy.ts) – change the policy only
  there. Its `#` heading is the title, the paragraphs before the first `##` section the line below
  it and the summary, each `##` section gets a link at the top.
- **Data for the extension**: `site/public/` is copied as is, e.g. `data/events.json`, the events
  of the Pledge Store tab (#69). The store build reads it from the live site at the times of `SITE_DATA.schedule` in
  `src/config.ts` (UTC, the same for every user: every two hours, hourly from 14:00 to 22:00, every
  15 minutes from 15:00 to 18:30 – one hour later in Central European winter time; a missed time is caught up once, a failure retried after an hour);
  the dev build reads the file of the working copy, so new events can be tried before they are
  deployed – "Stored data" → "Events" in the settings reads it again at once. The format is
  checked by [`src/events/events.ts`](../src/events/events.ts). An event's `image` is a 16:9 image
  (256×144, twice the row's thumbnail) in `site/public/images/events/`, linked with its URL on the
  site; images from elsewhere are ignored, and the dev build shows the working copy's. `phases`
  lists the parts of an event with their `start`, `name` and optional `shortName` for the
  countdowns ("RSI" for "Roberts Space Industries"; e.g. the manufacturer of each IAE day,
  "Best in Show", the finale); each lasts until the next one or the event's end, and the tab counts
  down to them.
  `name` and `description` are one text, or one per language of the extension –
  `{ "en": "…", "de": "…", "fr": "…", "es": "…" }`, English required and shown for a language
  not given.
- **Expected price increases**: `data/price-increases.json` lists the ships whose price is
  expected to rise, for the Buy Back Reminder (#195). Every date in it is an assumption, and the
  extension says so. Read like the events, by the same loader
  ([`src/site-data/sync-site-data.ts`](../src/site-data/sync-site-data.ts)): on the same schedule,
  the dev build from the working copy, checked by
  [`src/price-increases/price-increases.ts`](../src/price-increases/price-increases.ts). See
  [below](#editing-the-expected-price-increases) for how to edit it.
- **Previews**: both pages have Open Graph and X tags with the same title and description as the
  page, and `store/social-preview-1280x640.png` as the image. Its URL has to be absolute: the build
  puts it below the site's address (`SITE_URL` in `site/vite.config.ts`).
- **Deployment**: the [website workflow](../.github/workflows/site.yml) builds and deploys the site
  to GitHub Pages on every push to `main` that changes it (or the images it shows), when issues or
  milestones change, daily and by hand via "Run workflow". Pages has to use "GitHub Actions" as its source (repository settings → Pages).

### Editing the expected price increases

Each entry of `priceIncreases` is one ship (the values are an example):

```json
{
  "ship": { "id": 244, "name": "Galaxy", "aliases": ["RSI Galaxy"] },
  "flightReadyAt": "2026-11-13",
  "priceIncreaseAt": "2026-11-16T16:00:00Z",
  "relatedItems": [{ "name": "Galaxy Refinery Module" }],
  "event": "iae-2956",
  "note": { "en": "Expected with the IAE.", "de": "Erwartet mit der IAE." }
}
```

- **`ship.id`** and **`ship.name`** (required): the ship's id and name in RSI's Ship Matrix. Look
  them up in its public JSON, <https://robertsspaceindustries.com/ship-matrix/index> (search for
  the name), or take `data-toshipid` of the "Buy Back" button of a CCU to the ship. The upgrade
  tool and the buy back's CCUs use the same id (#187).
- **`ship.aliases`** (optional): other names RSI uses for the ship, only where they differ from
  the Ship Matrix, e.g. "Hercules Starlifter M2" (My Hangar) for "M2 Hercules", "Mercury Star
  Runner" for "Mercury". Names are compared without case, punctuation and the endings
  "Standard Edition" and "Warbond Edition", but otherwise exactly: "Galaxy" doesn't match
  "Galaxy Refinery Module".
- **`priceIncreaseAt`** (required): when the price is expected to rise. A day (`"2026-11-16"`)
  if only the day is expected, or a time in UTC (`"2026-11-16T16:00:00Z"`) if the probable time
  of the Pledge Store update is known, e.g. 17:00 CET during the IAE. With a time the extension
  counts down to it; with a day it shows only the day, and the entry counts until that day is
  over (UTC). An entry whose date has passed is ignored, so old entries can stay until the file
  is cleaned up.
- **`flightReadyAt`** (optional): when the ship is expected to become flight ready, given the
  same way. Leave it out for ships that are already flight ready – the Ship Matrix's
  `production_status` (`flight-ready`, `in-concept`) tells which ones are.
- **`relatedItems`** (optional): items that belong to the ship and rise with it, e.g. the
  modules of a modular ship, each with its exact `name` as in the Pledge Store or My Hangar.
- **`event`** (optional): the `id` of the event in `events.json` the price increase belongs to.
- **`note`** (optional): a short text for the user, e.g. the source of the assumption; one text
  or one per language, like an event's `description`.

A ship can have several entries, e.g. one per step if its price rises twice.

## Configuration

Tunable values – e.g. how often smart updates check the hangar, how many pages they check and
when a full refresh is suggested – live in [`src/config.ts`](../src/config.ts).

## Permissions

`wxt.config.ts` declares the permissions. A new **required** permission that shows a warning
disables the extension after an update until the user approves it (Chrome) or asks again in the
update dialog (Firefox). So anything with a warning is added as an **optional** permission and
asked for with `permissions.request` only when the user turns its feature on.

- **notifications** (optional, #152): browser notifications. Content scripts can't use the
  `permissions` API, and the request needs a click as user gesture in an extension context, so
  the settings open the extension page `notification-permission.html`, whose button asks. The
  background script mirrors the state into `local:notifications.browserAllowed` for the content
  scripts (`permissions.onAdded`/`onRemoved`, and at start for changes while it slept). The
  permission is per browser, so it isn't a synced setting: the permission itself is the switch.
- **alarms** (required since #105): the background script sets an alarm for the time the Paint
  Discount Consultant's filler paints can be melted and shows the browser notification then
  (`store/paint-consultant/filler-notification.ts`). It shows no warning in Chrome; Firefox can't
  ask for it as an optional permission and lists no warning for it either – whether its update
  dialog asks is still to be checked with a test build before the release. Chrome fires alarms
  at most every 30 seconds; Firefox rounds periods below a minute up (to verify for #162).
  Since #163 a second alarm (`shm-pledge-store`, every 30 seconds) reads the Pledge Store while
  browser notifications are on (`store/background-schedule.ts`), and since #153 a third one
  (`shm-melt-ready`) goes off when a pledge marked to melt can be melted
  (`notifications/melt-ready-notification.ts`). All alarms and notification clicks go through
  one listener each (`background/dispatch.ts`).
- **No cookies permission** (#163): the background script reads RSI with `fetch` to absolute URLs
  and `credentials: 'include'`; the host permission sends RSI's cookies. The `X-Rsi-Token` header
  (from `document.cookie`) is only sent from pages: the Pledge Store search and the upgrade tool
  work without it. Without any RSI session the upgrade tool fails on its targets
  (`RsiSignedOutError`): the background then reads neither it nor the store items (RSI lists
  fewer items without a session) and tries again at the next alarm, without logging an error.
  To check, a development build has **Settings → Development → Read the Pledge Store in the
  background**: the background script reads both once and shows what it got, nothing stored.
  Checked on 2026-11-09 in Chrome and Firefox (Total Cookie Protection still sends RSI's
  cookies): 242 ships, 4 warbonds, 680 store items in 16 requests, the same as the page.

## Storage

Everything the extension keeps lives in `browser.storage`: the settings in `storage.sync`, all
data read from RSI in `storage.local` – one key per data set, replaced as a whole, so a reader
never sees a mix of old and new data.

- **Registry** ([`src/storage/registry.ts`](../src/storage/registry.ts)): every storage with its
  key, what it holds, where it comes from, what uses it, how to count its entries and whether it
  is read again on its own after a reset. The settings ("Stored data"), the reset and the
  migration work from this list – a new storage is one entry there.
- **Metadata** ([`src/storage/meta.ts`](../src/storage/meta.ts)): next to each data key a small
  `<key>.meta` key with the last full read, the last change, the last check with its outcome and a
  fingerprint to compare with on the next check (the newest pledge log entry for the orders, a
  hash of the answer for the data of the upgrade tool and the Pledge Store items). A check that
  finds nothing new writes only these few bytes.
- **Migration** ([`src/storage/migrate.ts`](../src/storage/migrate.ts)): moves data of earlier
  keys to the current ones before anything reads them (content script start and after an update).
- **Reading in the UI**: `useStored(item)` ([`src/storage/use-stored.ts`](../src/storage/use-stored.ts))
  gives all components one shared, reactive copy of a stored value.

## Smart updates

`maybeRunSmartUpdate` ([`src/hangar/sync-state.ts`](../src/hangar/sync-state.ts)) reads the new
entries of the pledge log first, then checks the buy back and the hangar: first and last page,
rotating spot checks, and the pages of the pledges the log names and of those just melted
([`src/hangar/smart-update/check.ts`](../src/hangar/smart-update/check.ts)). How reliable that is
for which change: [FEATURES.md](FEATURES.md#smart-updates-a-few-pages-instead-of-all).

## Project structure

```
src/
  entrypoints/
    background.ts        Background (service worker in Chrome, background script in Firefox)
    hangar.content/      Content script: nav entry and manager view on the RSI hangar page
    ccugame.content/     Content script: links to the manager on ccugame.app
    popup/               Popup of the toolbar icon: links to the manager, settings, repository
    styleguide/          Styleguide page with all building blocks (dev builds only)
  hangar/                Hangar data and view: sync, smart updates, list, filters, search
  buyback/               Buy back data and view, adding buy back pledges to the RSI cart
  orders/                Orders of the pledges and the pledge log: invoices, refund periods
  ships/                 RSI's ship upgrade tool: ships, ships on sale, warbond offers
  store/                 Pledge Store tab (warbond CCUs) and the stored Pledge Store items
  storage/               Registry of all storages, their metadata and migrations
  ccugame/               Links from CCU Game (ccugame.app) to the manager
  demo/                  Demo mode: an anonymized selection of the pledges for screenshots
  settings/              Extension settings and their tab
  themes/                Themes ("Modern Hangar", "Classic RSI"), font sizes, compact view
  assets/                Images bundled into the code (favicons, icon sprites, logo)
  icons/                 `SvgIcon` component, sprite loading, generated icon names
  locales/               Translations (de, en, es, fr), default locale is English
  i18n/                  Runtime translation that follows the language setting
  shared/                Shared code and styles
  config.ts              Tunable values (intervals, page counts, limits)
wxt.config.ts            Shared configuration and browser-specific manifest
.github/workflows/       CI (checks and builds of pushes and pull requests), releases, website
public/icon/             Extension icons, rendered from the logo by `pnpm icons`
store/                   Texts and images for the store pages, the review (see store/README.md)
site/                    Project website on GitHub Pages (see Website)
```

### Icons

Icons are single SVG files in `src/assets/svg-sprites/<set>/`: `fa` (Font Awesome Free) and
`custom` (the extension's own, e.g. `hangar`). After adding or changing one, run
`pnpm svg-sprite`: it optimizes the icons with svgo and writes the sprite
`src/assets/svg-sprites/<set>.svg` and the names in `src/icons/icon-names.ts`. A new set also needs
its sprite in `src/icons/sprite.ts`. Use an icon with `<SvgIcon name="circle-xmark" />`, one of
another set with `<SvgIcon name="hangar" set="custom" />`; it is as large as the text and in its
color.

### Extension icon

The logo lives in `src/assets/logo/` in three levels of detail: `logo-full.svg` (from 64 px, with
the hangar's interior, position lights, the ship's cockpit and engine glow), `logo-mid.svg`
(32–48 px, the hangar and the ship without the small details) and `logo-tiny.svg` (16 px, only
the hangar). `pnpm icons` renders them to `public/icon/<size>.png`, which WXT puts into the
manifest. The 128 px icon, also the Chrome Web Store's, has 16 px of transparent padding, as
Google asks for. Run `pnpm icons` after changing the logo; the PNGs are committed.
