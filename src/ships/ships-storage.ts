import { defineMeta } from '@/storage/meta';
import type { Ship, ShipSku, WarbondSku } from './ships';

/*
 * The three storages filled by one read of the upgrade tool (see `sync-upgrade-tool.ts`). They are
 * read together, but each has its own metadata (`storage/meta.ts`) and can be read – and later
 * reset – on its own.
 */

/** Format version of the three storages; others are ignored and read again. */
export const SHIPS_VERSION = 2;

interface Stored {
  version: number;
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
export const shipsMeta = defineMeta('local:ships');

export const buyableShipsItem = storage.defineItem<BuyableShipsSnapshot | null>(
  'local:ships.buyable',
  { fallback: null },
);
export const buyableShipsMeta = defineMeta('local:ships.buyable');

export const warbondsItem = storage.defineItem<WarbondsSnapshot | null>('local:ships.warbonds', {
  fallback: null,
});
export const warbondsMeta = defineMeta('local:ships.warbonds');

/** The stored value if it has the current format. */
export const current = <T extends Stored>(value: T | null): T | undefined =>
  value?.version === SHIPS_VERSION ? value : undefined;
