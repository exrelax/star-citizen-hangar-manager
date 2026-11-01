import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hangarSnapshot } from './hangar-storage';
import type { PledgePage } from './parse-pledges';
import { HANGAR_SNAPSHOT_VERSION, type Pledge } from './pledge';
import { syncHangar } from './sync';

const pledge = (id: number) => ({ id, name: `Pledge ${id}`, items: [] }) as unknown as Pledge;

const pages: Record<number, PledgePage> = {
  1: { pledges: [pledge(1), pledge(2)], lastPage: 3 },
  2: { pledges: [pledge(3), pledge(4)], lastPage: 3 },
  // Pledge 4 moved to the next page during the sync.
  3: { pledges: [pledge(4), pledge(5)], lastPage: 3 },
};

beforeEach(() => {
  fakeBrowser.reset();
});

describe('syncHangar', () => {
  it('stores all pledges of all pages once, in hangar order', async () => {
    const progress: string[] = [];
    await syncHangar({
      fetchPage: async (page) => pages[page]!,
      fetchShipImages: async () => new Map(),
      onProgress: ({ done, total }) => progress.push(`${done}/${total}`),
    });

    const snapshot = await hangarSnapshot.getValue();
    expect(snapshot?.pledges.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(snapshot?.version).toBe(HANGAR_SNAPSHOT_VERSION);
    expect(snapshot?.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
  });

  it('still stores the pledges when the ship matrix is unavailable', async () => {
    await syncHangar({
      fetchPage: async (page) => pages[page]!,
      fetchShipImages: async () => {
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
      fetchPage: async (page) => {
        if (page === 3) throw new Error('HTTP 429');
        return pages[page]!;
      },
    });

    await expect(sync).rejects.toThrow('HTTP 429');
    expect(await hangarSnapshot.getValue()).toEqual(previous);
  });
});
