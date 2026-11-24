import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { errorLogItem } from '@/errors/error-log';
import { hangarMeta } from '@/hangar/hangar-storage';
import { createShipFactsLookup } from '@/ships/ship-facts';
import {
  bundledShipFacts,
  maybeRefreshShipFacts,
  shipFactsItem,
  shipFactsMeta,
  storedShipFacts,
} from '@/ships/sync-ship-facts';
import { maybeRefreshSiteWarbondHistory } from '@/store/sync-site-warbond-history';
import {
  siteWarbondHistoryItem,
  siteWarbondHistoryMeta,
  storedSiteWarbondHistory,
} from '@/store/warbond-history-storage';
import type { WarbondSighting } from '@/store/warbond-history';
import { EMPTY_META } from './meta';
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

describe('runMigration of the paint plans (#635)', () => {
  it('moves the plan and the completed plans of this browser to the synced storage', async () => {
    const plan = {
      version: 2,
      way: 'buy',
      at: 1_763_661_600_000,
      tier: { paints: 2, percent: 15 },
      own: [],
      fillers: [{ skuId: 1, name: 'Filler', quantity: 2, price: 5 }],
      cartCost: 8.5,
    };
    const done = {
      way: 'buy',
      startedAt: 1_763_000_000_000,
      completedAt: 1_763_100_000_000,
      tier: { paints: 2, percent: 15 },
      ownCount: 0,
      fillerCount: 2,
      melted: [],
      bought: [],
      freed: 0,
      paid: 8.5,
      result: 0,
      meltBefore: 0,
      meltAfter: 0,
    };
    await storage.setItem('local:consultant.plan', plan);
    await storage.setItem('local:consultant.history', { version: 1, plans: [done] });

    await runMigration();

    const synced = await fakeBrowser.storage.sync.get(null);
    expect(Object.keys(synced).sort()).toEqual(
      [
        'consultant.done',
        `consultant.done.${(1_763_000_000_000).toString(36)}b`,
        'consultant.plan',
      ].sort(),
    );
    expect(await storage.getItem('local:consultant.plan')).toBeNull();
    expect(await storage.getItem('local:consultant.history')).toBeNull();
  });
});

describe('the data of the website stored by 1.1.1 (#479)', () => {
  const now = Date.now();
  const checked = (at: number) => ({ ...EMPTY_META, checkedAt: at, syncedAt: at });

  it('replaces the ships’ facts without their retired periods, read again at once', async () => {
    const bundled = bundledShipFacts()!;
    // 1.1.1 kept the sources' facts, `retired` included, but not the ships' periods.
    const old = {
      ...bundled,
      ships: bundled.ships.map((ship) => ({ ...ship, retired: undefined })),
    };
    await shipFactsItem.setValue({ version: 1, facts: old as unknown as typeof bundled });
    await shipFactsMeta.setValue(checked(now));

    // Meanwhile the bundled copy counts, so asking whether RSI still sells a ship works.
    const snapshot = await shipFactsItem.getValue();
    expect(storedShipFacts(snapshot)).toBeUndefined();
    const lookup = createShipFactsLookup(storedShipFacts(snapshot) ?? bundled);
    const ship = bundled.ships.find((entry) => entry.wikiName)!;
    expect(() => lookup.isPurchasable(ship.id)).not.toThrow();

    // Read at the first start, although the last read is less than a day old.
    await maybeRefreshShipFacts({ fetch: async () => bundled, now: () => now + 1 });
    expect(storedShipFacts(await shipFactsItem.getValue())).toEqual(bundled);
  });

  const offer: WarbondSighting = {
    shipId: 1,
    shipName: 'Aurora Mk I ES',
    skuId: 2,
    price: 30,
    msrp: 20,
    firstSeen: now - 10 * 24 * 60 * 60 * 1000,
    lastSeen: now - 9 * 24 * 60 * 60 * 1000,
  };

  it('keeps the warbond offers without an expected end until they are read again', async () => {
    await siteWarbondHistoryItem.setValue({ version: 1, offers: [offer] });
    await siteWarbondHistoryMeta.setValue(checked(now));
    expect(storedSiteWarbondHistory(await siteWarbondHistoryItem.getValue())).toEqual([offer]);

    // Read at once; offline they stay, and nothing shows empty.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await maybeRefreshSiteWarbondHistory({
      fetch: async () => {
        throw new Error('offline');
      },
      now: () => now + 1,
    });
    warn.mockRestore();
    expect(storedSiteWarbondHistory(await siteWarbondHistoryItem.getValue())).toEqual([offer]);
  });

  it('reads the warbond offers again at once, with their expected end', async () => {
    const read = { ...offer, expectedEnd: offer.lastSeen + 1000 };
    await siteWarbondHistoryItem.setValue({ version: 1, offers: [offer] });
    await siteWarbondHistoryMeta.setValue(checked(now));

    await maybeRefreshSiteWarbondHistory({ fetch: async () => [read], now: () => now + 1 });

    expect(await siteWarbondHistoryItem.getValue()).toEqual({ version: 2, offers: [read] });
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

  it('starts anyway when moving them fails, keeping them here (#658)', async () => {
    const plan = { version: 2, way: 'buy', at: 1, tier: { paints: 2, percent: 15 }, own: [] };
    await storage.setItem('local:consultant.plan', plan);
    const get = fakeBrowser.storage.sync.get;
    fakeBrowser.storage.sync.get = () => Promise.reject(new Error('Sync is switched off'));
    try {
      await expect(runMigration()).resolves.toBeUndefined();
    } finally {
      fakeBrowser.storage.sync.get = get;
    }
    expect(await storage.getItem('local:consultant.plan')).toEqual(plan);
    await vi.waitFor(async () => {
      const log = await errorLogItem.getValue();
      expect(log?.entries.map((entry) => entry.code)).toEqual(['PAINT-PLAN-MOVE-FAIL']);
    });
  });
});
