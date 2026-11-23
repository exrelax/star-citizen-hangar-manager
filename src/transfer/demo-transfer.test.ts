import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BuybackView } from '@/buyback/buyback-view';
import { demoMeltMarksItem, meltMarksItem } from '@/hangar/melt-marks';
import type { PledgeView } from '@/hangar/pledge-view';
import { loadWatchlists } from '@/watchlists/watchlists-storage';
import type { Watchlist } from '@/watchlists/watchlists';
import {
  currentDemoValues,
  demoHangarData,
  demoImports,
  loadDemoSettingsData,
  notImportedInDemo,
  writeDemoImport,
} from './demo-transfer';
import { buildHangarExport } from './hangar-export';
import { hangarImportOf } from './hangar-import';
import { ImportQuotaError } from './settings-import';

/* Export & Import in the demo mode (#233): never the real account. */

beforeEach(() => fakeBrowser.reset());

const REAL_ID = 112_233_445;

const view = (extra: Partial<PledgeView> = {}) =>
  ({
    id: REAL_ID,
    displayId: '4711',
    title: 'Cutlass Black',
    value: '$115.00 USD',
    valueUsd: 115,
    createdAt: '2026-03-14',
    isLastAlpha: false,
    isBuybackable: true,
    isGiftable: false,
    isMeltable: true,
    isUpgraded: false,
    protectedGames: [],
    items: [{ title: 'Cutlass Black', kind: 'Ship' }],
    order: { id: 'REALORDER', amount: '$115.00 USD', buyback: false },
    ...extra,
  }) as unknown as PledgeView;
const melted = {
  id: REAL_ID + 1,
  title: 'Paint',
  contained: '',
  items: [],
  isCcu: false,
} as unknown as BuybackView;

const list = (id: string): Watchlist => ({
  id,
  name: id,
  description: '',
  reminder: false,
  storeAlerts: false,
  items: [],
  createdAt: 1,
  changedAt: 1,
});

describe('demoHangarData', () => {
  it('holds the demo’s lists numbered from 1, no orders, its store credit', () => {
    const data = demoHangarData(
      { hangar: [view(), view()], buyback: [melted] },
      { amount: 500, currency: 'USD' },
    );
    expect(data.hangar?.pledges.map((pledge) => pledge.id)).toEqual([1, 2]);
    expect(data.buyback?.pledges.map((pledge) => pledge.id)).toEqual([1]);
    expect(data.orders).toBeNull();
    expect(data.giftFlags).toBeNull();
    expect(data.storeCredit?.credit.amount).toBe(500);
    const file = JSON.stringify(buildHangarExport(data, {}, new Date(), '1'));
    expect(file).not.toContain(String(REAL_ID));
    expect(file).not.toContain('REALORDER');
  });

  it('can’t restore a hangar', () => {
    const data = demoHangarData({ hangar: [view()], buyback: [] }, { amount: 1, currency: 'USD' });
    const file = { ...buildHangarExport(data, {}, new Date(), '1'), demo: true };
    expect(
      hangarImportOf(file, {
        hangar: null,
        buyback: null,
        orders: null,
        storeCredit: null,
        giftFlags: null,
      }),
    ).toEqual({
      ok: false,
      refusal: 'demo',
    });
  });
});

describe('the demo’s own data', () => {
  it('is what the demo exports', async () => {
    await meltMarksItem.setValue({ 1: 1 });
    await demoMeltMarksItem.setValue({ 2: 2 });
    const values = await loadDemoSettingsData(['yourData']);
    expect(values.meltMarks).toEqual({ 2: 2 });
  });

  it('takes the import, never the synced storage', async () => {
    await meltMarksItem.setValue({ 1: 1 });
    await writeDemoImport({ meltMarks: { 3: 3 }, watchlists: [list('demo')], settings: {} }, false);
    expect(await demoMeltMarksItem.getValue()).toEqual({ 3: 3 });
    expect((await loadWatchlists(true)).map((entry) => entry.id)).toEqual(['demo']);
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({ 'hangar.meltMarks': { 1: 1 } });
    expect(await currentDemoValues(['meltMarks'])).toEqual({ meltMarks: { 3: 3 } });
  });

  it('reaches the synced storage’s limit with “Synced storage almost full”', async () => {
    const lists = Array.from({ length: 30 }, (_, index) => ({
      ...list(`list-${index}`),
      description: 'x'.repeat(1500),
    }));
    await expect(writeDemoImport({ watchlists: lists }, true)).rejects.toBeInstanceOf(
      ImportQuotaError,
    );
    expect(await loadWatchlists(true)).toEqual([]);
    await writeDemoImport({ watchlists: lists.slice(0, 2) }, true);
    expect(await loadWatchlists(true)).toHaveLength(2);
  });

  it('leaves out what it has no copy of', () => {
    expect(demoImports('watchlists')).toBe(true);
    expect(
      notImportedInDemo(['settings', 'warbondHistory', 'meltMarks', 'browserHintDismissed']),
    ).toEqual(['settings', 'warbondHistory', 'browserHintDismissed']);
  });
});
