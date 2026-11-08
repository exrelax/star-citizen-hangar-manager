import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { parseStoreCredit } from './store-credit';
import { storeCreditItem, storeCreditMeta, STORE_CREDIT_VERSION } from './store-credit-storage';
import { refreshStoreCredit } from './sync-store-credit';

describe('parseStoreCredit', () => {
  it('reads the amount of the credit ledger in its currency (RSI counts in cents)', () => {
    expect(
      parseStoreCredit({
        data: { customer: { ledger: { amount: { value: 23396, currency: { code: 'USD' } } } } },
      }),
    ).toEqual({ amount: 233.96, currency: 'USD' });
  });

  it('fails on errors and on answers without an amount', () => {
    expect(() => parseStoreCredit({ errors: [{ message: 'denied' }] })).toThrow('denied');
    expect(() => parseStoreCredit({ data: { customer: null } })).toThrow('no amount');
  });
});

describe('refreshStoreCredit', () => {
  beforeEach(() => fakeBrowser.reset());

  it('stores the credit and does not rewrite an unchanged one', async () => {
    const fetchCredit = vi.fn(async () => ({ amount: 233.96, currency: 'USD' }));
    await refreshStoreCredit({ fetchCredit, now: () => 1000 });
    expect(await storeCreditItem.getValue()).toEqual({
      version: STORE_CREDIT_VERSION,
      credit: { amount: 233.96, currency: 'USD' },
    });

    const setValue = vi.spyOn(storeCreditItem, 'setValue');
    await refreshStoreCredit({ fetchCredit, now: () => 2000 });
    expect(setValue).not.toHaveBeenCalled();
    expect(await storeCreditMeta.getValue()).toMatchObject({ syncedAt: 2000, updatedAt: 1000 });
  });

  it('keeps the stored credit on a failure and records it', async () => {
    await refreshStoreCredit({ fetchCredit: async () => ({ amount: 10, currency: 'USD' }) });
    await refreshStoreCredit({ fetchCredit: async () => Promise.reject(new Error('offline')) });
    expect((await storeCreditItem.getValue())?.credit.amount).toBe(10);
    expect((await storeCreditMeta.getValue()).lastOutcome?.status).toBe('failed');
  });
});
