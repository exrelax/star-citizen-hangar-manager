// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuybackPledge } from './buyback';
import { addBuybackToCart, CartError } from './cart';

const ok = { success: 1, code: 'OK', msg: 'OK', data: null };
const upgrade = { fromShipId: 268, toShipId: 5, toSkuId: 12991 };

/** Answers RSI's API by path; records the requests. */
function mockRsi(answers: Record<string, unknown>) {
  const fetchMock = vi.fn<typeof fetch>(async (path) => Response.json(answers[String(path)] ?? ok));
  vi.stubGlobal('fetch', fetchMock);
  const requests = () =>
    fetchMock.mock.calls.map(([path, init]) => ({
      path,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      token: (init?.headers as Record<string, string>)['X-Rsi-Token'],
    }));
  return requests;
}

beforeEach(() => {
  document.cookie = 'Rsi-Token=abc123def456';
});
afterEach(() => vi.unstubAllGlobals());

describe('addBuybackToCart', () => {
  it('buys back a regular pledge with RSI token', async () => {
    const requests = mockRsi({});
    await addBuybackToCart({ id: 112666145, position: 3, isCcu: false });
    expect(requests()).toEqual([
      { path: '/api/store/buyBackPledge', body: { id: 112666145 }, token: 'abc123def456' },
    ]);
  });

  it('throws RSI’s reason', async () => {
    mockRsi({ '/api/store/buyBackPledge': { success: 0, msg: 'Not available' } });
    await expect(addBuybackToCart({ id: 1, position: 0, isCcu: false })).rejects.toThrow(
      new CartError('Not available'),
    );
  });

  it('puts a CCU into the cart via the upgrade API', async () => {
    const requests = mockRsi({
      '/pledge-store/api/upgrade/graphql': [{ data: { addToCart: { jwt: 'cart-jwt' } } }],
    });
    await addBuybackToCart({ id: 112662739, position: 0, isCcu: true, upgrade });
    expect(requests().map(({ path, body }) => [path, body])).toEqual([
      ['/api/account/v2/setAuthToken', undefined],
      ['/api/ship-upgrades/setContextToken', { ...upgrade, pledgeId: 112662739 }],
      [
        '/pledge-store/api/upgrade/graphql',
        [expect.objectContaining({ variables: { from: 268, to: 12991 } })],
      ],
      ['/api/store/v2/cart/token', { jwt: 'cart-jwt' }],
    ]);
  });

  it('loads the CCU ids of older snapshots from the single-pledge list page', async () => {
    mockRsi({ '/pledge-store/api/upgrade/graphql': [{ data: { addToCart: { jwt: 'jwt' } } }] });
    const ccu = { id: 7, title: 'Upgrade', contained: '', isUpgrade: true } as BuybackPledge;
    const fetchPage = vi.fn(async () => ({ pledges: [{ ...ccu, upgrade }], lastPage: 9 }));

    await addBuybackToCart({ id: 7, position: 4, isCcu: true }, fetchPage);
    expect(fetchPage).toHaveBeenCalledWith(5, undefined, 1);

    fetchPage.mockResolvedValueOnce({ pledges: [{ ...ccu, id: 8, upgrade }], lastPage: 9 });
    await expect(addBuybackToCart({ id: 7, position: 4, isCcu: true }, fetchPage)).rejects.toThrow(
      expect.objectContaining({ reason: 'notFound' }),
    );
  });
});
