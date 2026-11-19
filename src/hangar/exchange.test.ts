import { describe, expect, it, vi } from 'vitest';
import { exchangeWarnings, losesAllGameAccess, reclaimPledges } from './exchange';
import type { PledgeView } from './pledge-view';

const pledge = (overrides: Partial<PledgeView> = {}) =>
  ({
    id: 1,
    title: 'Test',
    ships: [],
    isCcu: false,
    isUpgraded: false,
    hasGameAccess: false,
    isPaint: false,
    isGiftable: false,
    isLastAlpha: false,
    isBuybackable: true,
    ...overrides,
  }) as PledgeView;

describe('exchangeWarnings', () => {
  it('has none for a plain pledge', () => {
    expect(exchangeWarnings(pledge(), '2026-11-03')).toEqual([]);
  });

  it('lists the losses, most severe first', () => {
    const discount = { original: 300, paid: 250, amount: 50, percent: 16.7, ships: [] };
    const warnings = exchangeWarnings(
      pledge({
        isLastAlpha: true,
        isBuybackable: false,
        isUpgraded: true,
        discount,
        isGiftable: true,
        order: { id: 'X', amount: '$250.00 USD', placedAt: '2026-10-30' } as PledgeView['order'],
      }),
      '2026-11-03',
    );
    expect(warnings.map((warning) => warning.kind)).toEqual([
      'lastGameAccess',
      'notBuybackable',
      'upgraded',
      'discount',
      'giftable',
      'refundable',
    ]);
    expect(warnings.filter((warning) => warning.danger)).toHaveLength(4);
  });

  it('ignores surcharges and refund periods that are over', () => {
    const surcharge = { original: 200, paid: 250, amount: -50, percent: -25, ships: [] };
    const old = { id: 'X', amount: '$1', placedAt: '2026-01-01' } as PledgeView['order'];
    expect(exchangeWarnings(pledge({ discount: surcharge, order: old }), '2026-11-03')).toEqual([]);
  });
});

describe('losesAllGameAccess', () => {
  const access = (id: number) => pledge({ id, hasGameAccess: true });
  const hangar = [access(1), access(2), pledge({ id: 3 })];

  it('is false while another pledge keeps the game access', () => {
    expect(losesAllGameAccess([hangar[0]!, hangar[2]!], hangar)).toBe(false);
  });

  it('is true when the selection holds every pledge with game access', () => {
    expect(losesAllGameAccess([hangar[0]!, hangar[1]!], hangar)).toBe(true);
  });

  it('is true for the pledge RSI marks as the last one with game access', () => {
    expect(losesAllGameAccess([pledge({ id: 4, isLastAlpha: true })], hangar)).toBe(true);
  });

  it('is false for an account without game access', () => {
    expect(losesAllGameAccess([pledge({ id: 3 })], [pledge({ id: 3 })])).toBe(false);
  });
});

describe('reclaimPledges', () => {
  const verify = vi.fn(async () => ({ status: 'match' as const, requests: 1 }));

  it('checks the same pledges first, in the same order, before sending any', async () => {
    const calls: string[] = [];
    const check = vi.fn(async (ids: readonly number[]) => {
      calls.push(`check ${ids.join(',')}`);
      return { status: 'match' as const, requests: 1 };
    });
    const reclaim = vi.fn(async (id: number) => {
      calls.push(`melt ${id}`);
    });
    await reclaimPledges([3, 1], 'secret', { reclaim, verify: check });
    expect(calls).toEqual(['check 3,1', 'melt 3', 'melt 1']);
  });

  it('sends nothing if a pledge changed or is gone', async () => {
    const reclaim = vi.fn(async () => {});
    const mismatches = [{ id: 2, stored: {} as never, changes: ['gone' as const] }];
    const result = await reclaimPledges([1, 2], 'secret', {
      reclaim,
      verify: async () => ({ status: 'mismatch', mismatches, requests: 1 }),
    });
    expect(result).toEqual({ exchanged: [], mismatches });
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('sends nothing if the pledges can not be read again', async () => {
    const reclaim = vi.fn(async () => {});
    const result = await reclaimPledges([1, 2], 'secret', {
      reclaim,
      verify: async () => {
        throw new Error('logged out');
      },
    });
    expect(result).toEqual({ exchanged: [], unchecked: 'logged out' });
    expect(reclaim).not.toHaveBeenCalled();
  });

  it('exchanges all pledges one after the other with the same password', async () => {
    const reclaim = vi.fn(async () => {});
    const onExchanged = vi.fn();
    const result = await reclaimPledges([1, 2, 3], 'secret', { reclaim, onExchanged, verify });
    expect(result).toEqual({ exchanged: [1, 2, 3] });
    expect(reclaim.mock.calls).toEqual([
      [1, 'secret'],
      [2, 'secret'],
      [3, 'secret'],
    ]);
    expect(onExchanged.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
  });

  it('stops at the first pledge RSI refuses', async () => {
    const reclaim = vi.fn(async (id: number) => {
      if (id === 2) throw new Error('Invalid password');
    });
    const result = await reclaimPledges([1, 2, 3], 'secret', { reclaim, verify });
    expect(result).toEqual({ exchanged: [1], failed: { id: 2, message: 'Invalid password' } });
    expect(reclaim).toHaveBeenCalledTimes(2);
  });

  it('waits between two requests', async () => {
    vi.useFakeTimers();
    try {
      const reclaim = vi.fn(async () => {});
      const running = reclaimPledges([1, 2], 'secret', { reclaim, verify, delayMs: 1000 });
      await vi.advanceTimersByTimeAsync(0);
      expect(reclaim).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      await running;
      expect(reclaim).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
