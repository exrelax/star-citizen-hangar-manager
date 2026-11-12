/*
 * The ships of Star Citizen with their slowly changing facts and a history of them, published on
 * the website as `data/ships.json` (#107), so the extension can read them without contacting
 * third parties and without loading RSI's large Ship Matrix itself (#109):
 * - `status`: the production status, from RSI's Ship Matrix ("flight-ready", "in-concept").
 * - `alwaysAvailable`: whether the ship is always available in the Pledge Store, from the Star
 *   Citizen Wiki's "Pledge availability" (only the exact value "Always available" counts).
 * - `msrp`: the standard price in USD, from the wiki's "Pledge price".
 * Prices that change within hours (warbond, sales) and what is on sale right now are left out:
 * a daily read can't follow them, and the extension reads them live from RSI's upgrade tool.
 *
 * Each fact is a list of periods, `{ value, from, to }` (`alwaysAvailable` without `value`: the
 * periods in which it was). The last period without `to` is the current value. Dates are the days
 * (UTC) a run first saw a value – not the day RSI changed it, and the wiki may lag behind; the
 * first run starts every period on its own day. `revision` counts the runs that changed anything,
 * `changedAt` is the last one.
 *
 * Sources: the Ship Matrix (`/ship-matrix/index`, public; its ids are the upgrade tool's) and the
 * wiki's structured data – the Bucket table `vehicle` behind its "List of pledge vehicles", read
 * with `api.php?action=bucket` instead of scraping HTML. The wiki's content is CC BY-SA 4.0, so the
 * file names both sources and the license. Wiki vehicles are matched to the Ship Matrix by name:
 * exactly (case and punctuation aside), else if exactly one Ship Matrix name contains all words of
 * the wiki's name or the other way round ("C8R Pisces Rescue" → "C8R Pisces"); the others are
 * listed in the log.
 *
 * Run by the website workflow before the build (`pnpm site:ships`, Node runs this file as is). The
 * history continues from the committed file; the workflow commits it back when `revision` changed.
 * If a source fails or looks broken (far fewer ships than before), the file is kept and the run
 * fails, so the last deployment stays. A fact a source doesn't give for a ship (e.g. a vehicle
 * the wiki doesn't list) keeps its current period instead of ending it.
 */

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const WIKI_API = 'https://starcitizen.tools/api.php';
export const SHIP_MATRIX_URL = 'https://robertsspaceindustries.com/ship-matrix/index';
const OUTPUT = fileURLToPath(new URL('../public/data/ships.json', import.meta.url));

/**
 * Names the build and how to reach the project, as wikis ask of automated requests (e.g. to
 * contact before blocking it).
 */
export const USER_AGENT =
  'StarCitizenHangarManager-SiteBuild/1.0 (+https://github.com/exrelax/star-citizen-hangar-manager)';

/** Fewer than these: a source is broken. */
export const MIN_MATRIX_SHIPS = 150;
export const MIN_WIKI_VEHICLES = 150;
export const MIN_ALWAYS_AVAILABLE = 20;
/** Fewer than this share of what the file had: a source is broken. */
export const MIN_SHARE_OF_PREVIOUS = 0.8;

export const SOURCES = [
  {
    id: 'ship-matrix',
    name: 'RSI Ship Matrix',
    url: 'https://robertsspaceindustries.com/ship-matrix',
    facts: ['id', 'name', 'manufacturer', 'status'],
  },
  {
    id: 'starcitizen-tools',
    name: 'Star Citizen Wiki',
    url: 'https://starcitizen.tools/List_of_pledge_vehicles',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    facts: ['alwaysAvailable', 'msrp'],
  },
];

export type ProductionStatus = 'flight-ready' | 'in-concept';

export interface Period<T = undefined> {
  value?: T;
  /** First day (UTC, `YYYY-MM-DD`) a run saw it. */
  from: string;
  /** First day it was seen no longer; missing while it lasts. */
  to?: string;
}

export interface ShipEntry {
  /** The ship's id in the Ship Matrix and the upgrade tool. */
  id: number;
  name: string;
  manufacturer?: string;
  /**
   * The wiki vehicle it was matched with. Kept: if the wiki drops that name, the ship counts as
   * not seen there instead of being matched with another vehicle (e.g. a variant).
   */
  wikiName?: string;
  status: Period<string>[];
  alwaysAvailable: Period[];
  msrp: Period<number>[];
}

export interface ShipsFile {
  schemaVersion: 1;
  /** Counts the runs that changed anything. */
  revision: number;
  /** The last run that changed anything. */
  changedAt: string;
  /** The last run. */
  generatedAt: string;
  sources: typeof SOURCES;
  ships: ShipEntry[];
}

export interface MatrixShip {
  id: number;
  name: string;
  manufacturer?: string;
  status?: string;
}

export interface WikiVehicle {
  name: string;
  alwaysAvailable: boolean;
  msrp?: number;
}

/** What this run saw of a ship; a fact left out is unknown (its current period stays). */
export interface Observation {
  id: number;
  name: string;
  manufacturer?: string;
  wikiName?: string;
  status?: string;
  alwaysAvailable?: boolean;
  msrp?: number;
}

/** The Bucket query for every vehicle with its pledge availability and price. */
export const WIKI_QUERY =
  "bucket('vehicle').select('page_name','pledge_availability','pledge_price').limit(1000).run()";

/** The vehicles of the wiki's answer; throws if it has none. */
export function parseWiki(json: unknown): WikiVehicle[] {
  const rows = (json as { bucket?: unknown } | null)?.bucket;
  if (!Array.isArray(rows)) throw new Error('The wiki answered without data');
  const byName = new Map<string, WikiVehicle>();
  for (const row of rows as {
    page_name?: unknown;
    pledge_availability?: unknown;
    pledge_price?: unknown;
  }[]) {
    if (typeof row?.page_name !== 'string' || byName.has(row.page_name.trim())) continue;
    const price = row.pledge_price;
    byName.set(row.page_name.trim(), {
      name: row.page_name.trim(),
      alwaysAvailable: row.pledge_availability === 'Always available',
      ...(typeof price === 'number' && price > 0 && { msrp: price }),
    });
  }
  return [...byName.values()];
}

/** The ships of the Ship Matrix's answer; throws if it has none. */
export function parseShipMatrix(json: unknown): MatrixShip[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data) || !data.length) throw new Error('The Ship Matrix listed no ships');
  return (
    data as {
      id?: unknown;
      name?: unknown;
      manufacturer?: { name?: unknown } | null;
      production_status?: unknown;
    }[]
  ).flatMap((ship) =>
    typeof ship?.id === 'number' && typeof ship.name === 'string'
      ? [
          {
            id: ship.id,
            name: ship.name.trim(),
            ...(typeof ship.manufacturer?.name === 'string' && {
              manufacturer: ship.manufacturer.name.trim(),
            }),
            ...(typeof ship.production_status === 'string' && {
              status: ship.production_status,
            }),
          },
        ]
      : [],
  );
}

const words = (name: string) => name.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * The wiki's vehicles by Ship Matrix id. A ship matched in an earlier run keeps its wiki vehicle
 * (`known`, by name): matched again by that name, or – if the wiki dropped it – not at all. The
 * others: exact names first, then the only ship either name contains, if that ship is the only
 * one the vehicle fits and no other vehicle fits that ship. Returns the unmatched names too.
 */
export function matchVehicles(
  matrix: readonly MatrixShip[],
  vehicles: readonly WikiVehicle[],
  known: ReadonlyMap<number, string> = new Map(),
): { byId: Map<number, WikiVehicle>; unmatched: string[] } {
  const byName = new Map(vehicles.map((vehicle) => [vehicle.name, vehicle]));
  const byId = new Map<number, WikiVehicle>();
  const taken = new Set<string>();
  const take = (id: number, vehicle: WikiVehicle) => {
    byId.set(id, vehicle);
    taken.add(vehicle.name);
  };
  for (const [id, name] of known) {
    const vehicle = byName.get(name);
    if (vehicle) take(id, vehicle);
  }
  const open = matrix.filter((ship) => !known.has(ship.id));
  const exact = new Map(open.map((ship) => [words(ship.name).join(' '), ship]));
  for (const vehicle of vehicles) {
    if (taken.has(vehicle.name)) continue;
    const ship = exact.get(words(vehicle.name).join(' '));
    if (ship && !byId.has(ship.id)) take(ship.id, vehicle);
  }
  const fits = (ship: MatrixShip, vehicle: WikiVehicle) => {
    const own = words(vehicle.name);
    const other = words(ship.name);
    const ownSet = new Set(own);
    const otherSet = new Set(other);
    return other.every((word) => ownSet.has(word)) || own.every((word) => otherSet.has(word));
  };
  const rest = vehicles.filter((vehicle) => !taken.has(vehicle.name));
  for (const vehicle of rest) {
    const candidates = open.filter((ship) => !byId.has(ship.id) && fits(ship, vehicle));
    const ship = candidates.length === 1 ? candidates[0]! : undefined;
    const rivals = ship ? rest.filter((other) => fits(ship, other)).length : 0;
    if (ship && rivals === 1) take(ship.id, vehicle);
  }
  const unmatched = vehicles
    .filter((vehicle) => !taken.has(vehicle.name))
    .map((vehicle) => vehicle.name)
    .sort((a, b) => a.localeCompare(b));
  return { byId, unmatched };
}

/** What this run saw of every Ship Matrix ship. */
export function observe(
  matrix: readonly MatrixShip[],
  vehicles: readonly WikiVehicle[],
  previous?: ShipsFile,
): { observations: Observation[]; unmatched: string[] } {
  const known = new Map(
    (previous?.ships ?? []).flatMap((ship) =>
      ship.wikiName ? [[ship.id, ship.wikiName] as const] : [],
    ),
  );
  const { byId, unmatched } = matchVehicles(matrix, vehicles, known);
  const observations = matrix.map((ship): Observation => {
    const vehicle = byId.get(ship.id);
    return {
      id: ship.id,
      name: ship.name,
      ...(ship.manufacturer && { manufacturer: ship.manufacturer }),
      ...(ship.status && { status: ship.status }),
      ...(vehicle && { wikiName: vehicle.name, alwaysAvailable: vehicle.alwaysAvailable }),
      ...(vehicle?.msrp !== undefined && { msrp: vehicle.msrp }),
    };
  });
  return { observations, unmatched };
}

/** The open period of a list, if any. */
const current = <T>(periods: readonly Period<T>[]) => periods.find((period) => !period.to);

/**
 * Continues a fact's periods with what was seen today: a new value ends the open period and opens
 * one with it; `undefined` (not seen) changes nothing. Returns whether anything changed.
 */
function continueValue<T>(periods: Period<T>[], value: T | undefined, day: string): boolean {
  if (value === undefined) return false;
  const open = current(periods);
  if (open && open.value === value) return false;
  if (open) open.to = day;
  periods.push({ value, from: day });
  return true;
}

/** The same for a yes/no fact: periods only while it is true. */
function continueFlag(periods: Period[], value: boolean | undefined, day: string): boolean {
  if (value === undefined) return false;
  const open = current(periods);
  if (value && !open) {
    periods.push({ from: day });
    return true;
  }
  if (!value && open) {
    open.to = day;
    return true;
  }
  return false;
}

/**
 * The file after this run: the previous ships continued with today's observations, new ships
 * added; ships no longer in the Ship Matrix stay as they were. `revision` and `changedAt` move
 * only if anything changed.
 */
export function continueFile(
  previous: ShipsFile | undefined,
  observations: readonly Observation[],
  now: string,
): { file: ShipsFile; changed: boolean } {
  const day = now.slice(0, 10);
  const ships = new Map<number, ShipEntry>(
    (previous?.ships ?? []).map((ship) => [ship.id, structuredClone(ship)]),
  );
  let changed = !previous;
  for (const seen of observations) {
    let ship = ships.get(seen.id);
    if (!ship) {
      ship = { id: seen.id, name: seen.name, status: [], alwaysAvailable: [], msrp: [] };
      if (seen.manufacturer) ship.manufacturer = seen.manufacturer;
      ships.set(seen.id, ship);
      changed = true;
    }
    if (ship.name !== seen.name) {
      ship.name = seen.name;
      changed = true;
    }
    if (seen.manufacturer && ship.manufacturer !== seen.manufacturer) {
      ship.manufacturer = seen.manufacturer;
      changed = true;
    }
    if (seen.wikiName && ship.wikiName !== seen.wikiName) {
      ship.wikiName = seen.wikiName;
      changed = true;
    }
    changed = continueValue(ship.status, seen.status, day) || changed;
    changed = continueFlag(ship.alwaysAvailable, seen.alwaysAvailable, day) || changed;
    changed = continueValue(ship.msrp, seen.msrp, day) || changed;
  }
  const revision = (previous?.revision ?? 0) + (changed ? 1 : 0);
  return {
    file: {
      schemaVersion: 1,
      revision,
      changedAt: changed || !previous ? now : previous.changedAt,
      generatedAt: now,
      sources: SOURCES,
      ships: [...ships.values()].sort((a, b) => a.id - b.id),
    },
    changed,
  };
}

/** Why today's sources look broken compared with the file, if they do. */
export function brokenReason(
  matrix: readonly MatrixShip[],
  vehicles: readonly WikiVehicle[],
  previous: ShipsFile | undefined,
): string | undefined {
  const alwaysAvailable = vehicles.filter((vehicle) => vehicle.alwaysAvailable).length;
  if (matrix.length < MIN_MATRIX_SHIPS) return `the Ship Matrix listed only ${matrix.length} ships`;
  if (vehicles.length < MIN_WIKI_VEHICLES)
    return `the wiki listed only ${vehicles.length} vehicles`;
  if (alwaysAvailable < MIN_ALWAYS_AVAILABLE) {
    return `the wiki listed only ${alwaysAvailable} always available ships`;
  }
  if (!previous) return undefined;
  const before = previous.ships.length;
  if (matrix.length < before * MIN_SHARE_OF_PREVIOUS) {
    return `the Ship Matrix listed only ${matrix.length} ships, the file has ${before}`;
  }
  const availableBefore = previous.ships.filter((ship) => current(ship.alwaysAvailable)).length;
  if (alwaysAvailable < availableBefore * MIN_SHARE_OF_PREVIOUS) {
    return `the wiki listed only ${alwaysAvailable} always available ships, the file has ${availableBefore}`;
  }
  return undefined;
}

/**
 * The file as written: the head indented, then one ship per line, so a change shows as a changed
 * line in the history. Left out of Prettier (`.prettierignore`).
 */
export function serialize(file: ShipsFile): string {
  const { ships, ...head } = file;
  const headLines = JSON.stringify(head, null, 2).slice(0, -2);
  // Always in the same order of fields, whatever order they were added in.
  const shipLines = ships
    .map(({ id, name, manufacturer, wikiName, status, alwaysAvailable, msrp }) =>
      JSON.stringify({ id, name, manufacturer, wikiName, status, alwaysAvailable, msrp }),
    )
    .map((line) => `    ${line}`)
    .join(',\n');
  return `${headLines},\n  "ships": [\n${shipLines}\n  ]\n}\n`;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function readPrevious(): Promise<ShipsFile | undefined> {
  try {
    const file = JSON.parse(await readFile(OUTPUT, 'utf8')) as ShipsFile;
    return file.schemaVersion === 1 && Array.isArray(file.ships) ? file : undefined;
  } catch {
    return undefined;
  }
}

/** Tells the workflow whether to commit the file (`changed=true|false`), if it runs in one. */
async function reportChanged(changed: boolean, revision?: number) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  await appendFile(output, `changed=${changed}\n${revision ? `revision=${revision}\n` : ''}`);
}

/** Reads both sources and writes the file; keeps it and fails if anything looks wrong. */
async function main() {
  const query = new URLSearchParams({ action: 'bucket', query: WIKI_QUERY, format: 'json' });
  try {
    const [vehicles, matrix, previous] = await Promise.all([
      fetchJson(`${WIKI_API}?${query}`).then(parseWiki),
      fetchJson(SHIP_MATRIX_URL).then(parseShipMatrix),
      readPrevious(),
    ]);
    const broken = brokenReason(matrix, vehicles, previous);
    if (broken) throw new Error(`The sources look broken: ${broken}`);
    const { observations, unmatched } = observe(matrix, vehicles, previous);
    const { file, changed } = continueFile(previous, observations, new Date().toISOString());
    await writeFile(OUTPUT, serialize(file));
    await reportChanged(changed, file.revision);
    console.log(
      `Ships: ${file.ships.length} written to ${OUTPUT}, revision ${file.revision}` +
        (changed ? ' (changed)' : ' (unchanged)'),
    );
    if (unmatched.length)
      console.log(`Wiki vehicles without a Ship Matrix id: ${unmatched.join(', ')}`);
  } catch (error) {
    // A GitHub Actions annotation, shown on the run; the file stays as it was.
    console.error(`::error::Ships not updated: ${(error as Error).message}`);
    await reportChanged(false);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
