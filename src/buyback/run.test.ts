import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BUYBACK_PAGE_SIZE, SMART_UPDATE } from '@/config';
import { BUYBACK_SNAPSHOT_VERSION, type BuybackPledge } from './buyback';
import { buybackSnapshot } from './buyback-storage';
import { runBuybackSmartUpdate } from './run';
import type { FetchBuybackPage } from './sync-buyback';

beforeEach(() => fakeBrowser.reset());

const pledge = (id: number, contained = `Item ${id}`): BuybackPledge => ({
  id,
  title: `Pledge ${id}`,
  contained,
  isUpgrade: false,
});

/** 600 pledges, ids 1200 down to 2 (even ids): three full pages of 250. */
const LIST = Array.from({ length: 600 }, (_, index) => pledge(1200 - index * 2));
const SMALL = SMART_UPDATE.buybackCount.pageSize;

/** RSI's buy back list as `current`, in any page size; counts the requests by page size. */
function rsi(current: BuybackPledge[]) {
  const requests: Record<number, number> = {};
  const fetchPage: FetchBuybackPage = async (page, category, pageSize = BUYBACK_PAGE_SIZE) => {
    if (category) return { pledges: [], lastPage: 1 };
    requests[pageSize] = (requests[pageSize] ?? 0) + 1;
    const pledges = current.slice((page - 1) * pageSize, page * pageSize);
    return structuredClone({
      pledges,
      lastPage: Math.max(1, Math.ceil(current.length / pageSize)),
    });
  };
  return { fetchPage, requests };
}

const deps = { fetchDetails: async () => ({ items: ['Item'] }), fetchShipLinks: async () => ({}) };

async function store(pledges: BuybackPledge[]) {
  await buybackSnapshot.setValue({
    version: BUYBACK_SNAPSHOT_VERSION,
    syncedAt: '2026-11-01T00:00:00.000Z',
    pledges,
  });
}

describe('runBuybackSmartUpdate', () => {
  it('compares the number with small pages and loads one full page only', async () => {
    await store(LIST);
    const { fetchPage, requests } = rsi(LIST);
    const outcome = await runBuybackSmartUpdate({ ...deps, fetchPage });
    expect(outcome?.status).toBe('unchanged');
    // First and last small page; the spot check: one full page.
    expect(requests).toEqual({ [SMALL]: 2, [BUYBACK_PAGE_SIZE]: 1 });
  });

  it('finds a melted pledge anywhere with small pages', async () => {
    await store(LIST);
    const melted = pledge(701, 'Melted just now');
    const current = [...LIST, melted].sort((a, b) => b.id - a.id);
    const { fetchPage, requests } = rsi(current);
    const outcome = await runBuybackSmartUpdate({ ...deps, fetchPage });
    expect(outcome).toMatchObject({ status: 'updated', added: 1, removed: 0 });
    expect((await buybackSnapshot.getValue())?.pledges.map((p) => p.id)).toContain(701);
    // The binary search ran with small pages; still one full page only.
    expect(requests[BUYBACK_PAGE_SIZE]).toBe(1);
    expect(requests[SMALL]).toBeGreaterThan(2);
  });

  it('goes straight to the page of a pledge named by the pledge log', async () => {
    await store(LIST);
    const current = [...LIST, pledge(701)].sort((a, b) => b.id - a.id);
    const { fetchPage, requests } = rsi(current);
    const outcome = await runBuybackSmartUpdate({ ...deps, fetchPage, hintIds: [701] });
    expect(outcome).toMatchObject({ status: 'updated', added: 1 });
    // First, last and the page of the hint, plus the last page moved by the new pledge.
    expect(requests[SMALL]).toBeLessThanOrEqual(4);
  });

  it('finds a change within a pledge on the full spot check page', async () => {
    await store(LIST);
    // Page 2 of 250 is the spot check page; a pledge there changed without a new count.
    const current = LIST.map((entry) =>
      entry.id === LIST[300]!.id ? pledge(entry.id, 'Changed') : entry,
    );
    const { fetchPage } = rsi(current);
    const outcome = await runBuybackSmartUpdate({ ...deps, fetchPage });
    expect(outcome).toMatchObject({ status: 'updated', changed: 1 });
    const stored = (await buybackSnapshot.getValue())?.pledges.find(
      (entry) => entry.id === LIST[300]!.id,
    );
    expect(stored?.contained).toBe('Changed');
  });
});
