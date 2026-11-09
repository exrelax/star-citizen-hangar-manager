import { formatUsd } from '@/hangar/discount-format';
import { translate, type Locale } from '@/i18n';
import {
  updateNotifications,
  withAdded,
  type AppNotification,
} from '@/notifications/notifications';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import type { Ship, WarbondSku } from '@/ships/ships';
import type { StoreItem } from './items/store-items';
import { storeItemChanges, warbondChanges } from './store-changes';

/*
 * The notifications about changes in the Pledge Store (#164), from the comparison of each read
 * with the stored one (`store-changes.ts`), in the sidebar's box "Notifications" with an id per
 * read, so a change is told once. New warbond CCUs also show as a browser notification – time-
 * limited offers worth knowing while away; everything else only in the sidebar, as browser
 * notifications are used sparingly (#155).
 */

/** Names shown in one text before "… and N more". */
const SHOWN_NAMES = 3;

/** "A, B, C … and 2 more". */
export function shortList(names: readonly string[], locale: Locale): string {
  const shown = names.slice(0, SHOWN_NAMES).join(', ');
  const more = names.length - SHOWN_NAMES;
  return more > 0 ? `${shown} ${translate(locale, 'notifications.andMore', [more])}` : shown;
}

/** The notification about changed warbond CCUs, if any changed. */
export function warbondNote(
  previous: readonly WarbondSku[] | undefined,
  next: readonly WarbondSku[],
  ships: readonly Ship[],
  locale: Locale,
  at: number,
): AppNotification | undefined {
  const changes = warbondChanges(previous, next);
  if (!changes) return undefined;
  const names = new Map(ships.map((ship) => [ship.id, ship.name]));
  const nameOf = (sku: WarbondSku) =>
    `${names.get(sku.shipId) ?? `#${sku.shipId}`} (${formatUsd(sku.price, locale)})`;
  const added = changes.added.map(nameOf);
  const removed = changes.removed.map(nameOf);
  const text = [
    added.length && translate(locale, 'notifications.warbondsNew', [shortList(added, locale)]),
    removed.length && translate(locale, 'notifications.warbondsGone', [shortList(removed, locale)]),
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id: `warbonds:${at}`,
    kind: 'warbonds',
    text,
    at,
    ...(added.length && {
      browser: {
        title: translate(locale, 'notifications.browserWarbondsTitle'),
        text: shortList(added, locale),
      },
    }),
  };
}

/** The notification about changed Pledge Store items, if any changed: a count and the list. */
export function storeItemsNote(
  previous: readonly StoreItem[] | undefined,
  next: readonly StoreItem[],
  locale: Locale,
  at: number,
): AppNotification | undefined {
  const changes = storeItemChanges(previous, next);
  if (!changes) return undefined;
  const usd = (value: number) => formatUsd(value, locale);
  const details = [
    ...changes.added.map((item) =>
      translate(locale, 'notifications.storeItemNew', [item.name, usd(item.price)]),
    ),
    ...changes.removed.map((item) => translate(locale, 'notifications.storeItemGone', [item.name])),
    ...changes.repriced.map(({ item, before }) =>
      item.discountedPrice !== undefined && item.discountedPrice !== before.discountedPrice
        ? translate(locale, 'notifications.storeItemSale', [
            item.name,
            usd(item.price),
            usd(item.discountedPrice),
          ])
        : translate(locale, 'notifications.storeItemPrice', [
            item.name,
            usd(before.discountedPrice ?? before.price),
            usd(item.discountedPrice ?? item.price),
          ]),
    ),
  ];
  const count = details.length;
  return {
    id: `storeItems:${at}`,
    kind: 'storeItems',
    text:
      count === 1
        ? translate(locale, 'notifications.storeItemsChangedOne')
        : translate(locale, 'notifications.storeItemsChanged', [count]),
    details,
    at,
  };
}

/** Adds the notification, if there is one, in the user's language. */
async function addNote(build: (locale: Locale) => AppNotification | undefined): Promise<void> {
  const locale = resolveLanguage(withDefaults(await settingsItem.getValue()).language);
  const note = build(locale);
  if (note) await updateNotifications((list) => withAdded(list, [note]));
}

/** After a read of the upgrade tool: tells what changed in its warbond CCUs. */
export const noteWarbondChanges = (
  previous: readonly WarbondSku[] | undefined,
  next: readonly WarbondSku[],
  ships: readonly Ship[],
  at: number,
) => addNote((locale) => warbondNote(previous, next, ships, locale, at));

/** After a read of the Pledge Store items: tells what changed. */
export const noteStoreItemChanges = (
  previous: readonly StoreItem[] | undefined,
  next: readonly StoreItem[],
  at: number,
) => addNote((locale) => storeItemsNote(previous, next, locale, at));
