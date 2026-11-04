# Store texts

The texts for the extension's store pages. They are kept here so they are versioned with the
code and can be reviewed like the translations in `src/locales/`. On a release, copy them into the
stores' dashboards.

| File                           | What                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| [listing.en.md](listing.en.md) | Store page in English: summary, description, notice              |
| [listing.de.md](listing.de.md) | The same in German                                               |
| [listing.fr.md](listing.fr.md) | The same in French                                               |
| [listing.es.md](listing.es.md) | The same in Spanish                                              |
| [review.md](review.md)         | Answers for the review: single purpose, permissions, data, notes |

The texts in code blocks are meant to be copied as they are: the Chrome Web Store shows the
description as plain text, so they use no Markdown.

## Where each text goes

**Chrome Web Store** (Developer Dashboard):

- **Summary**: taken from the manifest's `description`, i.e. `extDescription` in
  `src/locales/<lang>.json` (max. 132 characters). The listings repeat it; change it in the locale
  files.
- **Description**: "Description" of each language (max. 16,000 characters).
- **Category**: Tools. **Language**: the four languages of the extension.
- **Privacy practices** tab: single purpose, permission justifications, data usage and the
  privacy policy URL – see [review.md](review.md).

**Firefox Add-ons** (addons.mozilla.org):

- **Summary**: max. 250 characters per language, see the listings.
- **Description**: per language; AMO supports a few HTML tags, plain text works as well.
- **Categories**: Games & Entertainment, Shopping (or as AMO offers them).
- **Privacy policy**: the text of [PRIVACY.md](../PRIVACY.md) or its URL.
- **Notes to reviewer** and the source code: see [review.md](review.md). `pnpm zip:firefox`
  writes the sources zip next to the extension's zip.
- **Release notes** of a version: from [CHANGELOG.md](../CHANGELOG.md).

**Both**: homepage and support URL are the repository and its issues, the privacy policy is
<https://github.com/exrelax/star-citizen-hangar-manager/blob/main/PRIVACY.md>.

## Keeping them current

The listings summarize [docs/FEATURES.md](../docs/FEATURES.md). When a feature is added, changed
or removed there, update the listings in all four languages, and [review.md](review.md) when the
extension gets new permissions or talks to new websites.
