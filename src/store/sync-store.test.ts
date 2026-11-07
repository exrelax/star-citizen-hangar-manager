import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '@/settings/settings';
import { STORE_SNAPSHOT_VERSION, storeSnapshot } from './store-storage';
import { isStoreDue, maybeRefreshStore, refreshStore, storeSyncState } from './sync-store';
import type { StoreData } from './warbond';

const DATA: StoreData = { ships: [{ id: 1, name: 'Mercury', msrp: 260 }], warbonds: [] };
const MINUTE = 60_000;
const START = Date.parse('2026-11-07T12:00:00Z');

describe('isStoreDue', () => {
  const snapshot = {
    version: STORE_SNAPSHOT_VERSION,
    fetchedAt: new Date(START).toISOString(),
    data: DATA,
  };

  it('is due without offers, for an older format and once they are too old', () => {
    expect(isStoreDue(null, 5 * MINUTE, START)).toBe(true);
    expect(isStoreDue({ ...snapshot, version: 0 }, 5 * MINUTE, START)).toBe(true);
    expect(isStoreDue(snapshot, 5 * MINUTE, START + 4 * MINUTE)).toBe(false);
    expect(isStoreDue(snapshot, 5 * MINUTE, START + 5 * MINUTE)).toBe(true);
    expect(isStoreDue(snapshot, 0, START)).toBe(true);
  });
});

describe('refreshStore', () => {
  beforeEach(() => fakeBrowser.reset());

  it('stores the offers and reads them again only when due', async () => {
    const fetchData = vi.fn(async () => DATA);
    let now = START;
    await refreshStore({ fetchData, now: () => now });
    expect(await storeSnapshot.getValue()).toEqual({
      version: STORE_SNAPSHOT_VERSION,
      fetchedAt: new Date(START).toISOString(),
      data: DATA,
    });

    now += 3 * MINUTE;
    await refreshStore({ fetchData, maxAgeMs: 5 * MINUTE, now: () => now });
    expect(fetchData).toHaveBeenCalledTimes(1);
    // A refresh (no maximum age) reads them in any case.
    await refreshStore({ fetchData, now: () => now });
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('keeps the stored offers on a failure and reports it', async () => {
    await refreshStore({ fetchData: async () => DATA, now: () => START });
    await refreshStore({
      fetchData: async () => Promise.reject(new Error('offline')),
      now: () => START,
    });
    expect((await storeSnapshot.getValue())?.data).toEqual(DATA);
    expect(storeSyncState.error).toBe('offline');

    await refreshStore({ fetchData: async () => DATA, now: () => START });
    expect(storeSyncState.error).toBeUndefined();
  });

  it('reads only once for calls during a read', async () => {
    const fetchData = vi.fn(async () => DATA);
    await Promise.all([refreshStore({ fetchData }), refreshStore({ fetchData })]);
    expect(fetchData).toHaveBeenCalledTimes(1);
  });
});

describe('maybeRefreshStore', () => {
  beforeEach(() => fakeBrowser.reset());

  it('follows the interval of the settings', async () => {
    const fetchData = vi.fn(async () => DATA);
    await settingsItem.setValue({ storeRefreshMinutes: 10 });
    await maybeRefreshStore({ fetchData, now: () => START });
    await maybeRefreshStore({ fetchData, now: () => START + 9 * MINUTE });
    expect(fetchData).toHaveBeenCalledTimes(1);
    await maybeRefreshStore({ fetchData, now: () => START + 10 * MINUTE });
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('with smart updates off, reads only if nothing is stored', async () => {
    const fetchData = vi.fn(async () => DATA);
    await settingsItem.setValue({ smartUpdates: false });
    await maybeRefreshStore({ fetchData, now: () => START });
    await maybeRefreshStore({ fetchData, now: () => START + 24 * 60 * MINUTE });
    expect(fetchData).toHaveBeenCalledTimes(1);
  });
});
