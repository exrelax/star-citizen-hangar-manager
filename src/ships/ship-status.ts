import { SHIP_MATRIX } from '@/config';
import { defineMeta, hashOf, recordCheck, recordSync } from '@/storage/meta';

/*
 * The production status of the ships from RSI's public Ship Matrix (#252): which ships are flight
 * ready and which are still in concept. A ship in concept usually becomes more expensive once it
 * is flight ready, so a CCU to it may gain value later (see the advice in `ccu-advice.ts`). The
 * Ship Matrix uses the upgrade tool's ship ids. Its answer is large (several MB), so it is read
 * at most once a day, and only id and status are kept.
 */

export type ProductionStatus = 'flight-ready' | 'in-concept';

export interface ShipStatusSnapshot {
  version: number;
  /** The ships in concept, by id; every other ship of the Ship Matrix is flight ready. */
  inConcept: number[];
  /** How many ships the Ship Matrix listed. */
  count: number;
}

/** Format version of the stored status; others are ignored and read again. */
export const SHIP_STATUS_VERSION = 1;

export const shipStatusItem = storage.defineItem<ShipStatusSnapshot | null>('local:ships.status', {
  fallback: null,
});
export const shipStatusMeta = defineMeta('local:ships.status');

/** The stored status if it has the current format. */
export const currentShipStatus = (value: ShipStatusSnapshot | null | undefined) =>
  value?.version === SHIP_STATUS_VERSION ? value : undefined;

/** The status of the Ship Matrix's answer; throws if it has none. */
export function parseShipMatrix(json: unknown): ShipStatusSnapshot {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data) || !data.length) throw new Error('The Ship Matrix listed no ships');
  const inConcept = data.flatMap((ship: { id?: unknown; production_status?: unknown }) =>
    typeof ship?.id === 'number' && ship.production_status === 'in-concept' ? [ship.id] : [],
  );
  return {
    version: SHIP_STATUS_VERSION,
    inConcept: inConcept.sort((a, b) => a - b),
    count: data.length,
  };
}

async function fetchShipStatus(): Promise<ShipStatusSnapshot> {
  const response = await fetch(SHIP_MATRIX.url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Loading the Ship Matrix failed: HTTP ${response.status}`);
  return parseShipMatrix(await response.json());
}

let running: Promise<void> | undefined;

/**
 * Reads the Ship Matrix if its status is missing or older than `SHIP_MATRIX.maxAgeMs` (`force`:
 * in any case). A failure keeps the stored status.
 */
export function maybeRefreshShipStatus({
  force = false,
  fetchStatus = fetchShipStatus,
  now = Date.now,
}: {
  force?: boolean;
  fetchStatus?: () => Promise<ShipStatusSnapshot>;
  now?: () => number;
} = {}): Promise<void> {
  running ??= (async () => {
    const [stored, meta] = await Promise.all([
      shipStatusItem.getValue(),
      shipStatusMeta.getValue(),
    ]);
    const due = !currentShipStatus(stored) || now() - meta.checkedAt >= SHIP_MATRIX.maxAgeMs;
    if (!force && !due) return;
    try {
      const status = await fetchStatus();
      const at = now();
      const fingerprint = hashOf(status);
      const unchanged = currentShipStatus(stored) && meta.fingerprint === fingerprint;
      if (!unchanged) await shipStatusItem.setValue(status);
      await recordSync(shipStatusMeta, {
        at,
        fingerprint,
        ...(unchanged && { updatedAt: meta.updatedAt }),
      });
    } catch (cause) {
      console.warn('[star-citizen-hangar-manager] Ship Matrix unavailable', cause);
      await recordCheck(shipStatusMeta, { status: 'failed' }, { at: now() });
    }
  })().finally(() => (running = undefined));
  return running;
}
