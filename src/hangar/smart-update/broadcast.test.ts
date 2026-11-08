import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { isCheckingMessage, listenForChecksElsewhere, relayToOtherTabs } from './broadcast';

const message = { type: 'shm:smart-update-checking', checking: true } as const;

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('isCheckingMessage', () => {
  it('accepts only the check message', () => {
    expect(isCheckingMessage(message)).toBe(true);
    expect(isCheckingMessage({ ...message, checking: 'yes' })).toBe(false);
    expect(isCheckingMessage({ type: 'other', checking: true })).toBe(false);
    expect(isCheckingMessage('shm:open-styleguide')).toBe(false);
    expect(isCheckingMessage(null)).toBe(false);
  });
});

describe('relayToOtherTabs', () => {
  it('passes the message on to every RSI tab but the sender', async () => {
    const query = vi
      .spyOn(fakeBrowser.tabs, 'query')
      .mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as never);
    const send = vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockResolvedValue(undefined);

    await relayToOtherTabs(message, 2);

    expect(query).toHaveBeenCalledWith({ url: 'https://robertsspaceindustries.com/*' });
    expect(send.mock.calls).toEqual([
      [1, message],
      [3, message],
    ]);
  });

  it('skips tabs that have no listener', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
    const send = vi
      .spyOn(fakeBrowser.tabs, 'sendMessage')
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValue(undefined);

    await expect(relayToOtherTabs(message, undefined)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('listenForChecksElsewhere', () => {
  it('reports checks of other tabs until it stops listening', async () => {
    const onChange = vi.fn();
    const stop = listenForChecksElsewhere(onChange);

    await fakeBrowser.runtime.onMessage.trigger(message, {}, () => {});
    await fakeBrowser.runtime.onMessage.trigger({ ...message, checking: false }, {}, () => {});
    await fakeBrowser.runtime.onMessage.trigger('something else', {}, () => {});
    expect(onChange.mock.calls).toEqual([[true], [false]]);

    stop();
    await fakeBrowser.runtime.onMessage.trigger(message, {}, () => {});
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
