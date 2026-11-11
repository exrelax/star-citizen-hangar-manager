import { BUYBACK_PAGE_SIZE } from '@/config';
import type { PaidOrder } from '@/orders/orders';
import type { FilterCategory, FilterPredicates } from '@/hangar/filters';
import { isRewardTitle } from '@/hangar/rewards';
import { bestInsurance, type Insurance } from '@/hangar/insurance';
import { GAME_DOWNLOAD, isRealImage, type ShipRef } from '@/hangar/pledge-view';
import { normalizeSearchText } from '@/hangar/search';
import type { ShipLinks } from '@/hangar/ship-links';
import {
  buybackShipNames,
  hasSeveralItems,
  mainItem,
  type BuybackPledge,
  type BuybackUpgrade,
} from './buyback';
import type { AvailabilityCheck, BuybackUnavailable } from './buyback-availability';
import type { BuybackImager } from './buyback-image';
import type { BuybackPrice, BuybackPricer } from './buyback-price';
import type { GiftableCheck } from './probably-giftable';
import type { CcuPriceChange } from '@/price-increases/ccu-price-change';
import { hasPriceChange } from '@/price-increases/price-change-filter';
import type { PriceIncreaseMatch } from '@/price-increases/price-increase-match';

/** What the buy back list shows for a pledge. */
export interface BuybackView {
  id: number;
  /** Shown instead of the id, if set (made-up ids of the demo view). */
  displayId?: string;
  /** The order that created the pledge, if it was paid with money (see `src/orders`). */
  order?: PaidOrder;
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
  /** The best insurance, if known (see `insurance.ts`): only pledges with several items list them. */
  insurance?: Insurance;
  isPaint: boolean;
  isCcu: boolean;
  /** See `BuybackPledge.upgrade`. */
  upgrade?: BuybackUpgrade;
  isStandaloneShip: boolean;
  /** RSI's product category "game package": the game is what the pledge is about. */
  isGamePackage: boolean;
  hasGameAccess: boolean;
  /** Probably giftable when bought back with money (see `probably-giftable.ts`). */
  isProbablyGiftable: boolean;
  /** What buying it back costs, if known (see `buyback-price.ts`). */
  price?: BuybackPrice;
  /** Set if RSI can't sell it again, with the reason (see `buyback-availability.ts`). */
  unavailable?: BuybackUnavailable;
  /** Its detail page was read for the price (a price or none), so it needn't be read again. */
  priceRead: boolean;
  /** Its expected price increase, if any (#190, see `price-increase-match.ts`). */
  priceIncrease?: PriceIncreaseMatch;
  /** A CCU whose base or target ship is expected to rise (#250, see `ccu-price-change.ts`). */
  ccuPriceChange?: CcuPriceChange;
  /** Normalized title, ship names and pledge id for the live search. */
  searchText: string;
}

export interface BuybackViewContext {
  /** Index in the stored buy back, which has RSI's order. */
  position: number;
  shipLinks?: ShipLinks;
  /** Whether a pledge is probably giftable (see `probably-giftable.ts`); without it none is. */
  giftable?: GiftableCheck;
  /** The buy back price of a pledge (see `buyback-price.ts`). */
  priceOf?: BuybackPricer;
  /** The best image of a pledge (see `buyback-image.ts`); without it RSI's own, if real. */
  imageOf?: BuybackImager;
  /** Whether RSI can sell the pledge again (see `buyback-availability.ts`). */
  availabilityOf?: AvailabilityCheck;
  /** The expected price increase of a pledge (see `price-increase-match.ts`). */
  priceIncreaseOf?: (pledge: BuybackPledge) => PriceIncreaseMatch | undefined;
  /** What expected price increases mean for a CCU; `paid` is its buy back price (#250). */
  ccuPriceChangeOf?: (pledge: BuybackPledge, paid?: number) => CcuPriceChange | undefined;
}

export function toBuybackView(pledge: BuybackPledge, context: BuybackViewContext): BuybackView {
  const {
    position,
    shipLinks = {},
    giftable,
    priceOf,
    imageOf,
    availabilityOf,
    priceIncreaseOf,
    ccuPriceChangeOf,
  } = context;
  const unavailable = availabilityOf?.(pledge);
  const priceIncrease = priceIncreaseOf?.(pledge);
  const price = priceOf?.(pledge);
  const ccuPriceChange = ccuPriceChangeOf?.(pledge, price?.amount);
  // The detail page lists the items besides the main one named in "Contained".
  const extraItems = pledge.items ?? [];
  const main = mainItem(pledge);
  const items = extraItems.length
    ? [...(main ? [main] : []), ...extraItems.filter((item) => item !== main)]
    : [];
  const shipNames = buybackShipNames(pledge);
  return {
    id: pledge.id,
    position,
    page: Math.floor(position / BUYBACK_PAGE_SIZE) + 1,
    title: pledge.title,
    image: imageOf ? imageOf(pledge) : isRealImage(pledge.image) ? pledge.image : undefined,
    reclaimedAt: pledge.reclaimedAt,
    contained: pledge.contained,
    items,
    ships: shipNames.map((name) => ({ name, link: shipLinks[name] })),
    hasLti: items.some((item) => /lifetime insurance/i.test(item)),
    insurance: bestInsurance(items),
    isPaint:
      !pledge.isUpgrade &&
      (/^paints?\b/i.test(pledge.title) ||
        (!hasSeveralItems(pledge) && /\b(paint|livery)\b/i.test(pledge.contained))),
    isCcu: pledge.isUpgrade,
    upgrade: pledge.upgrade,
    isStandaloneShip: pledge.category === 'standalone_ship',
    isGamePackage: pledge.category === 'game_package',
    hasGameAccess:
      pledge.category === 'game_package' || items.some((item) => GAME_DOWNLOAD.test(item)),
    // What RSI can't sell again can't be bought back, so it can't become giftable either (#207).
    isProbablyGiftable: !unavailable && (giftable?.(pledge.id) ?? false),
    ...(price && { price }),
    ...(unavailable && { unavailable }),
    ...(priceIncrease && { priceIncrease }),
    ...(ccuPriceChange && { ccuPriceChange }),
    priceRead: pledge.price !== undefined,
    searchText: normalizeSearchText([pledge.title, ...shipNames, pledge.id].join(' ')),
  };
}

/** All filters of the buy back list (their order and selection: `FILTERS` in config). */
export const BUYBACK_FILTERS = [
  'ships',
  'ccus',
  'paints',
  'gameAccess',
  'lti',
  'warbond',
  'probablyGiftable',
  'available',
  'priceIncrease',
  'rewards',
] as const;
export type BuybackFilter = (typeof BUYBACK_FILTERS)[number];

export const BUYBACK_FILTER_CATEGORIES: Record<FilterCategory, readonly BuybackFilter[]> = {
  types: ['ships', 'ccus', 'paints', 'gameAccess', 'rewards'],
  features: ['lti', 'warbond', 'probablyGiftable', 'available', 'priceIncrease'],
};

export const BUYBACK_FILTER_PREDICATES: FilterPredicates<BuybackView, BuybackFilter> = {
  ships: (pledge) => pledge.ships.length > 0,
  ccus: (pledge) => pledge.isCcu,
  paints: (pledge) => pledge.isPaint,
  gameAccess: (pledge) => pledge.hasGameAccess,
  lti: (pledge) => pledge.hasLti,
  warbond: (pledge) => pledge.order !== undefined,
  probablyGiftable: (pledge) => pledge.isProbablyGiftable,
  // Excluded, it shows the pledges RSI can't sell again (#207).
  available: (pledge) => !pledge.unavailable,
  // Any expected price increase; the buy back list narrows it to the period of the settings
  // (`withinPricePeriod`, #192).
  // Also CCUs whose base ship rises (#256); the list limits it to the period of the settings.
  priceIncrease: hasPriceChange,
  // The buy back shows no values, so rewards are recognized by their names.
  rewards: (pledge) => isRewardTitle(pledge.title),
};
