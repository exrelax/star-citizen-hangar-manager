import type { Ship, ShipSku, WarbondSku } from './ships';

/*
 * The three storages filled by one read of the upgrade tool (see `sync-upgrade-tool.ts`). They are
 * written together and carry the same `fetchedAt`, but each can be read – and later reset – on
 * its own.
 */

/** Format version of the three storages; others are ignored and read again. */
export const SHIPS_VERSION = 1;

interface Stored {
  version: number;
  /** ISO timestamp of the read. */
  fetchedAt: string;
}

/** All ships with standard price, image and Pledge Store link. */
export interface ShipsSnapshot extends Stored {
  ships: Ship[];
}

/** The SKUs of the ships currently on sale. */
export interface BuyableShipsSnapshot extends Stored {
  skus: ShipSku[];
}

/** The ships currently offered as warbond edition. */
export interface WarbondsSnapshot extends Stored {
  warbonds: WarbondSku[];
}

export const shipsItem = storage.defineItem<ShipsSnapshot | null>('local:ships', {
  fallback: null,
});

export const buyableShipsItem = storage.defineItem<BuyableShipsSnapshot | null>(
  'local:ships.buyable',
  { fallback: null },
);

export const warbondsItem = storage.defineItem<WarbondsSnapshot | null>('local:ships.warbonds', {
  fallback: null,
});

/** The stored value if it has the current format. */
export const current = <T extends Stored>(value: T | null): T | undefined =>
  value?.version === SHIPS_VERSION ? value : undefined;
