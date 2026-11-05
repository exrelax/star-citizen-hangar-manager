# Store texts and images

The texts and images for the extension's store pages. They are kept here so they are versioned
with the code and can be reviewed like the translations in `src/locales/`. On a release, copy them
into the stores' dashboards.

| File                           | What                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| [listing.en.md](listing.en.md) | Store page in English: summary, description, notice              |
| [listing.de.md](listing.de.md) | The same in German                                               |
| [listing.fr.md](listing.fr.md) | The same in French                                               |
| [listing.es.md](listing.es.md) | The same in Spanish                                              |
| [review.md](review.md)         | Answers for the review: single purpose, permissions, data, notes |

The texts in code blocks are meant to be copied as they are: the Chrome Web Store shows the
description as plain text, so they use no Markdown.

## Images

| File                                                         | Size     | Where                                       |
| ------------------------------------------------------------ | -------- | ------------------------------------------- |
| [01-my-hangar.png](screenshots/01-my-hangar.png)             | 1280×800 | Screenshots of both stores, in this order   |
| [02-buy-back.png](screenshots/02-buy-back.png)               | 1280×800 |                                             |
| [03-pledge-upgrades.png](screenshots/03-pledge-upgrades.png) | 1280×800 |                                             |
| [04-theme-rsi.png](screenshots/04-theme-rsi.png)             | 1280×800 |                                             |
| [05-settings.png](screenshots/05-settings.png)               | 1280×800 |                                             |
| [small-tile-440x280.png](small-tile-440x280.png)             | 440×280  | Chrome: small promo tile (required)         |
| [marquee-1400x560.png](marquee-1400x560.png)                 | 1400×560 | Chrome: marquee promo tile (optional)       |
| [screenshots-opera/](screenshots-opera)                      | 612×408  | Opera: the same screenshots, smaller        |
| [promo-300x188.png](promo-300x188.png)                       | 300×188  | Opera: promotional image                    |
| [icon-64x64.png](icon-64x64.png)                             | 64×64    | Opera: icon (made by `pnpm icons`)          |
| [social-preview-1280x640.png](social-preview-1280x640.png)   | 1280×640 | GitHub: Settings → General → Social preview |

The store icon is the extension's own, [public/icon/128.png](../public/icon/128.png): the logo at
96 px with 16 px of transparent padding, as the Chrome Web Store asks for.

The screenshots are taken in the demo mode (Settings), so they show made-up pledge and order IDs,
at exactly 1280×800: in Chrome's DevTools, device toolbar "Responsive" with 1280 × 800 and DPR 1,
then "Capture screenshot". Check that RSI's header with the account name isn't in the picture.
Both stores take PNG or JPEG without transparency.

Opera allows screenshots of at most 800×600 and prefers 612×408 (3:2). The Opera images are made
from the ones above: the screenshots cropped by 40 px on the left and right to 1200×800 and scaled
down, the promotional image scaled down from the small tile (300×191, then 1 px cut off at the top
and 2 px at the bottom).

## Where each text goes

**Chrome Web Store** (Developer Dashboard):

- **Summary**: taken from the manifest's `description`, i.e. `extDescription` in
  `src/locales/<lang>.json` (max. 132 characters). The listings repeat it; change it in the locale
  files.
- **Description**: "Description" of each language (max. 16,000 characters).
- **Category**: Tools. **Language**: the four languages of the extension.
- **Privacy practices** tab: single purpose, permission justifications, data usage and the
  privacy policy URL – see [review.md](review.md).
- **Test instructions**: no login data, only the short notes – see [review.md](review.md).

**Firefox Add-ons** (addons.mozilla.org):

- **Summary**: max. 250 characters per language, see the listings.
- **Description**: per language; AMO supports a few HTML tags, plain text works as well.
- **Categories**: Games & Entertainment, Shopping (or as AMO offers them).
- **Privacy policy**: the text of [PRIVACY.md](../PRIVACY.md) or its URL.
- **Notes to reviewer** and the source code: see [review.md](review.md). `pnpm zip:firefox`
  writes the sources zip next to the extension's zip.
- **Release notes** of a version: from [CHANGELOG.md](../CHANGELOG.md).

**Opera Add-ons** (addons.opera.com/developer):

- **Package**: the Chrome zip (`pnpm zip:chrome`); Opera runs the Chrome build.
- **Summary and description**: from the listings, as for the Chrome Web Store.
- **Screenshots, promotional image and icon**: the Opera images above.
- **Service website URL**: the repository. **Extension support page URL**: its issues.
- The two **Extension source code URL** fields and **Build instructions**, and the notes for the moderators in
  the version's conversation: see [review.md](review.md).

**All stores**: homepage and support URL are the repository and its issues, the privacy policy is
<https://github.com/exrelax/star-citizen-hangar-manager/blob/main/PRIVACY.md>.

## Keeping them current

The listings summarize [docs/FEATURES.md](../docs/FEATURES.md). When a feature is added, changed
or removed there, update the listings in all four languages, and [review.md](review.md) when the
extension gets new permissions or talks to new websites.
