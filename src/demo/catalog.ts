import type { Ship } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';

/*
 * The public catalog the generated demo hangar is made of (#175): the ships of RSI's upgrade tool
 * (name, standard price, image) and the items of the Pledge Store (name, category, price, image) –
 * the same for every account. Without them (never read yet) a small bundled catalog stands in,
 * so the demo works on any account, even a new one.
 */

export interface DemoCatalog {
  ships: readonly Ship[];
  items: readonly StoreItem[];
}

/** Ships with a standard price, by the Ship Matrix ids (`id`) of the upgrade tool. */
const FALLBACK_SHIPS: readonly Ship[] = [
  { id: 73, name: 'Aurora MR', msrp: 25 },
  { id: 9, name: 'Mustang Alpha', msrp: 30 },
  { id: 12, name: 'Avenger Titan', msrp: 55 },
  { id: 36, name: 'Cutlass Black', msrp: 110 },
  { id: 47, name: 'Freelancer', msrp: 110 },
  { id: 154, name: 'Nova', msrp: 120 },
  { id: 65, name: 'Vanguard Warden', msrp: 260 },
  { id: 168, name: 'Mercury', msrp: 260 },
  { id: 108, name: 'Blade', msrp: 275 },
  { id: 99, name: 'Retaliator', msrp: 275 },
  { id: 222, name: 'Railen', msrp: 225 },
  { id: 49, name: 'Constellation Andromeda', msrp: 240 },
  { id: 169, name: 'Valkyrie', msrp: 375 },
  { id: 162, name: 'C2 Hercules', msrp: 400 },
  { id: 140, name: '600i Touring', msrp: 435 },
  { id: 244, name: 'Galaxy', msrp: 450 },
  { id: 163, name: 'M2 Hercules', msrp: 520 },
  { id: 141, name: '600i Explorer', msrp: 475 },
  { id: 224, name: 'Liberator', msrp: 575 },
  { id: 116, name: 'Polaris', msrp: 975 },
];

const item = (
  id: number,
  category: string,
  name: string,
  price: number,
  extra: Partial<StoreItem> = {},
): StoreItem => ({ id, category, name, price, isWarbond: false, available: true, ...extra });

/** Items of the Pledge Store, a few of each category. */
const FALLBACK_ITEMS: readonly StoreItem[] = [
  item(1, 'Paints', 'Sabre - Blue Steel Paint', 10),
  item(2, 'Paints', 'Avenger - Skullcrusher Paint', 5),
  item(3, 'Paints', 'Cutlass - Ghoulish Green Paint', 7.5),
  item(4, 'Paints', 'Freelancer - Ironclad Paint', 7.5),
  item(5, 'Paints', 'Constellation - Ghoulish Green Paint', 10),
  item(6, 'Paints', 'Mercury - Ironclad Paint', 10),
  item(7, 'Paints', 'Galaxy - Polar Paint', 12.5),
  item(8, 'Paints', 'Nova - Tundra Paint', 5),
  item(9, 'Paints', 'Valkyrie - Stormbringer Paint', 12.5),
  item(10, 'Paints', 'Hercules - Polar Paint', 12.5),
  item(11, 'Paints', '600i - Meridian Paint', 15),
  item(12, 'Paints', 'Polaris - Black Ice Paint', 20),
  item(20, 'Gear', "RSI Zeus 'Keelback' Backpack", 15),
  item(21, 'Gear', 'Virgil Tailwind Flight Suit', 10),
  item(22, 'Gear', 'Overlord Helmet Pack', 25),
  item(23, 'Gear', 'Morozov-SH Armor Set', 30),
  item(30, 'Add-Ons', 'Galaxy - Cargo Module', 70),
  item(31, 'Add-Ons', 'Galaxy - Med Bay Module', 90),
  item(32, 'Add-Ons', 'Galaxy - Refinery Module', 80),
  item(33, 'Add-Ons', '600i - Exploration Module', 50),
  item(40, 'Package', 'Aurora MR Starter Pack', 45),
  item(41, 'Package', 'Mustang Alpha Starter Pack', 45),
  item(42, 'Package', 'Avenger Titan Starter Pack', 75),
  item(50, 'Packs', 'Explorer Pack', 600),
];

export const FALLBACK_CATALOG: DemoCatalog = { ships: FALLBACK_SHIPS, items: FALLBACK_ITEMS };

/** The catalog of the stored data, or the bundled one for what isn't stored. */
export function demoCatalog(
  ships: readonly Ship[] | undefined,
  items: readonly StoreItem[] | undefined,
): DemoCatalog {
  const priced = ships?.filter((ship) => ship.msrp > 0) ?? [];
  return {
    ships: priced.length >= 10 ? priced : FALLBACK_CATALOG.ships,
    items: items?.length ? items : FALLBACK_CATALOG.items,
  };
}
