import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hangarMeta } from '@/hangar/hangar-storage';
import { runMigration } from './migrate';
import { STORAGES } from './registry';

beforeEach(() => fakeBrowser.reset());

const SYNCED = '2026-11-01T10:00:00.000Z';
const UPDATED = '2026-11-06T10:00:00.000Z';

describe('runMigration', () => {
  it('moves data of earlier keys, removes obsolete ones and keeps newer data', async () => {
    await storage.setItem('local:hangar.snapshot', { pledges: ['old'] });
    await storage.setItem('local:orders.snapshot', { orders: ['old'] });
    await storage.setItem('local:orders.history', { orders: ['new'] });
    await storage.setItem('local:hangar.shipPrices', { ships: [] });

    await runMigration();

    expect(await storage.getItem('local:hangar.items')).toEqual({ pledges: ['old'] });
    expect(await storage.getItem('local:orders.history')).toEqual({ orders: ['new'] });
    for (const key of ['hangar.snapshot', 'orders.snapshot', 'hangar.shipPrices'] as const) {
      expect(await storage.getItem(`local:${key}`)).toBeNull();
    }
    expect(await storage.getItem('local:ships')).toBeNull();
  });

  it('turns the data timestamps and the old check state into the metadata', async () => {
    const outcome = { at: 5, status: 'unchanged', added: 0, removed: 0, changed: 0 };
    await storage.setItem('local:hangar.snapshot', { syncedAt: SYNCED, updatedAt: UPDATED });
    await storage.setItem('local:hangar.checkState', {
      lastCheckAt: 5,
      cursor: 7,
      lastOutcome: outcome,
    });

    await runMigration();

    expect(await hangarMeta.getValue()).toEqual({
      syncedAt: Date.parse(SYNCED),
      updatedAt: Date.parse(UPDATED),
      checkedAt: 5,
      lastOutcome: outcome,
      cursor: 7,
    });
    expect(await storage.getItem('local:hangar.checkState')).toBeNull();
    // Done once: existing metadata stays.
    await hangarMeta.setValue({ ...(await hangarMeta.getValue()), checkedAt: 9 });
    await runMigration();
    expect((await hangarMeta.getValue()).checkedAt).toBe(9);
  });
});

describe('runMigration with metadata of a check only', () => {
  it('fills in the times of the last full sync from the data', async () => {
    await storage.setItem('local:hangar.items', { syncedAt: SYNCED, updatedAt: UPDATED });
    await hangarMeta.setValue({ syncedAt: 0, updatedAt: 0, checkedAt: 9, lastOutcome: null });
    await runMigration();
    expect(await hangarMeta.getValue()).toMatchObject({
      syncedAt: Date.parse(SYNCED),
      updatedAt: Date.parse(UPDATED),
      checkedAt: 9,
    });
  });
});

describe('STORAGES', () => {
  it('lists every key once, old ones and metadata included', () => {
    const keys = STORAGES.flatMap((entry) => [
      entry.item.key,
      ...(entry.meta ? [entry.meta.key] : []),
      ...(entry.legacyKeys ?? []),
      ...(entry.obsoleteKeys ?? []),
      ...(entry.legacyCheckKeys ?? []),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
