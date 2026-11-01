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
  nameReservations: unknown;
  nameableShips: unknown;
  items: PledgeItem[];
}

/** Locally stored result of the last complete hangar sync. */
export interface HangarSnapshot {
  /** ISO timestamp. */
  syncedAt: string;
  pledges: Pledge[];
}
