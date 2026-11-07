/*
 * What RSI's ship upgrade tool knows about the ships: every ship with its standard price, the
 * ships currently on sale and the warbond editions among them. One request reads all three
 * (`fetch-upgrade-tool.ts`); each is kept in a storage of its own (`ships-storage.ts`), linked by
 * the upgrade tool's ship id. These ids are not the hangar's: ships are matched by name there.
 */

/** A ship of the upgrade tool; prices in USD. */
export interface Ship {
  /** The upgrade tool's ship id (not the hangar's). */
  id: number;
  name: string;
  /** Standard price. */
  msrp: number;
  image?: string;
  /** Path of the ship's page in the Pledge Store, e.g. "/pledge/ships/origin-300/300i". */
  link?: string;
}

/** A SKU of a ship currently on sale (e.g. "Standard Edition", "Warbond Edition"). */
export interface ShipSku {
  shipId: number;
  skuId: number;
  title: string;
  /** Price in USD. */
  price: number;
}

/** A ship currently offered as warbond edition: for less than its standard price. */
export interface WarbondSku {
  shipId: number;
  skuId: number;
  /** Warbond price in USD. */
  price: number;
}

/** Everything one read of the upgrade tool gives. */
export interface UpgradeToolData {
  ships: Ship[];
  buyable: ShipSku[];
  warbonds: WarbondSku[];
}
