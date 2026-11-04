import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PledgeCategory } from '@/hangar/pledge';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackPledge } from './buyback';
import { SyncProgressTracker } from '@/hangar/sync-progress';
import { buybackSnapshot } from './buyback-storage';
import { runBuybackSmartUpdate } from './run';
import { buybackCheckState } from './buyback-storage';
import { syncBuyback, type FetchBuybackPage } from './sync-buyback';

const pledge = (id: number, contained = `Item ${id}`): BuybackPledge => ({
  id,
  title: `Pledge ${id}`,
  contained,
  isUpgrade: false,
});

const pages = [[pledge(30, 'Fury and 2 items'), pledge(20)], [pledge(10, 'Aurora and 3 items')]];
const categories: Partial<Record<PledgeCategory, BuybackPledge[]>> = {
  standalone_ship: [pledge(30, 'Fury and 2 items')],
};

// Every request returns fresh objects, like parsing a real page does.
const fetchPage: FetchBuybackPage = async (page, category) =>
  structuredClone({
    pledges: category ? (page === 1 ? (categories[category] ?? []) : []) : pages[page - 1]!,
    lastPage: category ? 1 : pages.length,
  });

beforeEach(() => fakeBrowser.reset());

describe('syncBuyback', () => {
  it('stores all pledges with category and the items of pledges with several items', async () => {
    const fetchDetails = vi.fn(async (id: number) => [`Ship ${id}`, 'Lifetime Insurance']);
    const progress = new SyncProgressTracker();
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}), progress });

    const snapshot = await buybackSnapshot.getValue();
    expect(snapshot?.version).toBe(BUYBACK_SNAPSHOT_VERSION);
    expect(snapshot?.pledges.map((p) => [p.id, p.category, p.items?.length])).toEqual([
      [30, 'standalone_ship', 2],
      [20, undefined, undefined],
      [10, undefined, 2],
    ]);
    expect(fetchDetails.mock.calls.map(([id]) => id).sort()).toEqual([10, 30]);
    // 2 pages of the full list + 1 page per category list, then the 2 detail pages.
    expect(progress.progress).toEqual({ done: 2 + 2 + 2, total: 6, fraction: 1 });
  });

  it('reuses detail items known from the previous sync', async () => {
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: [{ ...pledge(30, 'Fury and 2 items'), items: ['Fury', 'Lifetime Insurance'] }],
    });
    const fetchDetails = vi.fn(async (id: number) => [`Item ${id}`]);
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}) });

    expect(fetchDetails.mock.calls.map(([id]) => id)).toEqual([10]);
    const fury = (await buybackSnapshot.getValue())?.pledges.find((p) => p.id === 30);
    expect(fury?.items).toEqual(['Fury', 'Lifetime Insurance']);
  });
});

describe('buy back tokens', () => {
  const withTokens =
    (tokens: number): FetchBuybackPage =>
    async (page, category) => ({
      ...(await fetchPage(page, category)),
      ...(page === 1 && !category && { tokens }),
    });
  const deps = { fetchDetails: async () => ['Item'], fetchShipLinks: async () => ({}) };

  it('stores the tokens of the first page on a full sync', async () => {
    await syncBuyback({ ...deps, fetchPage: withTokens(2) });
    expect((await buybackSnapshot.getValue())?.tokens).toBe(2);
  });

  it('updates them on a smart update that changes no pledges', async () => {
    await syncBuyback({ ...deps, fetchPage: withTokens(2) });
    const before = await buybackSnapshot.getValue();
    const outcome = await runBuybackSmartUpdate({ ...deps, fetchPage: withTokens(1) });

    // The short test pages count as a changed list; the tokens are taken over anyway.
    expect(outcome?.status).not.toBe('updated');
    const after = await buybackSnapshot.getValue();
    expect(after?.tokens).toBe(1);
    expect(after?.pledges).toEqual(before?.pledges);
    expect((await buybackCheckState.getValue()).lastOutcome?.status).toBe(outcome?.status);
  });
});
