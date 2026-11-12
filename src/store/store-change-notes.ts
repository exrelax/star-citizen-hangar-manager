import { formatUsd } from '@/hangar/discount-format';
import { translate, type Locale } from '@/i18n';
import { isKindOn, type NotificationKind } from '@/notifications/kinds';
import {
  checkOff,
  noteText,
  notificationsItem,
  openNotifications,
  shortList,
  updateNotifications,
  withAdded,
  type AppNotification,
  type NoteMessage,
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

export { shortList } from '@/notifications/notifications';

/**
 * The notification about changed warbond CCUs, if any changed. Its text is built in the language
 * shown (#211): ship names with their prices as parts, formatted for the language.
 */
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
  const nameOf = (sku: WarbondSku) => ({
    name: names.get(sku.shipId) ?? `#${sku.shipId}`,
    usd: sku.price,
  });
  const added = changes.added.map(nameOf);
  const removed = changes.removed.map(nameOf);
  const message: NoteMessage[] = [
    ...(added.length
      ? [{ key: 'notifications.warbondsNew' as const, args: [{ names: added }] }]
      : []),
    ...(removed.length
      ? [{ key: 'notifications.warbondsGone' as const, args: [{ names: removed }] }]
      : []),
  ];
  const note: AppNotification = {
    id: `warbonds:${at}`,
    kind: 'warbonds',
    text: '',
    message,
    at,
    ...(changes.added.length && { subject: { warbonds: changes.added.map((sku) => sku.skuId) } }),
    // The browser notification is shown once, in the language of that moment.
    ...(added.length && {
      browser: {
        title: translate(locale, 'notifications.browserWarbondsTitle'),
        text: shortList(
          added.map(({ name, usd }) => `${name} (${formatUsd(usd, locale)})`),
          locale,
        ),
      },
    }),
  };
  return { ...note, text: noteText(note, locale) };
}

/**
 * The notification about changed Pledge Store items, if any changed: a count and the list, both
 * built in the language shown (#211).
 */
export function storeItemsNote(
  previous: readonly StoreItem[] | undefined,
  next: readonly StoreItem[],
  locale: Locale,
  at: number,
): AppNotification | undefined {
  const changes = storeItemChanges(previous, next);
  if (!changes) return undefined;
  const detailMessages: NoteMessage[] = [
    ...changes.added.map((item) => ({
      key: 'notifications.storeItemNew' as const,
      args: [item.name, { usd: item.price }],
    })),
    ...changes.removed.map((item) => ({
      key: 'notifications.storeItemGone' as const,
      args: [item.name],
    })),
    ...changes.repriced.map(({ item, before }) =>
      item.discountedPrice !== undefined && item.discountedPrice !== before.discountedPrice
        ? {
            key: 'notifications.storeItemSale' as const,
            args: [item.name, { usd: item.price }, { usd: item.discountedPrice }],
          }
        : {
            key: 'notifications.storeItemPrice' as const,
            args: [
              item.name,
              { usd: before.discountedPrice ?? before.price },
              { usd: item.discountedPrice ?? item.price },
            ],
          },
    ),
  ];
  const count = detailMessages.length;
  // What still matters later (#213): the items new or repriced, at their price now.
  const shown = [...changes.added, ...changes.repriced.map(({ item }) => item)].map((item) => ({
    id: item.id,
    price: item.discountedPrice ?? item.price,
  }));
  const note: AppNotification = {
    id: `storeItems:${at}`,
    kind: 'storeItems',
    text: '',
    message: { key: 'notifications.storeItemsChanged', count, args: [count] },
    detailMessages,
    at,
    ...(shown.length && { subject: { items: shown } }),
  };
  return { ...note, text: noteText(note, locale) };
}

/** Adds the notification, if there is one and its kind is on (#197), in the user's language. */
async function addNote(
  kind: NotificationKind,
  build: (locale: Locale) => AppNotification | undefined,
): Promise<void> {
  const settings = withDefaults(await settingsItem.getValue());
  if (!isKindOn(settings.notificationsOff, kind)) return;
  const note = build(resolveLanguage(settings.language));
  if (note) await updateNotifications((list) => withAdded(list, [note]));
}

/** After a read of the upgrade tool: tells what changed in its warbond CCUs. */
export const noteWarbondChanges = (
  previous: readonly WarbondSku[] | undefined,
  next: readonly WarbondSku[],
  ships: readonly Ship[],
  at: number,
) => addNote('warbonds', (locale) => warbondNote(previous, next, ships, locale, at));

/** After a read of the Pledge Store items: tells what changed. */
export const noteStoreItemChanges = (
  previous: readonly StoreItem[] | undefined,
  next: readonly StoreItem[],
  at: number,
) => addNote('storeItems', (locale) => storeItemsNote(previous, next, locale, at));

/**
 * A kind turned off (#197) takes its open notifications away – in the sidebar, and so in the
 * browser (#155). Call it in the background script, so it follows changes from other devices.
 */
export function watchStoreNoteKinds(): void {
  const clearOff = async () => {
    const { notificationsOff } = withDefaults(await settingsItem.getValue());
    const kinds = new Set<string>(notificationsOff);
    const ids = openNotifications(await notificationsItem.getValue())
      .filter((note) => note.kind && kinds.has(note.kind))
      .map((note) => note.id);
    if (ids.length) await checkOff(ids);
  };
  void clearOff();
  settingsItem.watch(() => void clearOff());
}
