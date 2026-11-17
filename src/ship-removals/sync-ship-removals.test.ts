import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ShipRemoval } from './ship-removals';
import { shipRemovalsItem, shipRemovalsMeta } from './ship-removals-storage';
import { maybeRefreshShipRemovals } from './sync-ship-removals';

/** 11:30 UTC: read at 11:00, next at 13:00 (`SITE_DATA.schedule`). */
const NOW = Date.UTC(2026, 10, 10, 11, 30);
const HOUR = 60 * 60 * 1000;

const hornet: ShipRemoval = {
  ship: { id: 15, name: 'F7C-M Super Hornet Mk I' },
  removedAt: { at: Date.parse('2026-11-27T00:00:00Z'), dayOnly: true },
  source: 'https://robertsspaceindustries.com/comm-link/transmission/12345',
};

beforeEach(() => fakeBrowser.reset());

describe('maybeRefreshShipRemovals', () => {
  it('stores the file and reads it again at the next time of the schedule', async () => {
    const fetch = vi.fn(async () => [hornet]);
    await maybeRefreshShipRemovals({ fetch, now: () => NOW });
    await maybeRefreshShipRemovals({ fetch, now: () => NOW + HOUR });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await shipRemovalsItem.getValue()).toEqual({ version: 1, shipRemovals: [hornet] });

    await maybeRefreshShipRemovals({ fetch, now: () => NOW + 2 * HOUR });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the stored ones while offline or with a file of another format', async () => {
    await maybeRefreshShipRemovals({ fetch: async () => [hornet], now: () => NOW });
    await maybeRefreshShipRemovals({
      force: true,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      now: () => NOW + HOUR,
    });
    await maybeRefreshShipRemovals({
      force: true,
      fetch: async () => undefined,
      now: () => NOW + 2 * HOUR,
    });
    expect((await shipRemovalsItem.getValue())?.shipRemovals).toEqual([hornet]);
    expect((await shipRemovalsMeta.getValue()).lastOutcome?.status).toBe('failed');
  });

  it('reads stored data of an earlier format again at once', async () => {
    await maybeRefreshShipRemovals({ fetch: async () => [hornet], now: () => NOW });
    await shipRemovalsItem.setValue({ version: 0, shipRemovals: [] });
    const fetch = vi.fn(async () => [hornet]);
    await maybeRefreshShipRemovals({ fetch, now: () => NOW + 60_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
