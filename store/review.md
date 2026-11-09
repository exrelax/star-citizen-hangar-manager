# Answers for the store review

The fields of the review forms, in English (the stores ask for them only once, not per language).
Keep them in line with [PRIVACY.md](../PRIVACY.md) and the manifest in `wxt.config.ts`.

## Single purpose (Chrome)

```text
Star Citizen Hangar Manager shows the user's Star Citizen hangar, buy back and orders from robertsspaceindustries.com on one fast, searchable page inside the RSI account pages. All features serve this purpose: searching and filtering pledges, showing their insurances, discounts, upgrade history and orders, and offering RSI's own actions for a pledge (exchange, gift, buy back) with clearer warnings. Links from ccugame.app open a pledge in this view.
```

## Permission justifications (Chrome)

**storage**

```text
Stores the user's hangar, buy back and orders, read from robertsspaceindustries.com, locally in the browser, so the manager opens instantly without reading hundreds of RSI pages each time. Settings are kept in storage.sync so they follow the user's browser profile.
```

**unlimitedStorage**

```text
Large hangars and buy backs (thousands of pledges with their items, plus orders) exceed the default quota of storage.local. The data never leaves the browser.
```

**alarms**

```text
Sets a single alarm for the time the user's filler paints of the Paint Discount Consultant can be melted (24 hours after their order), so the extension can show a browser notification then, also while no RSI page is open. Only with browser notifications turned on is anything shown; nothing is sent anywhere.
```

**notifications** (optional permission)

```text
Optional, off by default. Requested with permissions.request only when the user turns on "Browser notifications" in the extension's settings (on an extension page, after a click there). It lets the extension tell the user about changes in their hangar, e.g. that pledges they marked to melt can be melted now, while no RSI page is open. The notifications are created locally; nothing is sent anywhere. Turning the setting off removes the permission again.
```

**Host permission: https://robertsspaceindustries.com/\***

```text
The manager is shown on RSI's account pages (a new entry in the account navigation). It reads the user's hangar, buy back and orders from RSI's pages with the session the user is already logged in with. Actions on RSI (exchange, gift, adding a buy back pledge to the cart) are sent only when the user clicks them.
```

**Content script on https://ccugame.app/\***

```text
Adds an "Open in Hangar Manager" link to CCU Game's item details, which opens the pledge in the manager on robertsspaceindustries.com. The script only reads the pledge ID shown on the page and sends nothing.
```

**Remote code**: No. All code is part of the package; the extension loads no scripts from
elsewhere.

## Data usage (Chrome "Privacy practices")

The extension sends no user data anywhere except to RSI itself, on the user's behalf. It reads,
and keeps locally:

- the hangar, buy back and orders (order IDs, amounts, dates)
- name and billing address in the order details – shown on demand, not stored
- the RSI password in the exchange and gift dialogs, and the gift recipient's name and email –
  sent only to RSI, not stored

Google counts data that is only processed or stored locally as handled, so it has to be disclosed
as well ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)).
Tick:

- **Personally identifiable information**: name and billing address in the order details, the gift
  recipient's name and email
- **Financial and payment information**: orders, amounts paid, invoices
- **Authentication information**: the RSI password typed into the exchange and gift dialogs
- **Website content**: the hangar, buy back and orders read from RSI's pages

Leave the others unticked: health, personal communications, location, web history and user
activity. Certify all three:

- The data is not sold or transferred to third parties.
- It is not used for purposes unrelated to the single purpose.
- It is not used to determine creditworthiness or for lending.

Privacy policy URL (the website's page, made from [PRIVACY.md](../PRIVACY.md)):
<https://exrelax.github.io/star-citizen-hangar-manager/privacy.html>

## Data collection (Firefox)

The manifest declares `data_collection_permissions: { required: ['none'] }`: no personal data is
transmitted to the developer or third parties. The requests to api.fleetyards.net contain only ship
model names (see [PRIVACY.md](../PRIVACY.md)); they can be turned off with the ship links.

## Test instructions (Chrome)

The "Test instructions" of the Chrome Web Store (max. 500 characters). Leave username and password
empty: no RSI account is shared.

```text
No test account: sharing RSI accounts is against RSI's ToS, and RSI accounts are free (robertsspaceindustries.com/enlist). Log in, open My Hangar (robertsspaceindustries.com/account/pledges), click the new nav entry "Hangar Manager", then "Initial Load". A new account has an empty hangar; the screenshots show a full one (demo mode). Exchange, gift and buy back are sent to RSI only after the user confirms. No tracking. Source: github.com/exrelax/star-citizen-hangar-manager
```

## Notes to the reviewers (Firefox)

```text
The extension works on robertsspaceindustries.com and needs a logged-in RSI account with pledges to show anything. After installing:

1. Log in on robertsspaceindustries.com and open "My Hangar" (https://robertsspaceindustries.com/account/pledges).
2. Click the new first entry "Hangar Manager" in the account navigation.
3. Click "Initial Load". The extension reads the hangar, buy back and orders (seconds to minutes, depending on their size; the progress shows on the refresh button).

Settings → "Hide sensitive information" → "Demo mode" shows an anonymized selection with made-up IDs.

The extension never buys, exchanges (melts) or gifts anything on its own: these actions are sent to RSI only when the user confirms them in their dialog, with the RSI password typed by the user.

Optional permission "notifications": requested only when the user turns on Settings → Notifications → "Browser notifications" (it opens an extension page with a button that calls permissions.request). Without it nothing changes.

Requests: robertsspaceindustries.com (the user's data, with the user's session) and api.fleetyards.net (public ship data, only ship model names are sent; can be turned off under "Show links for ships"). No analytics, no tracking.

Source code: https://github.com/exrelax/star-citizen-hangar-manager
```

## Source code and notes (Opera)

Opera reviews only readable code, and the built extension is minified. The version form has fields
for the source code and how to build it:

- **Extension source code URL (public)**: the tag of the uploaded version,
  <https://github.com/exrelax/star-citizen-hangar-manager/tree/v1.0.0>
- **Extension source code URL (required only for Opera moderators)**: meant for sources that
  aren't public. Ours are, so it gets the sources zip of the GitHub release, a direct download:
  <https://github.com/exrelax/star-citizen-hangar-manager/releases/download/v1.0.0/star-citizen-hangar-manager-1.0.0-sources.zip>
- **Build instructions**:

```text
Requirements: Node.js 24 (at least 22), pnpm 10 (the version is set in package.json).

pnpm install
pnpm build:chrome

The extension is written to .output/chrome-mv3: Opera uses the Chrome build. The JavaScript is minified by the build (Vite); the uploaded package is this build, zipped.
```

The notes for the moderators go into the conversation of the version, right after uploading it:

```text
The extension works on robertsspaceindustries.com and needs a logged-in RSI account with pledges to show anything. RSI accounts are free (robertsspaceindustries.com/enlist); no test account is shared, as sharing RSI accounts is against RSI's ToS. After installing:

1. Log in on robertsspaceindustries.com and open "My Hangar" (https://robertsspaceindustries.com/account/pledges).
2. Click the new first entry "Hangar Manager" in the account navigation.
3. Click "Initial Load". The extension reads the hangar, buy back and orders.

The extension never buys, exchanges (melts) or gifts anything on its own: these actions are sent to RSI only when the user confirms them in their dialog.

Requests: robertsspaceindustries.com (the user's data, with the user's session) and api.fleetyards.net (public ship data, only ship model names are sent). No analytics, no tracking. All JavaScript is part of the package; the readable source code and the build instructions are given in the version's fields.
```

On a new version, change the version in both source code URLs.

## Notes for certification (Edge)

The "Notes for certification" of a submission in Microsoft Partner Center. No test account is
shared, as for the other stores:

```text
The extension works on robertsspaceindustries.com and needs a logged-in RSI account with pledges to show anything. RSI accounts are free (robertsspaceindustries.com/enlist); no test account is shared, as sharing RSI accounts is against RSI's ToS. After installing:

1. Log in on robertsspaceindustries.com and open "My Hangar" (https://robertsspaceindustries.com/account/pledges).
2. Click the new first entry "Hangar Manager" in the account navigation.
3. Click "Initial Load". The extension reads the hangar, buy back and orders.

Settings → "Hide sensitive information" → "Demo mode" shows an anonymized selection with made-up IDs, as in the screenshots.

The extension never buys, exchanges (melts) or gifts anything on its own: these actions are sent to RSI only when the user confirms them in their dialog.

Requests: robertsspaceindustries.com (the user's data, with the user's session) and api.fleetyards.net (public ship data, only ship model names are sent). No analytics, no tracking.

Source code: https://github.com/exrelax/star-citizen-hangar-manager
```

## Source code (Firefox)

Upload the sources zip from `pnpm zip:firefox` (`.output/*-sources.zip`). Build instructions for
the reviewers:

```text
Requirements: Node.js 24 (at least 22), pnpm 10 (the version is set in package.json).

pnpm install
pnpm build:firefox

The extension is written to .output/firefox-mv3.
```
