import type { StarCitizenEvent } from '@/events/events';
import { translatePlural, type Locale } from '@/i18n';
import { localized } from '@/site-data/site-data';
import type { ShipRemoval } from './ship-removals';

/*
 * A ship leaving the Pledge Store (#285) that is on sale right now, but isn't one of the ships
 * always available there (#293): it may be gone before the announced date, e.g. when the event it
 * is sold in ends. On sale: the upgrade tool's ships on sale (`buyable`); always available: the
 * ship facts of the website (#109). Without either, or for an always available ship, there is no
 * note. During an event (`events.json`, between its start and end) the note names the event and
 * when it ends.
 */

/** A removed ship on sale now, but not always available, and the event running now, if any. */
export interface LimitedSale {
  event?: { name: StarCitizenEvent['name']; end: number };
}

export interface LimitedSaleInput {
  removals: readonly ShipRemoval[];
  /** The ids of the ships on sale now; empty while unknown. */
  onSale: ReadonlySet<number>;
  /** Whether a ship is always available; `undefined` while unknown. */
  alwaysAvailable: (id: number) => boolean | undefined;
  events: readonly StarCitizenEvent[];
  now: number;
}

/** The removed ships on sale now but not always available, by ship id. */
export function limitedSales(input: LimitedSaleInput): Map<number, LimitedSale> {
  const running = input.events
    .filter((event) => event.eventStart <= input.now && input.now < event.eventEnd)
    .sort((a, b) => a.eventEnd - b.eventEnd)[0];
  const sale: LimitedSale = running ? { event: { name: running.name, end: running.eventEnd } } : {};
  const result = new Map<number, LimitedSale>();
  for (const { ship } of input.removals) {
    if (input.onSale.has(ship.id) && input.alwaysAvailable(ship.id) === false) {
      result.set(ship.id, sale);
    }
  }
  return result;
}

/**
 * The note about ships on sale now but not always available: one ship by name, several as a
 * list; with the running event, that they may not be on sale any more once it ends.
 */
export function limitedSaleText(
  names: readonly string[],
  sale: LimitedSale,
  locale: Locale,
): string {
  const list = new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
  const text = translatePlural(locale, 'shipRemovals.limitedSale', names.length, [list]);
  if (!sale.event) return text;
  const end = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(sale.event.end);
  const after = translatePlural(locale, 'shipRemovals.limitedSaleEvent', names.length, [
    localized(sale.event.name, locale),
    end,
  ]);
  return `${text} ${after}`;
}

/** The note for the ships of `removals` that are on sale but not always available, if any. */
export function limitedSaleNote(
  removals: readonly ShipRemoval[],
  sales: ReadonlyMap<number, LimitedSale>,
  locale: Locale,
): string | undefined {
  const limited = removals.filter((removal) => sales.has(removal.ship.id));
  if (!limited.length) return undefined;
  const sale = sales.get(limited[0]!.ship.id)!;
  return limitedSaleText(
    limited.map((removal) => removal.ship.name),
    sale,
    locale,
  );
}
