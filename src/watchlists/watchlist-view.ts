import { matchesSearch, normalizeSearchText, parseSearchQuery } from '@/hangar/search';
import { itemKey, presenceOf, type PledgeLists, type Presence, type WatchItem } from './watchlists';

/*
 * A watchlist's items as its view shows them (#467), by where they come from: the pledges of My
 * Hangar and the Buy Back still there as the lists' own rows, everything else – a pledge gone or
 * not read yet, a Pledge Store item – as a plain row with the name and value it had when last seen.
 */

/** The sources of a watchlist's items, in the order of the manager's tabs. */
export const WATCH_SOURCES = ['hangar', 'buyback', 'store'] as const;
export type WatchSource = (typeof WATCH_SOURCES)[number];

export const sourceOf = (item: WatchItem): WatchSource =>
  item.kind === 'hangar' || item.kind === 'buyback' ? item.kind : 'store';

/** An item without a row of its own: its last name and value, and where a pledge stands. */
export interface PlainItem {
  key: string;
  item: WatchItem;
  presence: Presence;
}

export interface WatchSection<P> {
  source: WatchSource;
  /** Every item of this source. */
  count: number;
  /** The pledges still there, in the watchlist's order. */
  pledges: P[];
  plain: PlainItem[];
}

/**
 * The sections of the watchlist's items, one per source that has items. `lists` tells which
 * pledges are still there (`presenceOf`), `hangar` and `buyback` are the rows to show for them.
 */
export function watchSections<H extends { id: number }, B extends { id: number }>(
  items: readonly WatchItem[],
  hangar: readonly H[],
  buyback: readonly B[],
  lists: PledgeLists,
): { hangar?: WatchSection<H>; buyback?: WatchSection<B>; store?: WatchSection<never> } {
  const byId = <P extends { id: number }>(pledges: readonly P[]) =>
    new Map(pledges.map((pledge) => [pledge.id, pledge]));
  const rows = { hangar: byId(hangar), buyback: byId(buyback) };
  const sections: Record<WatchSource, WatchSection<unknown>> = {
    hangar: { source: 'hangar', count: 0, pledges: [], plain: [] },
    buyback: { source: 'buyback', count: 0, pledges: [], plain: [] },
    store: { source: 'store', count: 0, pledges: [], plain: [] },
  };
  for (const item of items) {
    const section = sections[sourceOf(item)];
    section.count += 1;
    const presence = presenceOf(item, lists);
    const row =
      item.kind === 'hangar' || item.kind === 'buyback'
        ? rows[item.kind].get(item.pledgeId)
        : undefined;
    if (row && presence.state === 'present') section.pledges.push(row);
    else section.plain.push({ key: itemKey(item), item, presence });
  }
  const shown = <P>(section: WatchSection<unknown>) =>
    section.count ? (section as WatchSection<P>) : undefined;
  return {
    hangar: shown<H>(sections.hangar),
    buyback: shown<B>(sections.buyback),
    store: shown<never>(sections.store),
  };
}

/** The plain items the search finds, by their names. */
export function searchPlain(items: readonly PlainItem[], query: string): PlainItem[] {
  const terms = parseSearchQuery(query);
  return terms.length
    ? items.filter((entry) => matchesSearch(normalizeSearchText(entry.item.name), terms))
    : [...items];
}

// ---- The date of a watchlist, in a `datetime-local` field ----

const pad = (value: number) => String(value).padStart(2, '0');

/** A time (ms) as the value of a `datetime-local` field, in the browser's time zone. */
export function toLocalInput(ms: number): string {
  const date = new Date(ms);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** The value of a `datetime-local` field as a time (ms); none while it is empty or invalid. */
export function fromLocalInput(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const time = new Date(year, month - 1, day, hours, minutes).getTime();
  return Number.isNaN(time) ? undefined : time;
}
