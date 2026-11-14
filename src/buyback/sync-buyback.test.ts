import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { PledgeCategory } from '@/hangar/pledge';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackPledge } from './buyback';
import { SyncProgressTracker } from '@/hangar/sync-progress';
import { buybackSnapshot } from './buyback-storage';
import { runBuybackSmartUpdate } from './run';
import { buybackMeta } from './buyback-storage';
import { errorLogItem } from '@/errors/error-log';
import { loadBuybackDetails, syncBuyback, type FetchBuybackPage } from './sync-buyback';

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
    const fetchDetails = vi.fn(async (id: number) => ({
      items: [`Ship ${id}`, 'Lifetime Insurance'],
      price: id,
    }));
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
      pledges: [
        { ...pledge(30, 'Fury and 2 items'), items: ['Fury', 'Lifetime Insurance'], price: 70 },
      ],
    });
    const fetchDetails = vi.fn(async (id: number) => ({ items: [`Item ${id}`] }));
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}) });

    expect(fetchDetails.mock.calls.map(([id]) => id)).toEqual([10]);
    const fury = (await buybackSnapshot.getValue())?.pledges.find((p) => p.id === 30);
    expect(fury).toMatchObject({ items: ['Fury', 'Lifetime Insurance'], price: 70 });
  });

  it('reads the price of pledges stored before prices were, once', async () => {
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: [{ ...pledge(30, 'Fury and 2 items'), items: ['Fury', 'Lifetime Insurance'] }],
    });
    const fetchDetails = vi.fn(async (id: number) => ({ items: [`Item ${id}`] }));
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}) });
    expect(fetchDetails.mock.calls.map(([id]) => id).sort()).toEqual([10, 30]);
    // A page without a price is remembered as such and not read again.
    const stored = await buybackSnapshot.getValue();
    expect(stored?.pledges.find((p) => p.id === 30)?.price).toBeNull();
    fetchDetails.mockClear();
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}) });
    expect(fetchDetails).not.toHaveBeenCalled();
  });

  it('keeps a pledge whose detail page fails as the list shows it, and reads it again (#334)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchDetails = vi.fn(async (id: number) => {
      if (id === 30) throw new Error(`Loading buy back pledge ${id} failed: HTTP 404`);
      return { items: [`Item ${id}`], price: 5 };
    });
    const progress = new SyncProgressTracker();
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}), progress });

    const stored = await buybackSnapshot.getValue();
    expect(stored?.pledges.map((p) => [p.id, p.items, p.detailsFailed])).toEqual([
      [30, undefined, true],
      [20, undefined, undefined],
      [10, ['Item 10'], undefined],
    ]);
    // The failed page still counts as done, so the progress ends.
    expect(progress.progress?.fraction).toBe(1);

    // The next sync reads it again; once it works, the flag goes.
    fetchDetails.mockClear();
    fetchDetails.mockImplementation(async (id: number) => ({ items: [`Item ${id}`], price: 5 }));
    await syncBuyback({ fetchPage, fetchDetails, fetchShipLinks: async () => ({}) });
    expect(fetchDetails.mock.calls.map(([id]) => id)).toEqual([30]);
    const fury = (await buybackSnapshot.getValue())?.pledges.find((p) => p.id === 30);
    expect(fury).toMatchObject({ items: ['Item 30'], price: 5 });
    expect(fury?.detailsFailed).toBeUndefined();
  });
});

describe('buy back tokens', () => {
  const withTokens =
    (tokens: number): FetchBuybackPage =>
    async (page, category) => ({
      ...(await fetchPage(page, category)),
      ...(page === 1 && !category && { tokens }),
    });
  const deps = {
    fetchDetails: async () => ({ items: ['Item'] }),
    fetchShipLinks: async () => ({}),
  };

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
    expect((await buybackMeta.getValue()).lastOutcome?.status).toBe(outcome?.status);
  });
});

describe('loadBuybackDetails', () => {
  it('reads the price of one pledge once and keeps it', async () => {
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: [pledge(30, 'Avenger - Skullcrusher Paint'), pledge(20)],
    });
    const fetchDetails = vi.fn(async () => ({ items: [], price: 10 }));
    await Promise.all([loadBuybackDetails(30, fetchDetails), loadBuybackDetails(30, fetchDetails)]);
    expect(fetchDetails).toHaveBeenCalledOnce();
    const stored = await buybackSnapshot.getValue();
    expect(stored?.pledges.map((p) => p.price)).toEqual([10, undefined]);
  });

  it('remembers a page without a price', async () => {
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: [pledge(30)],
    });
    await loadBuybackDetails(30, async () => ({ items: [] }));
    expect((await buybackSnapshot.getValue())?.pledges[0]?.price).toBeNull();
  });

  it('reads the items of a pledge whose page failed during the sync (#334)', async () => {
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: [{ ...pledge(30, 'Fury and 2 items'), detailsFailed: true }],
    });
    await loadBuybackDetails(30, async () => ({ items: ['Lifetime Insurance'], price: 70 }));
    const [fury] = (await buybackSnapshot.getValue())?.pledges ?? [];
    expect(fury).toMatchObject({ items: ['Lifetime Insurance'], price: 70 });
    expect(fury?.detailsFailed).toBeUndefined();
  });

  it('keeps the flag when the page fails again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: [{ ...pledge(30, 'Fury and 2 items'), detailsFailed: true }],
    });
    await loadBuybackDetails(30, async () => Promise.reject(new Error('HTTP 404')));
    expect((await buybackSnapshot.getValue())?.pledges[0]?.detailsFailed).toBe(true);
  });
});

describe('a skipped pledge in the error log (#339, #342)', () => {
  it('names the pages that failed before, their URLs and the pledges the last read had there', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const total = 300;
    const titled = (id: number): BuybackPledge => ({ ...pledge(id), title: `Pledge ${id}` });
    // The last read had every pledge; RSI now fails to show the one at position 7.
    await buybackSnapshot.setValue({
      version: BUYBACK_SNAPSHOT_VERSION,
      syncedAt: '2026-10-01T00:00:00.000Z',
      pledges: Array.from({ length: total }, (_, index) => titled(total - index)),
    });
    const fetchPage: FetchBuybackPage = async (page, category, size = 250) => {
      if (category) return { pledges: [], lastPage: 1 };
      const from = (page - 1) * size;
      if (from <= 7 && 7 < from + size) {
        const error = new Error(`Loading buy back page ${page} failed: HTTP 500`);
        throw Object.assign(error, {
          status: 500,
          url: `https://rsi.test/bb?page=${page}&pagesize=${size}`,
        });
      }
      const to = Math.min(from + size, total);
      return {
        pledges: Array.from({ length: Math.max(0, to - from) }, (_, index) =>
          titled(total - from - index),
        ),
        lastPage: Math.ceil(total / size),
      };
    };
    await syncBuyback({
      fetchPage,
      fetchDetails: async () => ({ items: [] }),
      fetchShipLinks: async () => ({}),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = await buybackSnapshot.getValue();
    expect(stored?.unread).toBe(1);
    const [entry] = (await errorLogItem.getValue())?.entries ?? [];
    expect(entry?.code).toBe('BB-PAGE-SKIP');
    expect(entry?.message).toContain('position 8, page of 1 pledge: HTTP 500');
    expect(entry?.message).toContain('"Pledge 293"');
    expect(entry?.message).toContain('after "Pledge 294", before "Pledge 292"');
    expect(entry?.url).toBe('https://rsi.test/bb?page=8&pagesize=1');
    expect(entry?.subErrors?.map((sub) => sub.url)).toEqual([
      'https://rsi.test/bb?page=1&pagesize=250',
      'https://rsi.test/bb?page=1&pagesize=50',
      'https://rsi.test/bb?page=1&pagesize=10',
    ]);
  });
});
