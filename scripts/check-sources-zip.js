// Checks that the sources zip for addons.mozilla.org builds the extension (#321): Mozilla's
// reviewers build the add-on from this zip, so it must hold everything the build needs – and
// nothing local. Run after `pnpm zip:firefox`:
//
//   node scripts/check-sources-zip.js
//
// Unzips `.output/*-sources.zip` into a temporary folder, installs and builds the Firefox
// extension there as the review notes say (`store/review.md`), and compares the result with
// `.output/firefox-mv3`, file by file.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const OUTPUT = '.output';
const BUILD = 'firefox-mv3';

function fail(message) {
  console.error(`check-sources-zip: ${message}`);
  process.exit(1);
}

/** Every file below `dir`, relative to it, with the hash of its content. */
function hashesOf(dir) {
  const hashes = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        hashes.set(
          relative(dir, path),
          createHash('sha256').update(readFileSync(path)).digest('hex'),
        );
      }
    }
  };
  walk(dir);
  return hashes;
}

const zips = readdirSync(OUTPUT).filter((name) => name.endsWith('-sources.zip'));
if (zips.length !== 1) {
  fail(
    `expected one sources zip in ${OUTPUT}, found ${zips.length}. Run "pnpm zip:firefox" first.`,
  );
}
const zip = join(OUTPUT, zips[0]);

// Nothing local or uncommitted, e.g. working notes (`*.local.*`).
const listed = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n');
const local = listed.filter((name) => /(^|\/)[^/]*\.local\.[^/]*$/.test(name));
if (local.length) fail(`the sources zip holds local files: ${local.join(', ')}`);

const dir = mkdtempSync(join(tmpdir(), 'shm-sources-'));
try {
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const run = (command, args) => execFileSync(command, args, { cwd: dir, stdio: 'inherit' });
  run('pnpm', ['install', '--frozen-lockfile']);
  run('pnpm', ['build:firefox']);

  const expected = hashesOf(join(OUTPUT, BUILD));
  const built = hashesOf(join(dir, OUTPUT, BUILD));
  const differing = [...new Set([...expected.keys(), ...built.keys()])]
    .filter((file) => expected.get(file) !== built.get(file))
    .sort();
  if (differing.length) {
    fail(
      `the build of the sources zip differs from ${OUTPUT}/${BUILD}:\n  ${differing.join('\n  ')}`,
    );
  }
  console.log(`check-sources-zip: ${zips[0]} builds the same ${expected.size} files.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
