import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PledgeView } from '@/hangar/pledge-view';
import { reclaimPledges } from '@/hangar/exchange';
import { DEMO_UNREADABLE, demoMeltRun, MELT_CHECK_OUTCOMES } from './demo-melt-check';

const pledges = [
  { id: 11, title: 'Paint A' },
  { id: 12, title: 'Paint B' },
] as PledgeView[];
const timing = { checkMs: 0, exchangeMs: 0 };

afterEach(() => vi.unstubAllGlobals());

describe('demoMeltRun (#416)', () => {
  it('turns out as the demo settings say, for the first pledge', async () => {
    const changes = async (outcome: (typeof MELT_CHECK_OUTCOMES)[number]) => {
      const result = await demoMeltRun(outcome, pledges, timing).verify();
      return result.status === 'mismatch' ? result.mismatches.map((m) => [m.id, m.changes]) : [];
    };
    expect(await changes('match')).toEqual([]);
    expect(await changes('changed')).toEqual([[11, ['value', 'items']]]);
    expect(await changes('gone')).toEqual([[11, ['gone']]]);
    expect(await changes('notMeltable')).toEqual([[11, ['notMeltable']]]);
    await expect(demoMeltRun('unreadable', pledges, timing).verify()).rejects.toThrow(
      DEMO_UNREADABLE,
    );
  });

  it('plays every outcome of a whole run without a single request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const outcome of MELT_CHECK_OUTCOMES) {
      const exchanged: number[] = [];
      const result = await reclaimPledges([11, 12], '', {
        ...demoMeltRun(outcome, pledges, timing),
        onExchanged: (id) => exchanged.push(id),
      });
      expect(result.exchanged).toEqual(outcome === 'match' ? [11, 12] : []);
      expect(exchanged).toEqual(result.exchanged);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
