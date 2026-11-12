import { SHIP_FACTS } from '@/config';

/*
 * The ships' facts of the project website (`data/ships.json`, #107, read by #109): for every ship
 * of RSI's Ship Matrix – by the id the upgrade tool uses too – its production status, whether it is
 * always available in the Pledge Store and its standard price, each as a list of periods with the
 * open one as the current value. The extension asks it e.g. whether a base ship is always
 * available (#263, CCU Consultant #106). The file names its sources and which facts each gives.
 */

/** A period of a fact: from the first day it was seen, until the first day it no longer was. */
export interface FactPeriod<T = undefined> {
  value?: T;
  /** `YYYY-MM-DD` (UTC). */
  from: string;
  to?: string;
}

export interface ShipFact {
  /** The ship's id in the Ship Matrix and the upgrade tool. */
  id: number;
  name: string;
  manufacturer?: string;
  /** The wiki vehicle the facts `alwaysAvailable` and `msrp` come from; none if the wiki has none. */
  wikiName?: string;
  status: FactPeriod<string>[];
  alwaysAvailable: FactPeriod[];
  msrp: FactPeriod<number>[];
}

export interface FactSource {
  id: string;
  name: string;
  url: string;
  license?: string;
  licenseUrl?: string;
  /** The facts it gives, e.g. `["alwaysAvailable", "msrp"]`. */
  facts: string[];
}

export interface ShipFacts {
  revision: number;
  /** When the facts last changed, and when the file was last made (ISO). */
  changedAt: string;
  generatedAt: string;
  sources: FactSource[];
  ships: ShipFact[];
}

type Json = Record<string, unknown>;
const record = (value: unknown): Json | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : undefined;
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The valid periods of a list (`isValue`: what a value has to be; none for yes/no facts). */
function periods<T>(value: unknown, isValue?: (value: unknown) => value is T): FactPeriod<T>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): FactPeriod<T>[] => {
    const raw = record(entry);
    const from = raw?.from;
    if (typeof from !== 'string' || !DAY.test(from)) return [];
    const to = typeof raw?.to === 'string' && DAY.test(raw.to) ? raw.to : undefined;
    if (isValue && !isValue(raw?.value)) return [];
    return [{ ...(isValue && { value: raw!.value as T }), from, ...(to && { to }) }];
  });
}

const isText = (value: unknown): value is string => typeof value === 'string' && !!value;
const isPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * The facts of the website's file; `undefined` if it isn't one of the format the extension reads
 * (another `schemaVersion`, no ships), so the stored or bundled facts stay. Invalid ships and
 * periods are left out.
 */
export function parseShipFacts(json: unknown): ShipFacts | undefined {
  const raw = record(json);
  if (!raw || raw.schemaVersion !== SHIP_FACTS.schemaVersion || !Array.isArray(raw.ships)) {
    return undefined;
  }
  const ships = raw.ships.flatMap((entry): ShipFact[] => {
    const ship = record(entry);
    const id = ship?.id;
    const name = text(ship?.name);
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || !name) return [];
    const manufacturer = text(ship?.manufacturer);
    const wikiName = text(ship?.wikiName);
    return [
      {
        id,
        name,
        ...(manufacturer && { manufacturer }),
        ...(wikiName && { wikiName }),
        status: periods(ship?.status, isText),
        alwaysAvailable: periods(ship?.alwaysAvailable),
        msrp: periods(ship?.msrp, isPrice),
      },
    ];
  });
  if (!ships.length) return undefined;
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).flatMap((entry): FactSource[] => {
    const source = record(entry);
    const id = text(source?.id);
    const name = text(source?.name);
    const url = text(source?.url);
    if (!id || !name || !url) return [];
    const license = text(source?.license);
    const licenseUrl = text(source?.licenseUrl);
    return [
      {
        id,
        name,
        url,
        ...(license && { license }),
        ...(licenseUrl && { licenseUrl }),
        facts: Array.isArray(source?.facts) ? source.facts.filter(isText) : [],
      },
    ];
  });
  return {
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
    changedAt: text(raw.changedAt) ?? '',
    generatedAt: text(raw.generatedAt) ?? '',
    sources,
    ships,
  };
}

/** The open period of a list: the current value. */
const current = <T>(list: readonly FactPeriod<T>[]) => list.find((period) => !period.to);

/** Answers questions about the ships' facts; build it once per set of facts. */
export function createShipFactsLookup(facts: ShipFacts) {
  const byId = new Map(facts.ships.map((ship) => [ship.id, ship]));
  /** Whether a source gives a fact (any, if no source is named). */
  const gives = (fact: string, sourceId?: string) =>
    facts.sources.some(
      (source) => (!sourceId || source.id === sourceId) && source.facts.includes(fact),
    );

  return {
    facts,
    sources: facts.sources,
    /** When the facts last changed (the date of the list). */
    changedAt: facts.changedAt,
    ship: (id: number): ShipFact | undefined => byId.get(id),

    /**
     * Whether a ship is always available in the Pledge Store (according to `sourceId`, if named);
     * `undefined` if that isn't known – an unknown ship, a source that doesn't give this fact, or
     * a ship the source doesn't list.
     */
    isAlwaysAvailable(id: number, sourceId?: string): boolean | undefined {
      const ship = byId.get(id);
      if (!ship || !gives('alwaysAvailable', sourceId)) return undefined;
      if (!ship.wikiName && !ship.alwaysAvailable.length) return undefined;
      return current(ship.alwaysAvailable) !== undefined;
    },

    /** Since when a ship is always available (`YYYY-MM-DD`), if it is. */
    alwaysAvailableSince: (id: number): string | undefined =>
      current(byId.get(id)?.alwaysAvailable ?? [])?.from,

    /** The ship's production status, e.g. "flight-ready", "in-concept". */
    status: (id: number): string | undefined => current(byId.get(id)?.status ?? [])?.value,

    /** The ship's standard price in USD. */
    msrp: (id: number): number | undefined => current(byId.get(id)?.msrp ?? [])?.value,
  };
}

export type ShipFactsLookup = ReturnType<typeof createShipFactsLookup>;
