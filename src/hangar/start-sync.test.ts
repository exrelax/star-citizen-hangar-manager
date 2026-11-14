import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { prepareBuybackSync } from '@/buyback/sync-buyback';
import { prepareOrderSync } from '@/orders/sync-orders';
import { buybackMeta } from '@/buyback/buyback-storage';
import { hangarMeta } from './hangar-storage';
import { prepareHangarSync } from './sync';
import { startSync, syncState } from './sync-state';

// Everything that would talk to RSI or the website.
vi.mock('./sync', () => ({ prepareHangarSync: vi.fn() }));
vi.mock('@/buyback/sync-buyback', () => ({ prepareBuybackSync: vi.fn() }));
vi.mock('@/orders/sync-orders', () => ({ prepareOrderSync: vi.fn(), updateOrders: vi.fn() }));
vi.mock('@/account/sync-store-credit', () => ({ refreshStoreCredit: vi.fn(async () => {}) }));
vi.mock('@/ships/sync-upgrade-tool', () => ({
  refreshUpgradeTool: vi.fn(async () => {}),
  maybeRefreshUpgradeTool: vi.fn(async () => {}),
}));
vi.mock('@/store/items/sync-store-items', () => ({
  refreshStoreItems: vi.fn(async () => {}),
  maybeRefreshStoreItems: vi.fn(async () => {}),
}));
vi.mock('@/ships/ship-status', () => ({ maybeRefreshShipStatus: vi.fn(async () => {}) }));
vi.mock('@/ships/sync-ship-facts', () => ({ maybeRefreshShipFacts: vi.fn(async () => {}) }));

const hangarRun = vi.fn(async () => ({ pledges: [] }));
const buybackRun = vi.fn(async () => ({ pledges: [] }));
const ordersRun = vi.fn(async () => ({ snapshot: { orders: {} } }));

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  for (const run of [hangarRun, buybackRun, ordersRun]) run.mockClear();
  vi.mocked(prepareHangarSync).mockResolvedValue(hangarRun as never);
  vi.mocked(prepareBuybackSync).mockResolvedValue(buybackRun as never);
  vi.mocked(prepareOrderSync).mockResolvedValue(ordersRun as never);
});

describe('startSync (#334)', () => {
  it('reads hangar and orders when the buy back fails, and says what failed', async () => {
    buybackRun.mockRejectedValueOnce(new Error('Loading buy back pledge 1 failed: HTTP 404'));
    await startSync();

    expect(hangarRun).toHaveBeenCalledOnce();
    expect(ordersRun).toHaveBeenCalledOnce();
    expect((await hangarMeta.getValue()).syncedAt).toBeTruthy();
    expect((await buybackMeta.getValue()).syncedAt).toBeFalsy();
    expect(syncState.error).toMatchObject({
      storage: 'buyback',
      message: 'Loading buy back pledge 1 failed: HTTP 404',
    });
    expect(syncState.running).toBe(false);
  });

  it('reads hangar and orders when the buy back fails on its first page', async () => {
    vi.mocked(prepareBuybackSync).mockRejectedValueOnce(new Error('HTTP 502'));
    await startSync();

    expect(hangarRun).toHaveBeenCalledOnce();
    expect(ordersRun).toHaveBeenCalledOnce();
    expect(syncState.error?.storage).toBe('buyback');
  });

  it('clears the error once a sync succeeds', async () => {
    buybackRun.mockRejectedValueOnce(new Error('HTTP 500'));
    await startSync();
    expect(syncState.error).not.toBeNull();

    await startSync();
    expect(syncState.error).toBeNull();
    expect((await buybackMeta.getValue()).syncedAt).toBeTruthy();
  });
});
