import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { ExpectedPriceIncrease } from './price-increases';
import { priceIncreasesItem, priceIncreasesMeta } from './price-increases-storage';
import { maybeRefreshPriceIncreases } from './sync-price-increases';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const galaxy: ExpectedPriceIncrease = {
  ship: { id: 244, name: 'Galaxy' },
  priceIncreaseAt: { at: Date.parse('2026-11-13T16:00:00Z') },
};

beforeEach(() => fakeBrowser.reset());

describe('maybeRefreshPriceIncreases', () => {
  it('stores the file and reads it again after a day', async () => {
    const fetch = vi.fn(async () => [galaxy]);
    await maybeRefreshPriceIncreases({ fetch, now: () => NOW });
    await maybeRefreshPriceIncreases({ fetch, now: () => NOW + HOUR });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await priceIncreasesItem.getValue()).toEqual({ version: 1, priceIncreases: [galaxy] });

    await maybeRefreshPriceIncreases({ fetch, now: () => NOW + 25 * HOUR });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the stored ones while offline or with a file of another format', async () => {
    await maybeRefreshPriceIncreases({ fetch: async () => [galaxy], now: () => NOW });
    await maybeRefreshPriceIncreases({
      force: true,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      now: () => NOW + HOUR,
    });
    await maybeRefreshPriceIncreases({
      force: true,
      fetch: async () => undefined,
      now: () => NOW + 2 * HOUR,
    });
    expect((await priceIncreasesItem.getValue())?.priceIncreases).toEqual([galaxy]);
    expect((await priceIncreasesMeta.getValue()).lastOutcome?.status).toBe('failed');
  });

  it('tries a missing file again after an hour, not on every check', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('HTTP 404')));
    await maybeRefreshPriceIncreases({ fetch, now: () => NOW });
    await maybeRefreshPriceIncreases({ fetch, now: () => NOW + 30_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await maybeRefreshPriceIncreases({ fetch, now: () => NOW + HOUR });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reads stored data of an earlier format again at once', async () => {
    await maybeRefreshPriceIncreases({ fetch: async () => [galaxy], now: () => NOW });
    await priceIncreasesItem.setValue({ version: 0, priceIncreases: [] });
    const fetch = vi.fn(async () => [galaxy]);
    await maybeRefreshPriceIncreases({ fetch, now: () => NOW + 60_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await priceIncreasesItem.getValue()).toEqual({ version: 1, priceIncreases: [galaxy] });
  });
});
