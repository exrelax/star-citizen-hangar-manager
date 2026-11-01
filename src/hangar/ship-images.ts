import type { Pledge } from './pledge';

/** Ship images by `shipKey(name)`. */
export type ShipImages = Map<string, string>;

/**
 * Normalizes ship names so different spellings match, e.g. "Hercules Starlifter M2" and
 * "M2 Hercules Starlifter": lower case, words only, in sorted order.
 */
export function shipKey(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

interface ShipMatrixShip {
  name?: string;
  media?: { images?: Record<string, string> }[];
}

/** Reads ship images from the public RSI ship matrix (`/ship-matrix/index`). */
export function parseShipMatrix(json: unknown): ShipImages {
  const images: ShipImages = new Map();
  const ships = (json as { data?: ShipMatrixShip[] } | null)?.data;
  if (!Array.isArray(ships)) return images;

  for (const ship of ships) {
    const media = ship.media?.[0]?.images;
    const image = media?.store_small ?? media?.subscribers_vault_thumbnail;
    if (ship.name && image) images.set(shipKey(ship.name), image);
  }
  return images;
}

export async function fetchShipMatrixImages(): Promise<ShipImages> {
  const response = await fetch('/ship-matrix/index', { credentials: 'include' });
  if (!response.ok) throw new Error(`Loading the ship matrix failed: HTTP ${response.status}`);
  return parseShipMatrix(await response.json());
}

/**
 * Sets `upgrade.targetImage` of CCU pledges. Prefers the ship matrix, then ship images found in
 * the hangar itself. The first target item with a known image wins (targets can also contain
 * paints or posters).
 */
export function resolveUpgradeImages(pledges: Pledge[], matrixImages: ShipImages): void {
  const hangarImages: ShipImages = new Map();
  for (const pledge of pledges) {
    for (const item of pledge.items) {
      if (item.kind === 'Ship' && item.image && !hangarImages.has(shipKey(item.title))) {
        hangarImages.set(shipKey(item.title), item.image);
      }
    }
  }

  for (const pledge of pledges) {
    if (!pledge.upgrade) continue;
    for (const target of pledge.upgrade.targetItems) {
      const key = shipKey(target.name);
      const image = matrixImages.get(key) ?? hangarImages.get(key);
      if (image) {
        pledge.upgrade.targetImage = image;
        break;
      }
    }
  }
}
