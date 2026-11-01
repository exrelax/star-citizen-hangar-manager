/** An item contained in a pledge (ship, paint, upgrade, …). */
export interface PledgeItem {
  title: string;
  /** e.g. "Ship", "Skin", "Hangar decoration". */
  kind?: string;
  manufacturer?: string;
  /** Short manufacturer code, e.g. "ANVL". */
  manufacturerCode?: string;
  image?: string;
}

/** A ship or item referenced by an upgrade (CCU). */
export interface UpgradeTarget {
  id: number;
  name: string;
}

/** Upgrade data of a CCU pledge ("Upgrade - A to B"). */
export interface PledgeUpgrade {
  /** Items the upgrade can be applied to (the "from" ship). */
  matchItems: UpgradeTarget[];
  /** Items the upgrade turns them into (the "to" ship, sometimes plus paints etc.). */
  targetItems: UpgradeTarget[];
  /** RSI upgrade type code, e.g. "R". */
  type: string;
  /** Image of the target ship, resolved during the sync. */
  targetImage?: string;
}

/** RSI product categories (`product-type` filter of the hangar) that the sync records. */
export const PLEDGE_CATEGORIES = ['game_package', 'standalone_ship'] as const;
export type PledgeCategory = (typeof PLEDGE_CATEGORIES)[number];

/** A pledge from the RSI hangar ("My Gear"), as listed on `/account/pledges`. */
export interface Pledge {
  id: number;
  name: string;
  /** Display title of the list entry, usually equal to `name`. */
  title: string;
  /** Pledge value as shown by RSI, e.g. "$45.00 USD". */
  value: string;
  /** Pledge value in USD, parsed from `value`. */
  valueUsd: number;
  configurationValue: string;
  /** Payment type, e.g. "Store Credit". */
  currency: string;
  /** Creation date as ISO date (YYYY-MM-DD). */
  createdAt?: string;
  /** e.g. "Attributed". */
  availability: string;
  /** Summary of the contained items ("Contains: …"). */
  contains: string;
  image?: string;
  isLastAlpha: boolean;
  isBuybackable: boolean;
  isGiftable: boolean;
  isExchangeable: boolean;
  isUpgradeable: boolean;
  /** Whether a CCU has been applied, i.e. the contained ship is no longer the original one. */
  isUpgraded: boolean;
  /** Set for CCU pledges. */
  upgrade?: PledgeUpgrade;
  /** RSI product category, if it is one of `PLEDGE_CATEGORIES`. */
  category?: PledgeCategory;
  nameReservations: unknown;
  nameableShips: unknown;
  items: PledgeItem[];
}

/** Locally stored result of the last complete hangar sync. */
export interface HangarSnapshot {
  /** Format version; snapshots of other versions are ignored and need a new sync. */
  version: number;
  /** ISO timestamp. */
  syncedAt: string;
  pledges: Pledge[];
}

export const HANGAR_SNAPSHOT_VERSION = 3;
