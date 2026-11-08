import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '@/settings/settings';
import { hangarMeta } from './hangar-storage';
import { maybeRunSmartUpdate, setCheckingElsewhere, syncState } from './sync-state';
import { announceCheck } from './smart-update/broadcast';
import { runSmartUpdate } from './smart-update/run';

// Everything that would talk to RSI.
vi.mock('./smart-update/run', () => ({ runSmartUpdate: vi.fn(async () => null) }));
// The other tabs.
vi.mock('./smart-update/broadcast', () => ({ announceCheck: vi.fn() }));
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
  vi.mocked(announceCheck).mockClear();
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

  it('shows and announces a real check, not a look that finds none due', async () => {
    await checkedMinutesAgo(2);
    await maybeRunSmartUpdate();
    expect(announceCheck).not.toHaveBeenCalled();

    await checkedMinutesAgo(6);
    let checkingDuringRun = false;
    vi.mocked(runSmartUpdate).mockImplementationOnce(async () => {
      checkingDuringRun = syncState.checking;
      return null;
    });
    await maybeRunSmartUpdate();
    expect(checkingDuringRun).toBe(true);
    expect(syncState.checking).toBe(false);
    expect(vi.mocked(announceCheck).mock.calls).toEqual([[true], [false]]);
  });
});

describe('setCheckingElsewhere', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    setCheckingElsewhere(false);
    vi.useRealTimers();
  });

  it('follows the checks of other tabs', () => {
    setCheckingElsewhere(true);
    expect(syncState.checkingElsewhere).toBe(true);
    setCheckingElsewhere(false);
    expect(syncState.checkingElsewhere).toBe(false);
  });

  it('ends on its own when the end never arrives', () => {
    setCheckingElsewhere(true);
    vi.advanceTimersByTime(2 * 60_000 - 1);
    expect(syncState.checkingElsewhere).toBe(true);
    vi.advanceTimersByTime(1);
    expect(syncState.checkingElsewhere).toBe(false);
  });
});
