/*
 * The ships that are always available in the Pledge Store, published on the website as
 * `data/always-available-ships.json` (#107), so the extension can read them without contacting
 * third parties (#109).
 *
 * Source: the Star Citizen Wiki's "List of pledge vehicles" (starcitizen.tools), column "Pledge
 * availability" = "Always available". The list is read from the wiki's structured data – the
 * Bucket table `vehicle` that the list itself is built from (`Module:PledgeVehicleGrid`) – via its
 * API (`action=bucket`), not by scraping the HTML. Its content is licensed CC BY-SA 4.0, so the
 * file names the source and the license.
 *
 * Ships are matched to the ids of RSI's Ship Matrix, which the upgrade tool uses too: by name,
 * exactly (case and punctuation aside), else if exactly one Ship Matrix name contains all words of
 * the wiki's name or the other way round ("C8R Pisces Rescue" → "C8R Pisces"). Ambiguous or
 * unknown names keep no id and are listed in the log.
 *
 * Run by the website workflow before the build (`pnpm site:ships`, Node runs this file as is). If a
 * source can't be read or the result looks broken (fewer than `MIN_SHIPS`, or far fewer than the
 * file had), the file is kept and the run fails, so the last deployment stays.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const WIKI_API = 'https://starcitizen.tools/api.php';
export const SHIP_MATRIX_URL = 'https://robertsspaceindustries.com/ship-matrix/index';
const OUTPUT = fileURLToPath(
  new URL('../public/data/always-available-ships.json', import.meta.url),
);

/**
 * Names the build and how to reach the project, as wikis ask of automated requests (e.g. to
 * contact before blocking it).
 */
export const USER_AGENT =
  'StarCitizenHangarManager-SiteBuild/1.0 (+https://github.com/exrelax/star-citizen-hangar-manager)';

/** Fewer ships than this: the source is broken. */
export const MIN_SHIPS = 20;
/** Fewer than this share of the ships the file had: the source is broken. */
export const MIN_SHARE_OF_PREVIOUS = 0.8;

export const SOURCE = {
  id: 'starcitizen-tools',
  name: 'Star Citizen Wiki',
  url: 'https://starcitizen.tools/List_of_pledge_vehicles',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
} as const;

export interface AlwaysAvailableShip {
  /** The name in the source. */
  name: string;
  /** The ship's id in the Ship Matrix and the upgrade tool, if matched. */
  upgradeToolId?: number;
  sources: string[];
}

export interface AlwaysAvailableShipsFile {
  schemaVersion: 1;
  generatedAt: string;
  sources: (typeof SOURCE)[];
  ships: AlwaysAvailableShip[];
}

interface MatrixShip {
  id: number;
  name: string;
}

/** The Bucket query for the vehicles whose pledge availability is "Always available". */
export const WIKI_QUERY =
  "bucket('vehicle').select('page_name','pledge_availability')" +
  ".where('pledge_availability','Always available').limit(1000).run()";

/** The names of the always available ships in the wiki's answer; throws if it has none. */
export function parseWiki(json: unknown): string[] {
  const rows = (json as { bucket?: unknown } | null)?.bucket;
  if (!Array.isArray(rows)) throw new Error('The wiki answered without data');
  const names = rows.flatMap((row: { page_name?: unknown; pledge_availability?: unknown }) =>
    row?.pledge_availability === 'Always available' && typeof row.page_name === 'string'
      ? [row.page_name.trim()]
      : [],
  );
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** The ships of the Ship Matrix's answer; throws if it has none. */
export function parseShipMatrix(json: unknown): MatrixShip[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data) || !data.length) throw new Error('The Ship Matrix listed no ships');
  return data.flatMap((ship: { id?: unknown; name?: unknown }) =>
    typeof ship?.id === 'number' && typeof ship.name === 'string'
      ? [{ id: ship.id, name: ship.name.trim() }]
      : [],
  );
}

const words = (name: string) => name.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** Finds the Ship Matrix ship of a name: exactly, else the only one either name contains. */
export function createMatcher(ships: readonly MatrixShip[]) {
  const exact = new Map(ships.map((ship) => [words(ship.name).join(' '), ship]));
  return (name: string): MatrixShip | undefined => {
    const own = words(name);
    const found = exact.get(own.join(' '));
    if (found) return found;
    const ownSet = new Set(own);
    const candidates = ships.filter((ship) => {
      const other = words(ship.name);
      const otherSet = new Set(other);
      return other.every((word) => ownSet.has(word)) || own.every((word) => otherSet.has(word));
    });
    return candidates.length === 1 ? candidates[0] : undefined;
  };
}

/** The file's content: every always available ship, with its id where it matched. */
export function buildFile(
  names: readonly string[],
  matrix: readonly MatrixShip[],
  generatedAt: string,
): { file: AlwaysAvailableShipsFile; unmatched: string[] } {
  const match = createMatcher(matrix);
  const unmatched: string[] = [];
  const ships = names.map((name): AlwaysAvailableShip => {
    const ship = match(name);
    if (!ship) unmatched.push(name);
    return { name, ...(ship && { upgradeToolId: ship.id }), sources: [SOURCE.id] };
  });
  return {
    file: { schemaVersion: 1, generatedAt, sources: [SOURCE], ships },
    unmatched,
  };
}

/** Why a new list looks broken compared with the file it would replace, if it does. */
export function brokenReason(count: number, previousCount: number | undefined): string | undefined {
  if (count < MIN_SHIPS) return `only ${count} ships (at least ${MIN_SHIPS} expected)`;
  if (previousCount && count < previousCount * MIN_SHARE_OF_PREVIOUS) {
    return `only ${count} ships, the file had ${previousCount}`;
  }
  return undefined;
}

/** As Prettier writes it (the repository's format): lists of strings on one line. */
export const serialize = (file: AlwaysAvailableShipsFile): string =>
  `${JSON.stringify(file, null, 2).replace(
    /\[\s+((?:"[^"\n]*",?\s+)+)\]/g,
    (_, items: string) => `[${items.trim().split(/,\s+/).join(', ')}]`,
  )}\n`;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function previousCount(): Promise<number | undefined> {
  try {
    const file = JSON.parse(await readFile(OUTPUT, 'utf8')) as Partial<AlwaysAvailableShipsFile>;
    return Array.isArray(file.ships) ? file.ships.length : undefined;
  } catch {
    return undefined;
  }
}

/** Reads both sources and writes the file; keeps it and fails if anything looks wrong. */
async function main() {
  const wikiUrl = `${WIKI_API}?${new URLSearchParams({ action: 'bucket', query: WIKI_QUERY, format: 'json' })}`;
  try {
    const [names, matrix] = await Promise.all([
      fetchJson(wikiUrl).then(parseWiki),
      fetchJson(SHIP_MATRIX_URL).then(parseShipMatrix),
    ]);
    const broken = brokenReason(names.length, await previousCount());
    if (broken) throw new Error(`The list looks broken: ${broken}`);
    const { file, unmatched } = buildFile(names, matrix, new Date().toISOString());
    await writeFile(OUTPUT, serialize(file));
    console.log(`Always available ships: ${file.ships.length} written to ${OUTPUT}`);
    if (unmatched.length) {
      console.log(`Not matched to a Ship Matrix id: ${unmatched.join(', ')}`);
    }
  } catch (error) {
    // A GitHub Actions annotation, shown on the run; the file stays as it was.
    console.error(`::error::Always available ships not updated: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
