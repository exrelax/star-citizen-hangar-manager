import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { runMigration } from './migrate';
import { STORAGES } from './registry';

beforeEach(() => fakeBrowser.reset());

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
});

describe('STORAGES', () => {
  it('lists every key once, old ones included', () => {
    const keys = STORAGES.flatMap((entry) => [
      entry.item.key,
      ...(entry.legacyKeys ?? []),
      ...(entry.obsoleteKeys ?? []),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
