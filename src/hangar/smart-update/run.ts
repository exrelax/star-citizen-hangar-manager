import { hangarCheckState, hangarSnapshot, type CheckOutcome } from '../hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, PLEDGE_CATEGORIES, type Pledge } from '../pledge';
import { fetchShipMatrixImages, resolveUpgradeImages, type ShipImages } from '../ship-images';
import { resolveShipLinks, type ShipLinks } from '../ship-links';
import { fetchPledgePage, type FetchPledgePage } from '../sync';
import { checkHangar } from './check';

export interface SmartUpdateDeps {
  fetchPage?: FetchPledgePage;
  fetchShipImages?: () => Promise<ShipImages>;
  fetchShipLinks?: (pledges: Pledge[], previous: ShipLinks | undefined) => Promise<ShipLinks>;
  now?: () => number;
  /** Pages checked besides the first and the last one (the setting). */
  spotCheckPages?: number;
}

/**
 * Checks the stored hangar against RSI and stores the changes. New pledges get their RSI category
 * and – for new CCUs or ships – images and links; only then is the snapshot replaced, and only if
 * no full sync replaced it in the meantime.
 */
export async function runSmartUpdate(deps: SmartUpdateDeps = {}): Promise<CheckOutcome | null> {
  const {
    fetchPage = fetchPledgePage,
    fetchShipImages = fetchShipMatrixImages,
    fetchShipLinks = resolveShipLinks,
    now = Date.now,
    spotCheckPages,
  } = deps;

  const snapshot = await hangarSnapshot.getValue();
  if (snapshot?.version !== HANGAR_SNAPSHOT_VERSION) return null;
  const checkState = await hangarCheckState.getValue();

  const saveOutcome = async (outcome: Omit<CheckOutcome, 'at'>, cursor = checkState.cursor) => {
    const result = { ...outcome, at: now() };
    await hangarCheckState.setValue({ lastCheckAt: result.at, cursor, lastOutcome: result });
    return result;
  };

  const result = await checkHangar(snapshot.pledges, {
    fetchPage: (page) => fetchPage(page),
    cursor: checkState.cursor,
    spotCheckPages,
  });
  const none = { added: 0, removed: 0, changed: 0 };
  if (result.status !== 'updated') {
    return saveOutcome({ status: result.status, ...none }, result.nextCursor);
  }

  const { pledges, added, removed, changed } = result;

  // New pledges almost always appear at the top of RSI's category lists as well.
  if (added.length) {
    const addedById = new Map(added.map((pledge) => [pledge.id, pledge]));
    for (const category of PLEDGE_CATEGORIES) {
      const page = await fetchPage(1, category);
      for (const { id } of page.pledges) {
        const pledge = addedById.get(id);
        if (pledge) pledge.category = category;
      }
    }
  }

  if (added.some((pledge) => pledge.upgrade)) {
    const images = await fetchShipImages().catch(() => new Map() as ShipImages);
    resolveUpgradeImages(pledges, images);
  }

  let shipLinks = snapshot.shipLinks;
  const knownShips = new Set(Object.keys(shipLinks ?? {}));
  const hasNewShip = [...added, ...changed].some((pledge) =>
    pledge.items.some((item) => item.kind === 'Ship' && !knownShips.has(item.title)),
  );
  if (hasNewShip) {
    shipLinks = await fetchShipLinks(pledges, shipLinks).catch(() => shipLinks);
  }

  // A full sync that finished in the meantime is more recent than this check – keep it.
  const current = await hangarSnapshot.getValue();
  if (current?.syncedAt !== snapshot.syncedAt || current?.updatedAt !== snapshot.updatedAt) {
    return null;
  }

  await hangarSnapshot.setValue({
    ...snapshot,
    pledges,
    shipLinks,
    updatedAt: new Date(now()).toISOString(),
  });
  return saveOutcome(
    { status: 'updated', added: added.length, removed: removed.length, changed: changed.length },
    result.nextCursor,
  );
}
