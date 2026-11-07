import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { UPGRADE_TOOL } from '@/config';
import { settingsItem } from '@/settings/settings';
import type { UpgradeToolData } from './ships';
import {
  buyableShipsItem,
  shipsItem,
  shipsMeta,
  SHIPS_VERSION,
  warbondsItem,
  warbondsMeta,
} from './ships-storage';
import {
  isUpgradeToolDue,
  maybeRefreshUpgradeTool,
  refreshUpgradeTool,
  upgradeToolState,
} from './sync-upgrade-tool';

const DATA: UpgradeToolData = {
  ships: [{ id: 1, name: 'Mercury', msrp: 260 }],
  buyable: [{ shipId: 1, skuId: 10, title: 'Warbond Edition', price: 240 }],
  warbonds: [{ shipId: 1, skuId: 10, price: 240 }],
};
const MINUTE = 60_000;
const START = Date.parse('2026-11-07T12:00:00Z');

beforeEach(() => fakeBrowser.reset());

describe('refreshUpgradeTool', () => {
  it('fills the three storages with one read and reads again only when due', async () => {
    const fetchData = vi.fn(async () => DATA);
    let now = START;
    await refreshUpgradeTool({ fetchData, now: () => now });
    const version = SHIPS_VERSION;
    expect(await shipsItem.getValue()).toEqual({ version, ships: DATA.ships });
    expect(await buyableShipsItem.getValue()).toEqual({ version, skus: DATA.buyable });
    expect(await warbondsItem.getValue()).toEqual({ version, warbonds: DATA.warbonds });
    expect(await warbondsMeta.getValue()).toMatchObject({ syncedAt: START, checkedAt: START });

    now += 3 * MINUTE;
    await refreshUpgradeTool({ fetchData, maxAgeMs: 5 * MINUTE, now: () => now });
    expect(fetchData).toHaveBeenCalledTimes(1);
    // A refresh (no maximum age) reads in any case.
    await refreshUpgradeTool({ fetchData, now: () => now });
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('is due as soon as one of the storages is missing or of another format', async () => {
    await refreshUpgradeTool({ fetchData: async () => DATA, now: () => START });
    expect(await isUpgradeToolDue(5 * MINUTE, START)).toBe(false);
    await buyableShipsItem.removeValue();
    expect(await isUpgradeToolDue(5 * MINUTE, START)).toBe(true);
  });

  it('keeps the stored data on a failure and reports it', async () => {
    await refreshUpgradeTool({ fetchData: async () => DATA, now: () => START });
    await refreshUpgradeTool({ fetchData: async () => Promise.reject(new Error('offline')) });
    expect((await shipsItem.getValue())?.ships).toEqual(DATA.ships);
    expect(upgradeToolState.error).toBe('offline');

    await refreshUpgradeTool({ fetchData: async () => DATA });
    expect(upgradeToolState.error).toBeUndefined();
  });

  it('rewrites only parts whose answer changed', async () => {
    await refreshUpgradeTool({ fetchData: async () => DATA, now: () => START });
    const later = START + 10 * MINUTE;
    const changed = { ...DATA, warbonds: [] };
    await refreshUpgradeTool({ fetchData: async () => changed, now: () => later });
    expect(await shipsMeta.getValue()).toMatchObject({
      syncedAt: START,
      updatedAt: START,
      checkedAt: later,
      lastOutcome: { status: 'unchanged' },
    });
    expect(await warbondsMeta.getValue()).toMatchObject({ updatedAt: later, checkedAt: later });
    expect((await warbondsItem.getValue())?.warbonds).toEqual([]);
  });

  it('reads only once for calls during a read', async () => {
    const fetchData = vi.fn(async () => DATA);
    await Promise.all([refreshUpgradeTool({ fetchData }), refreshUpgradeTool({ fetchData })]);
    expect(fetchData).toHaveBeenCalledTimes(1);
  });
});

describe('maybeRefreshUpgradeTool', () => {
  it('follows the interval of the settings', async () => {
    const fetchData = vi.fn(async () => DATA);
    await settingsItem.setValue({ storeRefreshMinutes: 10 });
    await maybeRefreshUpgradeTool({ fetchData, now: () => START });
    await maybeRefreshUpgradeTool({ fetchData, now: () => START + 9 * MINUTE });
    expect(fetchData).toHaveBeenCalledTimes(1);
    await maybeRefreshUpgradeTool({ fetchData, now: () => START + 10 * MINUTE });
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('with smart updates off, reads once a day', async () => {
    const fetchData = vi.fn(async () => DATA);
    await settingsItem.setValue({ smartUpdates: false });
    await maybeRefreshUpgradeTool({ fetchData, now: () => START });
    await maybeRefreshUpgradeTool({ fetchData, now: () => START + 60 * MINUTE });
    expect(fetchData).toHaveBeenCalledTimes(1);
    const day = UPGRADE_TOOL.maxAgeWithoutSmartUpdatesMs;
    await maybeRefreshUpgradeTool({ fetchData, now: () => START + day });
    expect(fetchData).toHaveBeenCalledTimes(2);
  });
});
