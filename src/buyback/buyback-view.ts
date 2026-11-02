import { BUYBACK_GIFTABLE_PURCHASED_BEFORE, BUYBACK_PAGE_SIZE } from '@/config';
import type { FilterDefinition } from '@/hangar/filters';
import { GAME_DOWNLOAD, type ShipRef } from '@/hangar/pledge-view';
import { normalizeSearchText } from '@/hangar/search';
import type { ShipLinks } from '@/hangar/ship-links';
import {
  buybackShipNames,
  hasSeveralItems,
  mainItem,
  type BuybackPledge,
  type BuybackUpgrade,
} from './buyback';

/** What the buy back list shows for a pledge. */
export interface BuybackView {
  id: number;
  /** Index of the pledge in RSI's buy back list (0-based), as of the last sync. */
  position: number;
  /** Page of the pledge in RSI's buy back list (250 per page), as of the last sync. */
  page: number;
  title: string;
  image?: string;
  reclaimedAt?: string;
  contained: string;
  /** All items incl. the main one, if known (pledges with several items). */
  items: string[];
  ships: ShipRef[];
  hasLti: boolean;
  isPaint: boolean;
  isCcu: boolean;
  /** See `BuybackPledge.upgrade`. */
  upgrade?: BuybackUpgrade;
  isStandaloneShip: boolean;
  hasGameAccess: boolean;
  /** Bought before `BUYBACK_GIFTABLE_PURCHASED_BEFORE`: giftable again after a warbond buy back. */
  isProbablyGiftable: boolean;
  /** Normalized title, ship names and pledge id for the live search. */
  searchText: string;
}

/**
 * Highest pledge id known to be bought before the cutoff date, from the hangar's pledges and
 * their creation dates. Pledge ids grow over time and are kept when a pledge is melted, so every
 * buy back pledge up to this id was bought before the cutoff, too.
 */
export function giftableIdLimit(
  hangarPledges: readonly { id: number; createdAt?: string }[],
  cutoff = BUYBACK_GIFTABLE_PURCHASED_BEFORE,
): number | undefined {
  let limit: number | undefined;
  for (const { id, createdAt } of hangarPledges) {
    if (createdAt && createdAt < cutoff && (limit === undefined || id > limit)) limit = id;
  }
  return limit;
}

export interface BuybackViewContext {
  /** Index in the stored buy back, which has RSI's order. */
  position: number;
  /** See `giftableIdLimit`. */
  idLimit: number | undefined;
  shipLinks?: ShipLinks;
  cutoff?: string;
}

export function toBuybackView(pledge: BuybackPledge, context: BuybackViewContext): BuybackView {
  const { position, idLimit, shipLinks = {}, cutoff = BUYBACK_GIFTABLE_PURCHASED_BEFORE } = context;
  // The detail page lists the items besides the main one named in "Contained".
  const extraItems = pledge.items ?? [];
  const main = mainItem(pledge);
  const items = extraItems.length ? [main, ...extraItems.filter((item) => item !== main)] : [];
  const shipNames = buybackShipNames(pledge);
  return {
    id: pledge.id,
    position,
    page: Math.floor(position / BUYBACK_PAGE_SIZE) + 1,
    title: pledge.title,
    image: pledge.image,
    reclaimedAt: pledge.reclaimedAt,
    contained: pledge.contained,
    items,
    ships: shipNames.map((name) => ({ name, link: shipLinks[name] })),
    hasLti: items.some((item) => /lifetime insurance/i.test(item)),
    isPaint:
      !pledge.isUpgrade &&
      (/^paints?\b/i.test(pledge.title) ||
        (!hasSeveralItems(pledge) && /\b(paint|livery)\b/i.test(pledge.contained))),
    isCcu: pledge.isUpgrade,
    upgrade: pledge.upgrade,
    isStandaloneShip: pledge.category === 'standalone_ship',
    hasGameAccess:
      pledge.category === 'game_package' || items.some((item) => GAME_DOWNLOAD.test(item)),
    // Melted before the cutoff means bought before it; otherwise the id tells.
    isProbablyGiftable:
      (!!pledge.reclaimedAt && pledge.reclaimedAt < cutoff) ||
      (idLimit !== undefined && pledge.id <= idLimit),
    searchText: normalizeSearchText([pledge.title, ...shipNames, pledge.id].join(' ')),
  };
}

/** Filters of the buy back list, in display order. */
export const BUYBACK_FILTERS = [
  'lti',
  'paints',
  'ccus',
  'standaloneShips',
  'gameAccess',
  'probablyGiftable',
] as const;
export type BuybackFilter = (typeof BUYBACK_FILTERS)[number];

export const BUYBACK_FILTER_DEFINITION: FilterDefinition<BuybackView, BuybackFilter> = {
  categories: {
    paints: (pledge) => pledge.isPaint,
    ccus: (pledge) => pledge.isCcu,
    standaloneShips: (pledge) => pledge.isStandaloneShip,
    gameAccess: (pledge) => pledge.hasGameAccess,
  },
  properties: {
    lti: (pledge) => pledge.hasLti,
    probablyGiftable: (pledge) => pledge.isProbablyGiftable,
  },
};
