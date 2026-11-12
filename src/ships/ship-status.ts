import { SHIP_MATRIX } from '@/config';
import { settingsItem, withDefaults } from '@/settings/settings';
import { defineMeta, hashOf, recordCheck, recordSync } from '@/storage/meta';
import { lastReadTime } from '@/store/refresh-schedule';

/*
 * The production status of the ships from RSI's public Ship Matrix (#252): which ships are flight
 * ready and which are still in concept. A ship in concept usually becomes more expensive once it
 * is flight ready, so a CCU to it may gain value later (see the advice in `ccu-advice.ts`). The
 * Ship Matrix uses the upgrade tool's ship ids. It is read on the cycle of the Pledge Store items
 * (`SHIP_MATRIX.readAtMinutes`, once a day without smart updates); its answer is large (several
 * MB), so only id and status are kept.
 */

export type ProductionStatus = 'flight-ready' | 'in-concept';

export interface ShipStatusSnapshot {
  version: number;
  /** The ships in concept, by id. */
  inConcept: number[];
  /** The ships flight ready, by id; a ship in neither list has no value in the Ship Matrix. */
  flightReady: number[];
  /** How many ships the Ship Matrix listed. */
  count: number;
}

/** Format version of the stored status; others are ignored and read again. */
export const SHIP_STATUS_VERSION = 2;

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
  const ids = (status: string) =>
    data
      .flatMap((ship: { id?: unknown; production_status?: unknown }) =>
        typeof ship?.id === 'number' && ship.production_status === status ? [ship.id] : [],
      )
      .sort((a, b) => a - b);
  return {
    version: SHIP_STATUS_VERSION,
    inConcept: ids('in-concept'),
    flightReady: ids('flight-ready'),
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
 * How old the stored status may be at `now`: with smart updates, read since the latest of
 * `SHIP_MATRIX.readAtMinutes` (like the Pledge Store items); without, a day.
 */
export async function shipStatusMaxAgeMs(now: number): Promise<number> {
  const settings = withDefaults(await settingsItem.getValue());
  return settings.smartUpdates
    ? now - lastReadTime(now, SHIP_MATRIX.readAtMinutes)
    : SHIP_MATRIX.maxAgeWithoutSmartUpdatesMs;
}

/**
 * Reads the Ship Matrix if its status is missing or due (see `shipStatusMaxAgeMs`; `force`: in any
 * case). A failure keeps the stored status.
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
    const due =
      !currentShipStatus(stored) || now() - meta.checkedAt >= (await shipStatusMaxAgeMs(now()));
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

/**
 * The production status of a ship (#265): from the Ship Matrix, which the extension reads itself –
 * the most current, straight from CIG – and, where it gives none (a ship it doesn't list, or the
 * Ship Matrix not read yet or failing), from the website's ship facts (#109). `undefined` if
 * neither knows.
 */
export function createShipStatusLookup(
  matrix: ShipStatusSnapshot | null | undefined,
  websiteStatus?: (id: number) => string | undefined,
): (id: number) => ProductionStatus | string | undefined {
  const current = currentShipStatus(matrix);
  const inConcept = new Set(current?.inConcept);
  const flightReady = new Set(current?.flightReady);
  return (id) =>
    inConcept.has(id) ? 'in-concept' : flightReady.has(id) ? 'flight-ready' : websiteStatus?.(id);
}
