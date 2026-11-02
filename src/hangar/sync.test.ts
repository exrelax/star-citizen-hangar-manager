import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { SYNC_WORK } from '@/config';
import { hangarSnapshot } from './hangar-storage';
import type { PledgePage } from './parse-pledges';
import { HANGAR_SNAPSHOT_VERSION, type Pledge, type PledgeCategory } from './pledge';
import { syncHangar, type FetchPledgePage } from './sync';
import { SyncProgressTracker, type SyncProgress } from './sync-progress';

const pledge = (id: number) => ({ id, name: `Pledge ${id}`, items: [] }) as unknown as Pledge;

const pages: Record<number, PledgePage> = {
  1: { pledges: [pledge(1), pledge(2)], lastPage: 3 },
  2: { pledges: [pledge(3), pledge(4)], lastPage: 3 },
  // Pledge 4 moved to the next page during the sync.
  3: { pledges: [pledge(4), pledge(5)], lastPage: 3 },
};

const categoryPages: Record<PledgeCategory, PledgePage[]> = {
  game_package: [{ pledges: [pledge(2)], lastPage: 1 }],
  standalone_ship: [
    { pledges: [pledge(3)], lastPage: 2 },
    { pledges: [pledge(5)], lastPage: 2 },
  ],
};

const fetchPage: FetchPledgePage = async (page, category) =>
  category ? categoryPages[category][page - 1]! : pages[page]!;

beforeEach(() => {
  fakeBrowser.reset();
});

describe('syncHangar', () => {
  it('stores all pledges of all pages once, in hangar order', async () => {
    const progress: SyncProgress[] = [];
    await syncHangar({
      fetchPage,
      fetchShipImages: async () => new Map(),
      fetchShipLinks: async () => ({}),
      progress: new SyncProgressTracker((value) => progress.push(value)),
    });

    const snapshot = await hangarSnapshot.getValue();
    expect(snapshot?.pledges.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(snapshot?.version).toBe(HANGAR_SNAPSHOT_VERSION);
    expect(snapshot?.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // 3 hangar pages + 1 game package page + 2 standalone ship pages, all known from the start.
    const pages = progress.map(({ done, total }) => `${done}/${total}`);
    expect([...new Set(pages)]).toEqual(['0/6', '3/6', '4/6', '5/6', '6/6']);
    // The first pages are weighted by their 4 pledges, the others as full pages of 10, plus the
    // final step (ship links, storing) – only that one completes the bar.
    const work = (entries: number) => SYNC_WORK.requestOverhead + entries;
    const firstWork = 3 * work(0) + 4;
    const total = firstWork + 3 * work(10) + SYNC_WORK.finish;
    // (Event 2: the final step is announced right after the pages.)
    expect(progress[2]!.fraction).toBeCloseTo(firstWork / total);
    expect(progress.at(-2)!.fraction).toBeCloseTo(1 - SYNC_WORK.finish / total);
    expect(progress.at(-1)!.fraction).toBe(1);
  });

  it('tags pledges with the RSI category they were listed in', async () => {
    await syncHangar({
      fetchPage,
      fetchShipImages: async () => new Map(),
      fetchShipLinks: async () => ({}),
    });

    const categories = (await hangarSnapshot.getValue())?.pledges.map((p) => p.category);
    expect(categories).toEqual([
      undefined,
      'game_package',
      'standalone_ship',
      undefined,
      'standalone_ship',
    ]);
  });

  it('stores the resolved ship links', async () => {
    const links = { Polaris: { fleetyards: 'rsi-polaris', erkul: 'rsi_polaris' } };
    await syncHangar({
      fetchPage,
      fetchShipImages: async () => new Map(),
      fetchShipLinks: async () => links,
    });
    expect((await hangarSnapshot.getValue())?.shipLinks).toEqual(links);
  });

  it('still stores the pledges when the ship matrix is unavailable', async () => {
    await syncHangar({
      fetchPage,
      fetchShipImages: async () => {
        throw new Error('offline');
      },
      fetchShipLinks: async () => {
        throw new Error('offline');
      },
    });
    expect((await hangarSnapshot.getValue())?.pledges).toHaveLength(5);
  });

  it('keeps the previous snapshot when a page fails', async () => {
    const previous = {
      version: HANGAR_SNAPSHOT_VERSION,
      syncedAt: '2026-01-01T00:00:00.000Z',
      pledges: [pledge(99)],
    };
    await hangarSnapshot.setValue(previous);

    const sync = syncHangar({
      fetchShipImages: async () => new Map(),
      fetchShipLinks: async () => ({}),
      fetchPage: async (page, category) => {
        if (page === 3 && !category) throw new Error('HTTP 429');
        return fetchPage(page, category);
      },
    });

    await expect(sync).rejects.toThrow('HTTP 429');
    expect(await hangarSnapshot.getValue()).toEqual(previous);
  });
});
