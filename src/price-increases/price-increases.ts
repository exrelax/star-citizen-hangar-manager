import { PRICE_INCREASES } from '@/config';
import { fileList, localizedText, record, text, type LocalizedText } from '@/site-data/site-data';

/*
 * The expected price increases of the Buy Back Reminder (#195), loaded from the project website
 * (`data/price-increases.json`, see "Editing the expected price increases" in DEVELOPMENT.md).
 * Each entry is a ship whose price is expected to rise, identified by its Ship Matrix id, its
 * name and other names RSI uses for it (#187). Every date is an assumption.
 */

/** A point in time of the file: a day, or a time if the probable time is known. */
export interface ExpectedTime {
  /** Epoch milliseconds; for a day its start in UTC. */
  at: number;
  /** Only the day is known: shown without time, over when the day is (UTC). */
  dayOnly?: true;
}

export interface ExpectedPriceIncrease {
  ship: {
    /** The ship's id in the Ship Matrix, also the upgrade tool's and the buy back CCUs'. */
    id: number;
    /** Its name in the Ship Matrix. */
    name: string;
    /** Other names RSI uses for it, e.g. "Hercules Starlifter M2" for "M2 Hercules". */
    aliases?: string[];
  };
  priceIncreaseAt: ExpectedTime;
  /** Left out for ships that are already flight ready. */
  flightReadyAt?: ExpectedTime;
  /** Items that rise with the ship, e.g. its modules, by their exact names. */
  relatedItems?: { name: string }[];
  /** The id of the event (#69) the price increase belongs to. */
  event?: string;
  /** A short text for the user, e.g. the source of the assumption. */
  note?: LocalizedText;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NAME = 150;
const MAX_ALIASES = 10;
const MAX_RELATED = 50;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A time with its zone: without one it would depend on the user's. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** A day (`2026-11-16`) or a time with its zone (`2026-11-16T16:00:00Z`), else none. */
function expectedTime(value: unknown): ExpectedTime | undefined {
  if (typeof value !== 'string') return undefined;
  const dayOnly = DAY.test(value);
  if (!dayOnly && !DATE_TIME.test(value)) return undefined;
  const at = Date.parse(dayOnly ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(at)) return undefined;
  return dayOnly ? { at, dayOnly } : { at };
}

/** When a point in time is over: a time at once, a day at its end (UTC). */
export const endOf = (time: ExpectedTime): number => (time.dayOnly ? time.at + DAY_MS : time.at);

/** The valid names of a list, each once, at most `max`. */
function names(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const result = new Set<string>();
  for (const entry of value) {
    const name = text(entry, MAX_NAME);
    if (name) result.add(name);
  }
  return [...result].slice(0, max);
}

/** One entry of the file, if it has everything it needs; optional fields that don't fit are left out. */
function parseEntry(entry: unknown): ExpectedPriceIncrease | undefined {
  const raw = record(entry);
  const ship = record(raw?.ship);
  if (!raw || !ship) return undefined;
  const id = ship.id;
  const name = text(ship.name, MAX_NAME);
  const priceIncreaseAt = expectedTime(raw.priceIncreaseAt);
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return undefined;
  if (!name || !priceIncreaseAt) return undefined;
  const aliases = names(ship.aliases, MAX_ALIASES).filter((alias) => alias !== name);
  const flightReadyAt = expectedTime(raw.flightReadyAt);
  const relatedItems = names(
    Array.isArray(raw.relatedItems) ? raw.relatedItems.map((item) => record(item)?.name) : [],
    MAX_RELATED,
  ).map((itemName) => ({ name: itemName }));
  const event = text(raw.event, 100);
  const note = localizedText(raw.note);
  return {
    ship: { id, name, ...(aliases.length && { aliases }) },
    priceIncreaseAt,
    ...(flightReadyAt && { flightReadyAt }),
    ...(relatedItems.length && { relatedItems }),
    ...(event && { event }),
    ...(note && { note }),
  };
}

/**
 * The expected price increases of the website's file; `undefined` if it isn't one of the format
 * the extension reads (another `schemaVersion`, no list), so the stored ones are kept. A ship's
 * second entry for the same time is left out.
 */
export function parsePriceIncreases(json: unknown): ExpectedPriceIncrease[] | undefined {
  const list = fileList(json, PRICE_INCREASES.schemaVersion, 'priceIncreases');
  if (!list) return undefined;
  const seen = new Set<string>();
  return list.flatMap((entry) => {
    const increase = parseEntry(entry);
    const key = increase && `${increase.ship.id}@${increase.priceIncreaseAt.at}`;
    if (!increase || !key || seen.has(key)) return [];
    seen.add(key);
    return [increase];
  });
}

/** The price increases still ahead at `now`, the next first. */
export const upcomingPriceIncreases = (
  list: readonly ExpectedPriceIncrease[],
  now: number,
): ExpectedPriceIncrease[] =>
  list
    .filter((increase) => endOf(increase.priceIncreaseAt) > now)
    .sort((a, b) => a.priceIncreaseAt.at - b.priceIncreaseAt.at);
