import type { Pledge, PledgeItem, PledgeUpgrade } from './pledge';
import { normalizeSearchText } from './search';

/** What the manager list shows for a pledge. */
export interface PledgeView {
  id: number;
  title: string;
  /** Original pledge name, set when a CCU replaced the ship of the pledge. */
  originalName?: string;
  /**
   * Ships contained in the pledge, except the one already shown as title. Makes packages like
   * "VIP Wing Commander" (F8C Lightning) recognizable and searchable.
   */
  ships: string[];
  image?: string;
  value: string;
  createdAt?: string;
  hasLti: boolean;
  /** Pure paint pledge: contains nothing but paints (no ship, poster, gear, …). */
  isPaint: boolean;
  /** CCU that has not been applied yet (applied ones disappear from the hangar). */
  isCcu: boolean;
  isStandaloneShip: boolean;
  isGamePackage: boolean;
  isGiftable: boolean;
  isMeltable: boolean;
  isUpgraded: boolean;
  items: PledgeItem[];
  upgrade?: PledgeUpgrade;
  /** Normalized title and ship names, prepared once so the live search stays cheap. */
  searchText: string;
}

const PLACEHOLDER_IMAGE = '/static/images/Temp/default-image';

export function toPledgeView(pledge: Pledge): PledgeView {
  // After a CCU the pledge keeps its original name and image, but the contained ship is current.
  const currentShip = pledge.isUpgraded
    ? pledge.items.find((item) => item.kind === 'Ship')
    : undefined;

  const title = currentShip?.title ?? pledge.title;
  const ships = [
    ...new Set(
      pledge.items
        .filter((item) => item.kind === 'Ship' && item.title !== title)
        .map((item) => item.title),
    ),
  ];
  return {
    id: pledge.id,
    title,
    originalName: currentShip ? pledge.name : undefined,
    ships,
    image: pledgeImage(pledge, currentShip),
    value: pledge.value,
    createdAt: pledge.createdAt,
    hasLti: pledge.items.some((item) => item.kind === 'Insurance' && /lifetime/i.test(item.title)),
    isPaint: !pledge.upgrade && pledge.items.length > 0 && pledge.items.every(isPaintItem),
    isCcu: pledge.upgrade !== undefined,
    isStandaloneShip: pledge.category === 'standalone_ship',
    isGamePackage: pledge.category === 'game_package',
    isGiftable: pledge.isGiftable,
    isMeltable: pledge.isExchangeable,
    isUpgraded: currentShip !== undefined,
    items: pledge.items,
    upgrade: pledge.upgrade,
    searchText: normalizeSearchText([title, ...ships].join(' ')),
  };
}

function pledgeImage(pledge: Pledge, currentShip: PledgeItem | undefined): string | undefined {
  if (currentShip?.image) return currentShip.image;
  if (pledge.upgrade?.targetImage) return pledge.upgrade.targetImage;
  if (isRealImage(pledge.image)) return pledge.image;
  return pledge.items.find((item) => isRealImage(item.image))?.image;
}

function isPaintItem(item: PledgeItem): boolean {
  // RSI occasionally lists a paint without a kind, e.g. "400i - Meridian Paint".
  return item.kind === 'Skin' || (!item.kind && /\b(paint|livery)\b/i.test(item.title));
}

function isRealImage(url: string | undefined): url is string {
  return !!url && !url.includes(PLACEHOLDER_IMAGE);
}
