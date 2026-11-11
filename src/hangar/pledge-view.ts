import type { CcuPriceChange } from '@/price-increases/ccu-price-change';
import type { PriceIncreaseMatch } from '@/price-increases/price-increase-match';
import { HANGAR_PAGE_SIZE } from '@/config';
import type { Game, Pledge, PledgeItem, PledgeUpgrade } from './pledge';
import type { PaidOrder } from '@/orders/orders';
import { rewardKind, type RewardKind } from './rewards';
import { bestInsurance, type Insurance } from './insurance';
import { normalizeSearchText } from './search';
import type { ShipLink, ShipLinks } from './ship-links';
import {
  pledgeDiscount,
  roundPaintDiscount,
  type PledgeDiscount,
  type PriceLookup,
} from './ship-prices';
import type { ItemPriceLookup } from '@/store/items/item-prices';

/** A ship with its links to other platforms (if known). */
export interface ShipRef {
  name: string;
  link?: ShipLink;
}

/** What the manager list shows for a pledge. */
export interface PledgeView {
  id: number;
  /** Shown instead of the id, if set (made-up ids of the demo view). */
  displayId?: string;
  /** Page of the pledge in RSI's "My Gear" list, as of the last sync. */
  page: number;
  title: string;
  /** Original pledge name, set when a CCU replaced the ship of the pledge. */
  originalName?: string;
  /** The ship shown as title (upgraded pledges), for its links. */
  titleShip?: ShipRef;
  /**
   * Ships contained in the pledge, except the one already shown as title. Makes packages like
   * "VIP Wing Commander" (F8C Lightning) recognizable and searchable.
   */
  ships: ShipRef[];
  image?: string;
  value: string;
  /** `value` in USD, e.g. for the "valuable" filter. */
  valueUsd: number;
  /** The order that created the pledge, if it was paid with money (see `src/orders`). */
  order?: PaidOrder;
  /** Discount compared to the original price of the ship or CCU, if known (see `ship-prices.ts`). */
  discount?: PledgeDiscount;
  createdAt?: string;
  /** Set for reward pledges (value $0). */
  reward?: RewardKind;
  hasLti: boolean;
  /**
   * The best insurance of the pledge, the one that counts (see `insurance.ts`). For a CCU: the
   * insurance it brings (RSI lists it with the upgrade's target items).
   */
  insurance?: Insurance;
  /** Pure paint pledge: contains nothing but paints (no ship, poster, gear, …). */
  isPaint: boolean;
  /** CCU that has not been applied yet (applied ones disappear from the hangar). */
  isCcu: boolean;
  isStandaloneShip: boolean;
  /** RSI's product category "game package": the game is what the pledge is about. */
  isGamePackage: boolean;
  /** Game package or another pledge that contains the game (e.g. "VIP High Admiral"). */
  hasGameAccess: boolean;
  /** Games whose access RSI protects with this pledge; empty if none (see `Pledge`). */
  protectedGames: Game[];
  /** Never for a protected pledge. */
  isGiftable: boolean;
  /** Never for a protected pledge. */
  isMeltable: boolean;
  /** RSI: the last pledge of the account with game access ("last alpha"). */
  isLastAlpha: boolean;
  /** RSI: once exchanged, the pledge can be bought back. */
  isBuybackable: boolean;
  isUpgraded: boolean;
  items: PledgeItem[];
  upgrade?: PledgeUpgrade;
  /** Normalized title, ship names and pledge id, prepared once so the live search stays cheap. */
  searchText: string;
  /** Its expected price increase, if any (#190, see `price-increase-match.ts`). */
  priceIncrease?: PriceIncreaseMatch;
  /** A CCU whose base or target ship is expected to rise (#250, see `ccu-price-change.ts`). */
  ccuPriceChange?: CcuPriceChange;
}

/** Items that grant access to the game, e.g. in VIP packages. */
export const GAME_DOWNLOAD = /^(star citizen|squadron 42) digital download$/i;

const PLACEHOLDER_IMAGE = '/static/images/Temp/default-image';

/**
 * `position`: index of the pledge in the stored hangar, which has RSI's order (newest first).
 * `priceOf`, `itemPriceOf`: original prices of ships and of the Pledge Store's items, for the
 * discount.
 */
export function toPledgeView(
  pledge: Pledge,
  shipLinks: ShipLinks = {},
  position = 0,
  priceOf?: PriceLookup,
  itemPriceOf?: ItemPriceLookup,
): PledgeView {
  // After a CCU the pledge keeps its original name and image, but the contained ship is current.
  const currentShip = pledge.isUpgraded
    ? pledge.items.find((item) => item.kind === 'Ship')
    : undefined;

  const title = currentShip?.title ?? pledge.title;
  const shipNames = new Set(
    pledge.items
      .filter((item) => item.kind === 'Ship' && item.title !== title)
      .map((item) => item.title),
  );
  const ships = [...shipNames].map((name) => ({ name, link: shipLinks[name] }));
  const hasGameAccess =
    pledge.category === 'game_package' ||
    pledge.items.some((item) => GAME_DOWNLOAD.test(item.title));
  const protectedGames = pledge.protectedGames ?? [];
  // RSI leaves out Exchange and Gift for protected pledges anyway; this also holds for pledges
  // whose buttons were stored before RSI started protecting them.
  const isProtected = protectedGames.length > 0;
  const isPaint = !pledge.upgrade && pledge.items.length > 0 && pledge.items.every(isPaintItem);
  const discount =
    priceOf || itemPriceOf
      ? pledgeDiscount(pledge, priceOf, hasGameAccess, itemPriceOf)
      : undefined;
  return {
    id: pledge.id,
    page: Math.floor(position / HANGAR_PAGE_SIZE) + 1,
    title,
    originalName: currentShip ? pledge.name : undefined,
    titleShip: currentShip ? { name: title, link: shipLinks[title] } : undefined,
    ships,
    image: pledgeImage(pledge, currentShip),
    value: pledge.value,
    valueUsd: pledge.valueUsd,
    // Paints are rounded to RSI's volume discount tiers.
    discount: discount && isPaint ? roundPaintDiscount(discount) : discount,
    createdAt: pledge.createdAt,
    reward: rewardKind(pledge),
    hasLti: pledge.items.some((item) => item.kind === 'Insurance' && /lifetime/i.test(item.title)),
    insurance: bestInsurance(
      pledge.upgrade
        ? pledge.upgrade.targetItems.map((item) => item.name)
        : pledge.items.filter((item) => item.kind === 'Insurance').map((item) => item.title),
    ),
    isPaint,
    isCcu: pledge.upgrade !== undefined,
    isStandaloneShip: pledge.category === 'standalone_ship',
    isGamePackage: pledge.category === 'game_package',
    hasGameAccess,
    protectedGames,
    isGiftable: pledge.isGiftable && !isProtected,
    isMeltable: pledge.isExchangeable && !isProtected,
    isLastAlpha: pledge.isLastAlpha,
    isBuybackable: pledge.isBuybackable,
    isUpgraded: currentShip !== undefined,
    items: pledge.items,
    upgrade: pledge.upgrade,
    searchText: normalizeSearchText([title, ...shipNames, pledge.id].join(' ')),
  };
}

function pledgeImage(pledge: Pledge, currentShip: PledgeItem | undefined): string | undefined {
  if (currentShip?.image) return currentShip.image;
  if (pledge.upgrade?.targetImage) return pledge.upgrade.targetImage;
  if (isRealImage(pledge.image)) return pledge.image;
  return pledge.items.find((item) => isRealImage(item.image))?.image;
}

/** Whether an item of a pledge is a paint. */
export function isPaintItem(item: PledgeItem): boolean {
  // RSI occasionally lists a paint without a kind, e.g. "400i - Meridian Paint".
  return item.kind === 'Skin' || (!item.kind && /\b(paint|livery)\b/i.test(item.title));
}

/** Whether the image is one of its own, not RSI's placeholder. */
export function isRealImage(url: string | undefined): url is string {
  return !!url && !url.includes(PLACEHOLDER_IMAGE);
}
