import type { Pledge } from '@/hangar/pledge';
import { isRealImage } from '@/hangar/pledge-view';
import { shipKey } from '@/hangar/ship-images';
import type { Ship } from '@/ships/ships';
import { buybackShipNames, mainItem, type BuybackPledge } from './buyback';

/*
 * The image of a buy back pledge (#202). RSI's buy back list often shows only its placeholder,
 * e.g. for CCUs, so the image is taken, in this order:
 * - CCUs: always the target ship – by the upgrade tool's ship id of the "Buy Back" button, else by
 *   the target's name in the title – from the ship catalog or the ships of the stored hangar, like
 *   My Hangar shows them; RSI's image only if none of them is known.
 * - Other pledges: RSI's image, if it is a real one; else that of the pledge or item of the same
 *   title in the stored hangar, then that of the contained ship.
 * Without one the row shows only the kind's icon.
 */

export interface BuybackImageSources {
  /** The ships of the upgrade tool, with their images. */
  ships?: readonly Ship[];
  /** The pledges of the stored hangar. */
  hangarPledges?: readonly Pledge[];
}

/** "Upgrade - Valkyrie to Galaxy Standard Edition" → "Galaxy Standard Edition". */
const UPGRADE_TARGET = /^upgrades?\s*-\s*.+?\s+to\s+(.+)$/i;

/** A function giving the image of a buy back pledge, if one is known. */
export function createBuybackImager({ ships = [], hangarPledges = [] }: BuybackImageSources) {
  const byShipId = new Map<number, string>();
  const byShipName = new Map<string, string>();
  const byTitle = new Map<string, string>();
  const keep = (map: Map<string, string>, key: string, image: string | undefined) => {
    if (isRealImage(image) && !map.has(key)) map.set(key, image);
  };
  for (const ship of ships) {
    if (isRealImage(ship.image)) byShipId.set(ship.id, ship.image);
    keep(byShipName, shipKey(ship.name), ship.image);
  }
  for (const pledge of hangarPledges) {
    for (const item of pledge.items) {
      if (item.kind === 'Ship') keep(byShipName, shipKey(item.title), item.image);
      keep(byTitle, item.title, item.image);
    }
    keep(byTitle, pledge.title, pledge.upgrade?.targetImage ?? pledge.image);
  }

  /** The image of a ship by its name; trailing words like "Standard Edition" may be left out. */
  const shipImage = (name: string): string | undefined => {
    const words = name.trim().split(/\s+/);
    for (let count = words.length; count > 0; count--) {
      const image = byShipName.get(shipKey(words.slice(0, count).join(' ')));
      if (image) return image;
    }
    return undefined;
  };

  return (pledge: BuybackPledge): string | undefined => {
    if (pledge.isUpgrade) {
      const byId = pledge.upgrade && byShipId.get(pledge.upgrade.toShipId);
      if (byId) return byId;
      const target = UPGRADE_TARGET.exec(pledge.title)?.[1];
      return (
        (target && shipImage(target)) ||
        byTitle.get(pledge.title) ||
        (isRealImage(pledge.image) ? pledge.image : undefined)
      );
    }
    if (isRealImage(pledge.image)) return pledge.image;
    const main = mainItem(pledge);
    return (
      byTitle.get(pledge.title) ??
      buybackShipNames(pledge).map(shipImage).find(Boolean) ??
      (main ? byTitle.get(main) : undefined)
    );
  };
}

export type BuybackImager = ReturnType<typeof createBuybackImager>;
