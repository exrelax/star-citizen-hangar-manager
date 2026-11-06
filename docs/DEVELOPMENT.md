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
  background script show up there.

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
  without a milestone are listed under "Later", issues labelled `website` never show. With a
  `GITHUB_TOKEN` that can read the [project board](https://github.com/users/exrelax/projects/1),
  the issues are grouped by its columns, otherwise into open and done. Locally it works without a
  token (GitHub allows 60 requests an hour without one).
- **Privacy page**: `site/privacy.html` shows [`PRIVACY.md`](../PRIVACY.md), rendered while
  building by [`site/privacy/privacy.ts`](../site/privacy/privacy.ts) – change the policy only
  there. Its `#` heading is the title, the paragraphs before the first `##` section the line below
  it and the summary, each `##` section gets a link at the top.
- **Previews**: both pages have Open Graph and X tags with the same title and description as the
  page, and `store/social-preview-1280x640.png` as the image. Its URL has to be absolute: the build
  puts it below the site's address (`SITE_URL` in `site/vite.config.ts`).
- **Deployment**: the [website workflow](../.github/workflows/site.yml) builds and deploys the site
  to GitHub Pages on every push to `main` that changes it (or the images it shows), when issues or
  milestones change, daily and by hand via "Run workflow". Pages has to use "GitHub Actions" as its source (repository settings → Pages).

## Configuration

Tunable values – e.g. how often smart updates check the hangar, how many pages they check and
when a full refresh is suggested – live in [`src/config.ts`](../src/config.ts).

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
  orders/                Orders of the pledges: invoices, refund periods, refund requests
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
