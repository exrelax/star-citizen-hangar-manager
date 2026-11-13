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

| File                                                                             | Size     | Where                                       |
| -------------------------------------------------------------------------------- | -------- | ------------------------------------------- |
| [01-my-hangar.png](screenshots/01-my-hangar.png)                                 | 1280×800 | Screenshots of Chrome, Firefox and Edge     |
| [02-buy-back.png](screenshots/02-buy-back.png)                                   | 1280×800 | (in this order)                             |
| [03-pledge-store-ccu.png](screenshots/03-pledge-store-ccu.png)                   | 1280×800 |                                             |
| [04-paint-discount-consultant.png](screenshots/04-paint-discount-consultant.png) | 1280×800 |                                             |
| [05-ccu-base-ship-overview.png](screenshots/05-ccu-base-ship-overview.png)       | 1280×800 |                                             |
| [small-tile-440x280.png](small-tile-440x280.png)                                 | 440×280  | Chrome, Edge: small promotional tile        |
| [marquee-1400x560.png](marquee-1400x560.png)                                     | 1400×560 | Chrome, Edge: marquee / large tile (opt.)   |
| [screenshots-opera/](screenshots-opera)                                          | 612×408  | Opera: the same screenshots, smaller        |
| [promo-300x188.png](promo-300x188.png)                                           | 300×188  | Opera: promotional image                    |
| [icon-64x64.png](icon-64x64.png)                                                 | 64×64    | Opera: icon (made by `pnpm icons`)          |
| [logo-300x300.png](logo-300x300.png)                                             | 300×300  | Edge: store logo (made by `pnpm icons`)     |
| [social-preview-1280x640.png](social-preview-1280x640.png)                       | 1280×640 | GitHub: Settings → General → Social preview |

The store icon is the extension's own, [public/icon/128.png](../public/icon/128.png): the logo at
96 px with 16 px of transparent padding, as the Chrome Web Store asks for.

The screenshots are taken in the demo mode (Settings), so they show made-up pledge and order IDs,
at exactly 1280×800: in Chrome's DevTools, device toolbar "Responsive" with 1280 × 800 and DPR 1,
then "Capture screenshot". Check that RSI's header with the account name isn't in the picture.
The stores take PNG or JPEG without transparency.

The Edge logo is padded like the 128 px icon (the logo at 224 px, 38 px around it), so it looks
the same as in the Chrome Web Store.

Opera allows screenshots of at most 800×600 and prefers 612×408 (3:2). The Opera images are made
from the ones above: the screenshots cropped by 40 px on the left and right to 1200×800 and scaled
down, the promotional image scaled down from the small tile (300×191, then 1 px cut off at the top
and 2 px at the bottom).

The marquee and the social preview show the first screenshot in front of another one, next to
the name, the claim and four short points of the listing. They are composed as a web page and
rendered at their exact size; after new screenshots or texts, render them again. The small tile
and Opera's promotional image show only the name and need no update.

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

**Microsoft Edge Add-ons** (Microsoft Partner Center, partner.microsoft.com/dashboard):

- **Package**: the Chrome zip (`pnpm zip:chrome`); Edge runs the Chrome build.
- **Store listings**: add all four languages, each with the description from its listing. A
  language without its own description shows the English one (see
  [#31](https://github.com/exrelax/star-citizen-hangar-manager/issues/31)). The short description
  comes from the manifest, as for the Chrome Web Store.
- **Images**: the store logo above, the screenshots, the small tile and optionally the marquee as
  large promotional tile.
- **Properties**: the category closest to Chrome's Tools (e.g. Productivity), the privacy policy
  URL, website and support URL as for all stores.
- **Notes for certification**: see [review.md](review.md).

**All stores**: homepage and support URL are the repository and its issues, the privacy policy is
the website's page <https://exrelax.github.io/star-citizen-hangar-manager/privacy.html> (made from [PRIVACY.md](../PRIVACY.md)).

## Keeping them current

The listings summarize [docs/FEATURES.md](../docs/FEATURES.md). When a feature is added, changed
or removed there, update the listings in all four languages, and [review.md](review.md) when the
extension gets new permissions or talks to new websites.
