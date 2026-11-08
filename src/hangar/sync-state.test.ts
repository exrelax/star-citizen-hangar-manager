import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '@/settings/settings';
import { hangarMeta } from './hangar-storage';
import { maybeRunSmartUpdate } from './sync-state';
import { runSmartUpdate } from './smart-update/run';

// Everything that would talk to RSI.
vi.mock('./smart-update/run', () => ({ runSmartUpdate: vi.fn(async () => null) }));
vi.mock('@/buyback/run', () => ({ runBuybackSmartUpdate: vi.fn(async () => null) }));
vi.mock('@/orders/sync-orders', () => ({ updateOrders: vi.fn(async () => null) }));
vi.mock('@/account/sync-store-credit', () => ({ refreshStoreCredit: vi.fn(async () => {}) }));
vi.mock('@/ships/sync-upgrade-tool', () => ({ maybeRefreshUpgradeTool: vi.fn(async () => {}) }));
vi.mock('@/store/items/sync-store-items', () => ({
  maybeRefreshStoreItems: vi.fn(async () => {}),
}));

const minute = 60_000;
/** The hangar's last check, `minutes` ago. */
async function checkedMinutesAgo(minutes: number) {
  const meta = await hangarMeta.getValue();
  await hangarMeta.setValue({ ...meta, checkedAt: Date.now() - minutes * minute });
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.mocked(runSmartUpdate).mockClear();
  await settingsItem.setValue({ smartUpdates: true, smartUpdateMinutes: 5 });
});

describe('maybeRunSmartUpdate', () => {
  it('checks once the interval has passed', async () => {
    await checkedMinutesAgo(6);
    await maybeRunSmartUpdate();
    expect(runSmartUpdate).toHaveBeenCalledTimes(1);
  });

  it("doesn't check within the interval, unless forced", async () => {
    await checkedMinutesAgo(2);
    await maybeRunSmartUpdate();
    expect(runSmartUpdate).not.toHaveBeenCalled();

    await maybeRunSmartUpdate({ force: true });
    expect(runSmartUpdate).toHaveBeenCalledTimes(1);
  });

  it("doesn't check with smart updates off", async () => {
    await settingsItem.setValue({ smartUpdates: false });
    await checkedMinutesAgo(60);
    await maybeRunSmartUpdate();
    expect(runSmartUpdate).not.toHaveBeenCalled();
  });

  it("doesn't start a second check while one is running", async () => {
    await checkedMinutesAgo(6);
    let finish = () => {};
    vi.mocked(runSmartUpdate).mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve(null))),
    );
    const first = maybeRunSmartUpdate();
    await vi.waitFor(() => expect(runSmartUpdate).toHaveBeenCalledTimes(1));
    // The timer, the tab shown again, …: all while the first check runs.
    await maybeRunSmartUpdate();
    await maybeRunSmartUpdate({ force: true });
    finish();
    await first;
    expect(runSmartUpdate).toHaveBeenCalledTimes(1);
  });
});
