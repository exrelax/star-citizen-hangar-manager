import type { PledgeCategory } from '@/hangar/pledge';
import type { ShipLinks } from '@/hangar/ship-links';

/** RSI's ids of a CCU in the buy back, from its "Buy Back" button; needed to buy it back. */
export interface BuybackUpgrade {
  fromShipId: number;
  toShipId: number;
  toSkuId: number;
}

/** A pledge in the RSI buy back (`/account/buy-back-pledges`). It keeps its original id. */
export interface BuybackPledge {
  id: number;
  title: string;
  image?: string;
  /** Date the pledge was melted (ISO date, YYYY-MM-DD). RSI shows no purchase date here. */
  reclaimedAt?: string;
  /** RSI's "Contained" summary, e.g. "Fury and 4 items" or "Sabre - Blue Steel Paint". */
  contained: string;
  /** A CCU (upgrade). */
  isUpgrade: boolean;
  /** CCUs only: what RSI needs to put the CCU into the cart. */
  upgrade?: BuybackUpgrade;
  /** RSI product category, if it is one of `PLEDGE_CATEGORIES`. */
  category?: PledgeCategory;
  /**
   * All items, from the pledge's detail page. Only loaded for pledges with several items – the
   * only ones that can contain insurance – and kept, as a melted pledge doesn't change any more.
   */
  items?: string[];
  /**
   * The buy back price in USD without taxes, from the detail page (read with the items, #185);
   * `null` when the page showed none. Other pledges' prices come from the catalog (see
   * `buyback-price.ts`).
   */
  price?: number | null;
}

/** Locally stored result of the last buy back sync. */
export interface BuybackSnapshot {
  /** Format version; snapshots of other versions are ignored and need a new sync. */
  version: number;
  /** ISO timestamp of the last full sync. */
  syncedAt: string;
  /** ISO timestamp of the last change by a full sync or a smart update. */
  updatedAt?: string;
  pledges: BuybackPledge[];
  /** Links of the contained ships to other platforms, by ship name. */
  shipLinks?: ShipLinks;
  /**
   * Buy back tokens left as of the last sync or smart update: pledges that can still be bought
   * back with store credit. Unset if RSI showed none.
   */
  tokens?: number;
}

export const BUYBACK_SNAPSHOT_VERSION = 1;

/**
 * RSI's "Contained" of a pledge with several items: "Fury and 4 items", or only "2 items" when no
 * item is named (e.g. "Add-Ons - Galaxy - Cargo Module - IAE": the module and its insurance).
 */
const SEVERAL_ITEMS = /^(?:(.*) and )?(\d+) items?$/i;

/** Whether the pledge has more items than the one named in "Contained". */
export function hasSeveralItems(pledge: Pick<BuybackPledge, 'contained'>): boolean {
  return SEVERAL_ITEMS.test(pledge.contained);
}

/**
 * The item named in "Contained" ("Fury and 4 items" → "Fury"); with only a count ("2 items") the
 * first item of the detail page, if read, else none ('').
 */
export function mainItem(pledge: Pick<BuybackPledge, 'contained' | 'items'>): string {
  const several = SEVERAL_ITEMS.exec(pledge.contained);
  if (!several) return pledge.contained.trim();
  return several[1]?.trim() ?? pledge.items?.[0] ?? '';
}

/** Ships of a buy back pledge: the main item of ship pledges and packages. */
export function buybackShipNames(pledge: BuybackPledge): string[] {
  if (pledge.isUpgrade) return [];
  const isShipPledge =
    pledge.category === 'standalone_ship' ||
    pledge.category === 'game_package' ||
    /^(standalone ships?|package)\b/i.test(pledge.title);
  const main = mainItem(pledge);
  return isShipPledge && main ? [main] : [];
}

/** Content as RSI shows it, to notice changes in smart updates. */
export function buybackFingerprint(pledge: BuybackPledge): string {
  return JSON.stringify([pledge.title, pledge.contained, pledge.reclaimedAt, pledge.isUpgrade]);
}

/** Keeps what the extension added (category, detail items) on a pledge's new version. */
export function withBuybackExtensionData(fresh: BuybackPledge, old: BuybackPledge): BuybackPledge {
  const pledge: BuybackPledge = { ...fresh };
  if (old.category) pledge.category = old.category;
  if (old.items) pledge.items = old.items;
  return pledge;
}
