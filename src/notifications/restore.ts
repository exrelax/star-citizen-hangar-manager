import { shownEvents, type StarCitizenEvent } from '@/events/events';
import type { WarbondSku } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import { isKindOn, type NotificationKind } from './kinds';
import type { AppNotification } from './notifications';

/*
 * Shows checked-off sidebar notifications again, as far as they still matter (#213) – from the
 * settings, for what was checked off by mistake or by the extension itself (e.g. an event that
 * seemed over while the file was being changed):
 * - an event's while the event is shown (it gets its current name and time with the next read),
 * - new warbond CCUs while one of them is still offered,
 * - changed Pledge Store items while one of the new or repriced ones still has that price,
 * - notifications without such data (added before #213, or of other sources) don't come back.
 * Kinds turned off in the settings (#197) stay hidden. The Paint Discount Consultant's
 * notification and the hint on browser notifications aren't stored here: the settings bring them
 * back themselves, while paints can be bought again and while browser notifications are off.
 */

/** What the checked-off notifications are compared with. */
export interface RestoreContext {
  events: readonly StarCitizenEvent[];
  /** The warbond CCUs offered now. */
  warbonds: readonly WarbondSku[];
  /** The Pledge Store items now. */
  items: readonly StoreItem[];
  notificationsOff: readonly NotificationKind[];
  now: number;
}

/** Whether a checked-off notification still matters. */
export function stillMatters(note: AppNotification, context: RestoreContext): boolean {
  if (note.kind && !isKindOn(context.notificationsOff, note.kind)) return false;
  switch (note.kind) {
    case 'events':
      return shownEvents(context.events, context.now).some(
        (event) => `events:${event.id}` === note.id,
      );
    case 'warbonds': {
      const offered = new Set(context.warbonds.map((sku) => sku.skuId));
      return (note.subject?.warbonds ?? []).some((skuId) => offered.has(skuId));
    }
    case 'storeItems': {
      const prices = new Map(
        context.items
          .filter((item) => item.available)
          .map((item) => [item.id, item.discountedPrice ?? item.price]),
      );
      return (note.subject?.items ?? []).some(({ id, price }) => prices.get(id) === price);
    }
    default:
      return false;
  }
}

/** The checked-off notifications that still matter. */
export const restorable = (list: readonly AppNotification[], context: RestoreContext) =>
  list.filter((note) => note.doneAt !== undefined && stillMatters(note, context));

/** `list` with the given checked-off notifications open again; `list` itself without any. */
export function withRestored(
  list: readonly AppNotification[],
  ids: ReadonlySet<string>,
): readonly AppNotification[] {
  if (!list.some((note) => ids.has(note.id) && note.doneAt !== undefined)) return list;
  return list.map((note) => {
    if (!ids.has(note.id) || note.doneAt === undefined) return note;
    const open = { ...note };
    delete open.doneAt;
    return open;
  });
}
