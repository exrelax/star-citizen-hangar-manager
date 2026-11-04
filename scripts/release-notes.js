// Prints the section of a version from CHANGELOG.md, for the notes of its GitHub release
// (.github/workflows/release.yml): `node scripts/release-notes.js 1.0.0`.
// A version's section starts with a heading like `## [1.0.0] – 2026-11-30` or `## 1.0.0` and
// ends before the next `## ` heading. Fails if the version has no section or it is empty, so a
// release can't go out without its changes.
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/release-notes.js <version>');
  process.exit(1);
}

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
const escaped = version.replaceAll('.', '\\.');
const heading = new RegExp(`^## \\[?v?${escaped}\\]?(\\s|$)`);

const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
  console.error(`CHANGELOG.md has no section for version ${version}.`);
  process.exit(1);
}
const length = lines.slice(start + 1).findIndex((line) => line.startsWith('## '));
const section = lines
  .slice(start + 1, length === -1 ? undefined : start + 1 + length)
  .join('\n')
  .trim();
if (!section) {
  console.error(`The section for version ${version} in CHANGELOG.md is empty.`);
  process.exit(1);
}
console.log(section);
