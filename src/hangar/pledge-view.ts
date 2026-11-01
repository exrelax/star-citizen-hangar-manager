import type { Pledge, PledgeItem, PledgeUpgrade } from './pledge';
import { normalizeSearchText } from './search';

/** What the manager list shows for a pledge. */
export interface PledgeView {
  id: number;
  title: string;
  /** Original pledge name, set when a CCU replaced the ship of the pledge. */
  originalName?: string;
  image?: string;
  value: string;
  createdAt?: string;
  hasLti: boolean;
  isGiftable: boolean;
  isMeltable: boolean;
  isUpgraded: boolean;
  items: PledgeItem[];
  upgrade?: PledgeUpgrade;
  /** Normalized title, prepared once so the live search stays cheap. */
  searchText: string;
}

const PLACEHOLDER_IMAGE = '/static/images/Temp/default-image';

export function toPledgeView(pledge: Pledge): PledgeView {
  // After a CCU the pledge keeps its original name and image, but the contained ship is current.
  const currentShip = pledge.isUpgraded
    ? pledge.items.find((item) => item.kind === 'Ship')
    : undefined;

  const title = currentShip?.title ?? pledge.title;
  return {
    id: pledge.id,
    title,
    originalName: currentShip ? pledge.name : undefined,
    image: pledgeImage(pledge, currentShip),
    value: pledge.value,
    createdAt: pledge.createdAt,
    hasLti: pledge.items.some((item) => item.kind === 'Insurance' && /lifetime/i.test(item.title)),
    isGiftable: pledge.isGiftable,
    isMeltable: pledge.isExchangeable,
    isUpgraded: currentShip !== undefined,
    items: pledge.items,
    upgrade: pledge.upgrade,
    searchText: normalizeSearchText(title),
  };
}

function pledgeImage(pledge: Pledge, currentShip: PledgeItem | undefined): string | undefined {
  if (currentShip?.image) return currentShip.image;
  if (pledge.upgrade?.targetImage) return pledge.upgrade.targetImage;
  if (isRealImage(pledge.image)) return pledge.image;
  return pledge.items.find((item) => isRealImage(item.image))?.image;
}

function isRealImage(url: string | undefined): url is string {
  return !!url && !url.includes(PLACEHOLDER_IMAGE);
}
