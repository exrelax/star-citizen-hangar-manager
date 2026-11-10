import { describe, expect, it } from 'vitest';
import { ORDERS_SNAPSHOT_VERSION, type Order, type OrdersSnapshot } from '@/orders/orders';
import { createGiftableCheck, giftableIdLimit } from './probably-giftable';

const order = (id: string, amount: string, creditsUsed?: string, placedAt?: string): Order => ({
  id,
  amount,
  ...(creditsUsed && { creditsUsed }),
  ...(placedAt && { placedAt }),
});

const orders: OrdersSnapshot = {
  version: ORDERS_SNAPSHOT_VERSION,
  syncedAt: '2026-11-10T00:00:00Z',
  recentLogEntries: [],
  creditsRead: true,
  orders: Object.fromEntries(
    [
      order('MONEY', '$5.95 USD', '$0.00 USD'),
      order('CREDIT', '$0.00 USD', '$5.00 USD'),
      order('MIXED', '$2.00 USD', '$3.00 USD'),
      order('PLACED', '$5.95 USD', '$0.00 USD', '2026-09-01'),
      order('UNDATED', '$5.95 USD', '$0.00 USD'),
    ].map((o) => [o.id, o]),
  ),
  pledgeOrders: {
    1: { orderId: 'MONEY', buyback: false, createdAt: '2026-10-29T19:55' },
    2: { orderId: 'MONEY', buyback: false, createdAt: '2026-10-29T19:55' },
    3: { orderId: 'MONEY', buyback: false, createdAt: '2026-10-30T08:00' },
    4: { orderId: 'CREDIT', buyback: false, createdAt: '2026-09-01T10:00' },
    5: { orderId: 'MIXED', buyback: false, createdAt: '2026-09-01T10:00' },
    6: { orderId: 'MONEY', buyback: true, createdAt: '2026-08-01T10:00' },
    7: { orderId: 'PLACED', buyback: false },
    500: { orderId: 'UNDATED', buyback: false },
    700: { orderId: 'UNDATED', buyback: false },
  },
};

const giftable = createGiftableCheck({
  orders,
  hangarPledges: [{ id: 600, createdAt: '2026-10-01' }],
  giftFlags: { 4: true, 1: false },
  cutoff: '2026-10-30',
});

describe('createGiftableCheck', () => {
  it('marks pledges bought with money only before the cutoff, all of one order alike', () => {
    expect(giftable(2)).toBe(true);
    expect(giftable(3)).toBe(false);
  });

  it('counts a buy back paid with money before the cutoff', () => {
    expect(giftable(6)).toBe(true);
  });

  it('marks nothing bought with any store credit', () => {
    expect(giftable(5)).toBe(false);
  });

  it('takes the order date, then the id limit, when the log has no time', () => {
    expect(giftable(7)).toBe(true);
    expect(giftable(500)).toBe(true);
    expect(giftable(700)).toBe(false);
  });

  it('marks nothing without a known order', () => {
    expect(giftable(99)).toBe(false);
    expect(createGiftableCheck({})(2)).toBe(false);
  });

  it('follows the gift flag kept when the pledge left the hangar', () => {
    expect(giftable(1)).toBe(false);
    expect(giftable(4)).toBe(true);
  });
});

describe('giftableIdLimit', () => {
  it('takes the highest id created before the cutoff', () => {
    expect(
      giftableIdLimit(
        [
          { id: 900, createdAt: '2026-10-30' },
          { id: 800, createdAt: '2026-10-22' },
          { id: 700, createdAt: '2026-09-01' },
          { id: 650 },
        ],
        '2026-10-30',
      ),
    ).toBe(800);
    expect(giftableIdLimit([], '2026-10-30')).toBeUndefined();
  });
});
