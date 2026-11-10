import type { Locale } from '@/i18n';
import type { AppNotification } from '@/notifications/notifications';
import { storeItemsNote, warbondNote } from '@/store/store-change-notes';
import type { DemoCatalog } from './catalog';

/*
 * Sample notifications of the Pledge Store's changes for the demo's sidebar (#131, #164), made
 * from its catalog like the generated hangar: new and gone warbond CCUs, and changed store items
 * (new, gone, a new price, on sale). The demo shows no browser notification for them.
 */
export function demoStoreNotes(
  catalog: DemoCatalog,
  locale: Locale,
  at: number,
): AppNotification[] {
  const ships = [...catalog.ships].sort((a, b) => a.msrp - b.msrp);
  const pick = (share: number) => ships[Math.floor((ships.length - 1) * share)]!;
  const warbond = (share: number) => {
    const ship = pick(share);
    return { shipId: ship.id, skuId: ship.id, price: Math.round(ship.msrp * 0.85) };
  };
  const items = catalog.items.filter((item) => item.price > 0).slice(0, 3);
  const [first, second, third] = items;
  const before = items;
  const after = [
    ...(first ? [{ ...first, price: first.price + 5 }] : []),
    ...(second ? [{ ...second, discountedPrice: Math.round(second.price * 0.8 * 100) / 100 }] : []),
    { ...(third ?? items[0]!), id: -1, name: 'Demo Flight Suit', price: 8 },
  ];
  return [
    warbondNote([warbond(0.2)], [warbond(0.6), warbond(0.8)], ships, locale, at),
    storeItemsNote(before, after, locale, at - 60 * 60 * 1000),
  ].filter((note): note is AppNotification => note !== undefined);
}
