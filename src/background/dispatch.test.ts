import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { isHangarTab, managerUrl, openHangarManager } from './dispatch';

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('managerUrl', () => {
  it('carries the action into a tab opened for it', () => {
    expect(managerUrl('open')).toBe(
      'https://robertsspaceindustries.com/en/account/pledges#hangar-manager',
    );
    expect(managerUrl('selectMeltReady')).toBe(
      'https://robertsspaceindustries.com/en/account/pledges?shm-action=selectMeltReady#hangar-manager',
    );
  });
});

describe('isHangarTab', () => {
  it("knows RSI's My Hangar, with or without the manager", () => {
    expect(
      isHangarTab('https://robertsspaceindustries.com/en/account/pledges#hangar-manager'),
    ).toBe(true);
    expect(isHangarTab('https://robertsspaceindustries.com/account/pledges?page=2')).toBe(true);
    expect(isHangarTab('https://robertsspaceindustries.com/en/account/buy-back-pledges')).toBe(
      false,
    );
    expect(isHangarTab(undefined)).toBe(false);
  });
});

describe('openHangarManager', () => {
  const tab = (id: number, url: string, lastAccessed = id) =>
    ({ id, url, lastAccessed, windowId: 1 }) as Browser.tabs.Tab;

  function stubTabs(tabs: Browser.tabs.Tab[], taken: boolean | Error = true) {
    vi.spyOn(browser.tabs, 'query').mockResolvedValue(tabs as never);
    const update = vi.spyOn(browser.tabs, 'update').mockResolvedValue(tabs[0] as never);
    const create = vi.spyOn(browser.tabs, 'create').mockResolvedValue(tab(9, '') as never);
    const send = vi
      .spyOn(browser.tabs, 'sendMessage')
      .mockImplementation(async () => (taken instanceof Error ? Promise.reject(taken) : taken));
    vi.spyOn(browser.windows, 'update').mockResolvedValue({} as never);
    return { update, create, send };
  }

  it('sends the action to an open My Hangar tab and focuses it', async () => {
    const { update, create, send } = stubTabs([
      tab(1, 'https://robertsspaceindustries.com/en/store/pledge'),
      tab(2, 'https://robertsspaceindustries.com/en/account/pledges'),
    ]);
    await openHangarManager('showMeltReady');
    expect(send).toHaveBeenCalledWith(2, { type: 'shm:manager-action', action: 'showMeltReady' });
    expect(update).toHaveBeenCalledWith(2, { active: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('loads the manager anew where the tab has no content script', async () => {
    const { update } = stubTabs(
      [tab(2, 'https://robertsspaceindustries.com/en/account/pledges')],
      new Error('no receiver'),
    );
    await openHangarManager('selectMeltReady');
    expect(update).toHaveBeenCalledWith(2, { url: managerUrl('selectMeltReady') });
  });

  it('uses another RSI tab, or opens a new one', async () => {
    const other = stubTabs([tab(1, 'https://robertsspaceindustries.com/en/store/pledge')]);
    await openHangarManager();
    expect(other.update).toHaveBeenCalledWith(1, { url: managerUrl('open') });

    vi.restoreAllMocks();
    const none = stubTabs([]);
    await openHangarManager();
    expect(none.create).toHaveBeenCalledWith({ url: managerUrl('open') });
  });
});
