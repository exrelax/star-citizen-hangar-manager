# Contributing to Star Citizen Hangar Manager

Thanks for helping to improve the Star Citizen Hangar Manager! This guide explains how to report
problems, suggest features and contribute code, so your work can be reviewed and merged quickly.

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).

## Ways to contribute

- **Report a bug** – open an [issue](#reporting-bugs) with the "Bug report" form.
- **Suggest a feature** – start a discussion in
  [Ideas](https://github.com/exrelax/star-citizen-hangar-manager/discussions/categories/ideas) and
  describe the problem it solves; no code needed. Others can vote and comment, and approved ideas
  become issues. Please wait for that before you start coding a feature, so we can agree on the
  approach first.
- **Improve a translation** – the extension speaks English, German, French and Spanish. Native
  speakers are very welcome to review the texts in `src/locales/`.
- **Contribute code** – fix a bug or build an agreed feature in a [pull request](#pull-requests).

## Principles

Every contribution has to keep these promises of the extension (see
[docs/FEATURES.md](docs/FEATURES.md)):

- **Private by design.** No hangar data, pledge or order IDs, names or addresses leave the
  browser. The extension talks to RSI's website and reads public ship data; it never sends user
  data to other servers. New external requests need to be discussed in an issue first.
- **Fast and out of the way.** Long lists stay smooth, refreshes run in the background, and the
  manager never blocks the page.
- **Gentle on RSI.** Requests to RSI are few, spaced and retried with care.
- **An addition, not a replacement.** RSI's own pages ("My Gear", "Buy Back Pledges") keep working
  as before.
- **Destructive actions only on the user's click.** Exchanging (melting) and gifting pledges are
  sent to RSI only when the user submits the dialog. Never automate them, and never submit them
  with a real account while developing or testing.

## Getting started

Setup, commands and how to load the extension in Chrome or Firefox are described in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md):

1. Fork the repository and clone your fork.
2. Install the dependencies as described in [Installation](docs/DEVELOPMENT.md#installation).
3. Run the extension in dev mode ([Trying the extension in the browser](docs/DEVELOPMENT.md#trying-the-extension-in-the-browser)).
4. Create a branch from `main` for your change, e.g. `fix/refresh-button-width` or
   `feat/sort-pledges`.

The dev build adds a [styleguide](docs/DEVELOPMENT.md#styleguide) page with all building blocks of the
manager and made-up pledges – the quickest way to check a visual change.

## Coding guidelines

- **English only** in code, comments, documentation and commit messages. The user-facing texts
  live in `src/locales/` and are translated there.
- **Follow the existing code.** Match its naming, structure and comment density. Comments explain
  why something is done, not what the next line does.
- **Formatting and linting** are done by Prettier and ESLint (`pnpm format`, `pnpm lint`).
- **Tests** – add or update Vitest tests for logic (parsing, filters, calculations). Tests live next
  to the code they test (`*.test.ts`).
- **Tunable values** (intervals, page sizes, limits) belong in `src/config.ts`.
- **Both themes** – check visual changes in "Modern Hangar" (light and dark system appearance) and
  in "Classic RSI". Theme styles live in `src/themes/`.
- **Translations** – add every new text to all locale files (`en`, `de`, `fr`, `es`). A test checks
  that all locales have the same keys and placeholders. If you can't translate a text, add the
  English text and mention it in the pull request.
- **RSI's own texts** in the exchange and gift dialogs stay in RSI's English wording by default;
  translations of them are optional (see the setting "Translate RSI's texts" under "Experimental").
- **Icons** – add an SVG to `src/assets/svg-sprites/<set>/` and run `pnpm svg-sprite`; for the
  extension icon change the logo in `src/assets/logo/` and run `pnpm icons`
  (see [Icons](docs/DEVELOPMENT.md#icons)). Commit the generated files together with their sources.

Before you open a pull request, run:

```bash
pnpm format:check
pnpm compile
pnpm lint
pnpm test
```

The [CI workflow](.github/workflows/ci.yml) runs the same checks, plus the production builds of
both browsers, on every pull request and every push to `main`.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

- **Types:** `feat` (new feature), `fix` (bug fix), `docs`, `style` (formatting only),
  `refactor`, `perf`, `test`, `build` (build system, dependencies), `ci`, `chore`.
- **Description:** imperative, in English, without a period at the end – e.g.
  `feat: Add Spanish as fourth language` or `fix: Keep the refresh button's width while counting`.
- **Body:** explains what changed and why, when the description alone doesn't say it.
- **Breaking changes:** add `!` after the type (`feat!: …`) and a `BREAKING CHANGE:` footer, e.g.
  when stored settings or data can no longer be read.

One commit should contain one logical change. Don't mix a refactoring with a feature in the same
commit.

## Pull requests

**Keep pull requests as small as possible: one pull request for exactly one bug fix, one feature or
one refactoring.** Small pull requests are reviewed faster, are easier to test and can be reverted
on their own if needed. If your work touches several topics, split it into several pull requests.

- Open the pull request against `main` and link the issue it resolves (`Fixes #123`).
- Describe what changed and why, and how you tested it (browser, theme, language).
- Add screenshots for visual changes – ideally of both themes. Use the demo mode or the setting
  "Hide pledge and order IDs, name and address" so no personal data shows up.
- Keep unrelated changes out: no drive-by formatting or renaming in other files.
- Keep your branch up to date with `main` and make sure all checks pass.
- Update the documentation (README, [docs/FEATURES.md](docs/FEATURES.md),
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)) when you change behaviour that is described there.

## Reporting bugs

Please search the existing issues first, then use the "Bug report" form. A good bug report
contains:

- what you did, what you expected and what happened instead
- browser and version (Chrome or Firefox), the extension's version (settings → "About"), theme and
  language
- messages in the browser console that start with `[star-citizen-hangar-manager]`
- screenshots, if they help

New reports are checked first; once a bug is confirmed, it moves to the backlog.

**Never post personal data** in an issue: no pledge or order IDs, names, email or billing
addresses, and no passwords or session tokens. Use the demo mode or the hide settings for
screenshots.

## Security issues

Please don't report security problems in a public issue. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
of this repository instead.
