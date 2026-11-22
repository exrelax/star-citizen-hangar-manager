import { formatUsd } from '@/hangar/discount-format';
import { translate, translatePlural, type Locale } from '@/i18n';
import type { StoreChange, WatchlistChanges } from './watch-store-changes';

/*
 * The texts of changed Pledge Store items on a watchlist (#472), for the sidebar and the browser.
 */

/** A change in a few words, e.g. "Cutlass Black: $110 → $120". */
export function changeText(change: StoreChange, locale: Locale): string {
  const name = change.item.name;
  if (change.kind === 'price') {
    return translate(locale, 'notifications.watchlistStorePrice', [
      name,
      formatUsd(change.from, locale),
      formatUsd(change.to, locale),
    ]);
  }
  return translate(
    locale,
    change.kind === 'gone'
      ? 'notifications.watchlistStoreGone'
      : 'notifications.watchlistStoreBack',
    [name],
  );
}

/** The text of a watchlist's notification: its name, then each change on a line. */
export function storeChangeMessage({ list, changes }: WatchlistChanges, locale: Locale): string {
  const head = translatePlural(locale, 'notifications.watchlistStore', changes.length, [
    list.name,
    changes.length,
  ]);
  return [head, ...changes.map((change) => changeText(change, locale))].join('\n');
}
