import { PLEDGE_STORE } from '@/config';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { settingsItem, withDefaults } from '@/settings/settings';
import { fetchUpgradeTool } from '@/ships/fetch-upgrade-tool';
import { maybeRefreshUpgradeTool, type RefreshResult } from '@/ships/sync-upgrade-tool';
import { RsiSignedOutError } from '@/shared/rsi-api';
import { fetchStoreItems } from './items/fetch-store-items';
import { maybeRefreshStoreItems } from './items/sync-store-items';

/*
 * The Pledge Store in the background (#163): while browser notifications are on (#152) and smart
 * updates too, the background script reads the warbond CCUs and the Pledge Store items on the
 * schedule of #162 (`refresh-schedule.ts`), also with no RSI tab open. An alarm looks every 30
 * seconds whether a read is due; the reads are the same as in the tabs, and a lease in the storage
 * keeps the tabs and the background from reading at the same time.
 */

export const PLEDGE_STORE_ALARM = 'shm-pledge-store';

/** Whether the background reads the Pledge Store: browser notifications and smart updates on. */
async function isOn(): Promise<boolean> {
  const [allowed, settings] = await Promise.all([
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
  ]);
  return allowed && withDefaults(settings).smartUpdates;
}

/** Sets or clears the alarm, as the settings say. */
export async function schedulePledgeStore(): Promise<void> {
  if (!(await isOn())) {
    await browser.alarms.clear(PLEDGE_STORE_ALARM);
    return;
  }
  if (await browser.alarms.get(PLEDGE_STORE_ALARM)) return;
  await browser.alarms.create(PLEDGE_STORE_ALARM, {
    delayInMinutes: PLEDGE_STORE.backgroundCheckMinutes,
    periodInMinutes: PLEDGE_STORE.backgroundCheckMinutes,
  });
}

/**
 * One look of the alarm: the upgrade tool, then the store items, each if due. Not signed in to
 * RSI, the items wait too: without a session RSI lists fewer of them, and they would look removed.
 */
export async function readPledgeStoreIfDue(): Promise<RefreshResult[]> {
  if (!(await isOn())) return [];
  const upgradeTool = await maybeRefreshUpgradeTool();
  if (upgradeTool === 'signedOut') return [upgradeTool];
  return [upgradeTool, await maybeRefreshStoreItems()];
}

/** Wires the alarm (call it in the background script). */
export function watchPledgeStore(): void {
  void schedulePledgeStore();
  browserNotificationsItem.watch(() => void schedulePledgeStore());
  settingsItem.watch(() => void schedulePledgeStore());
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PLEDGE_STORE_ALARM) void readPledgeStoreIfDue();
  });
}

/** Message of the Development settings: read the Pledge Store in the background now. */
export const READ_PLEDGE_STORE_IN_BACKGROUND = 'shm:read-pledge-store-in-background';

/** What a test read in the background found (development only; nothing is stored). */
export type BackgroundReadResult =
  | { status: 'read'; ships: number; warbonds: number; items: number; requests: number; ms: number }
  | { status: 'signedOut' | 'failed'; message: string };

/** Reads both from RSI right away, without storing them, to see that the background can. */
export async function testReadPledgeStore(): Promise<BackgroundReadResult> {
  const started = Date.now();
  try {
    const { ships, warbonds } = await fetchUpgradeTool();
    const { items, requests } = await fetchStoreItems();
    return {
      status: 'read',
      ships: ships.length,
      warbonds: warbonds.length,
      items: items.length,
      // The upgrade tool takes three requests: its session, its context and the query.
      requests: requests + 3,
      ms: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: error instanceof RsiSignedOutError ? 'signedOut' : 'failed', message };
  }
}
