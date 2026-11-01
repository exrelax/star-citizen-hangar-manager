# SC Hangar Manager

Browser extension for managing your Star Citizen hangar on
[robertsspaceindustries.com](https://robertsspaceindustries.com). It runs in Chrome and Firefox from
a single shared code base.

Built with [WXT](https://wxt.dev) (based on Vite), Vue 3 and TypeScript. Both browsers are built as
Manifest V3; WXT generates the matching manifest for each browser.

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

Changing a locale file (`src/locales/*.yml`) restarts the whole extension, after which the RSI tab
may still get an older content script. Saving any content script file again (e.g.
`touch src/entrypoints/hangar.content/App.vue`) re-registers the current one.

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
  “SC Hangar Manager”. There are no custom icons yet, so the browser shows a default icon.
- **Manager page:** Clicking the icon opens the “Hangar Manager” page in a new tab.
- **Content script:** On the RSI account pages (e.g.
  [My Hangar](https://robertsspaceindustries.com/account/pledges)) the left navigation gets a new
  first entry “Hangar Manager”. It opens the manager view at `/account/pledges#hangar-manager`.
- **Background:** In Chrome, click **service worker** on the extension's entry in
  `chrome://extensions`; in Firefox, click **Inspect** in `about:debugging`. Errors and logs of the
  background script show up there.

If the navigation entry does not appear in Firefox, check under `about:addons` → SC Hangar
Manager → **Permissions** that access to `robertsspaceindustries.com` is allowed.

## Project structure

```
src/
  entrypoints/
    background.ts        Background (service worker in Chrome, background script in Firefox)
    hangar.content/      Content script: nav entry and manager view on the RSI hangar page
    options/             Manager page (Vue), opens in its own tab
  hangar/                RSI page integration (routing, account navigation)
  locales/               Translations (de, en), default locale is English
  shared/                Shared code and styles
wxt.config.ts            Shared configuration and browser-specific manifest
```

Browser-specific differences should live in `wxt.config.ts` wherever possible; the rest of the code
is the same for both browsers.
