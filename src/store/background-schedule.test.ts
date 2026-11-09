import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { settingsItem } from '@/settings/settings';
import * as upgradeTool from '@/ships/sync-upgrade-tool';
import * as storeItems from './items/sync-store-items';
import {
  PLEDGE_STORE_ALARM,
  readPledgeStoreIfDue,
  schedulePledgeStore,
} from './background-schedule';

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('schedulePledgeStore', () => {
  it('sets the alarm only while browser notifications and smart updates are on', async () => {
    await schedulePledgeStore();
    expect(await browser.alarms.get(PLEDGE_STORE_ALARM)).toBeUndefined();

    await browserNotificationsItem.setValue(true);
    await schedulePledgeStore();
    expect((await browser.alarms.get(PLEDGE_STORE_ALARM))?.periodInMinutes).toBe(0.5);

    await settingsItem.setValue({ smartUpdates: false });
    await schedulePledgeStore();
    expect(await browser.alarms.get(PLEDGE_STORE_ALARM)).toBeUndefined();
  });
});

describe('readPledgeStoreIfDue', () => {
  it('reads the upgrade tool, then the store items', async () => {
    await browserNotificationsItem.setValue(true);
    vi.spyOn(upgradeTool, 'maybeRefreshUpgradeTool').mockResolvedValue('read');
    const items = vi.spyOn(storeItems, 'maybeRefreshStoreItems').mockResolvedValue('skipped');
    expect(await readPledgeStoreIfDue()).toEqual(['read', 'skipped']);
    expect(items).toHaveBeenCalledOnce();
  });

  it('leaves the store items alone while nobody is signed in to RSI', async () => {
    await browserNotificationsItem.setValue(true);
    vi.spyOn(upgradeTool, 'maybeRefreshUpgradeTool').mockResolvedValue('signedOut');
    const items = vi.spyOn(storeItems, 'maybeRefreshStoreItems');
    expect(await readPledgeStoreIfDue()).toEqual(['signedOut']);
    expect(items).not.toHaveBeenCalled();
  });

  it('reads nothing while it is off', async () => {
    const tool = vi.spyOn(upgradeTool, 'maybeRefreshUpgradeTool');
    expect(await readPledgeStoreIfDue()).toEqual([]);
    expect(tool).not.toHaveBeenCalled();
  });
});
