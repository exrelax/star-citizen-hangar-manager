import { describe, expect, it } from 'vitest';
import { meltMarkBadge } from '@/hangar/group-badges';
import { groupItems, pledgeFacts } from '@/hangar/grouping';
import { meltableAt } from '@/hangar/melt-marks';
import type { MarkedPledge } from '@/hangar/use-melt-marks';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo, justBoughtOf } from './demo';
import { demoGroupMarks, purchaseTimeOf, withRecentPurchases } from './demo-group-marks';

/* The melt marks of groups in the demo (#554): each label of #552 in the demo hangar's groups. */

const NOW = Date.parse('2026-11-22T12:30:00Z');
const { pledges: base } = generatedDemo(FALLBACK_CATALOG, 'key-a', '2026-11-22', NOW);
const justBought = justBoughtOf(base);
const cases = demoGroupMarks(base, NOW, new Set(justBought === undefined ? [] : [justBought]));
const pledges = withRecentPurchases(base, cases.purchases);

/** The marks as the rows get them: by purchase time, else the purchase date. */
const marks = new Map<number, MarkedPledge>(
  cases.marked.map((id) => {
    const pledge = pledges.find((entry) => entry.id === id)!;
    const at = meltableAt({
      boughtAt: cases.purchases.get(id),
      boughtOn: pledge.createdAt,
      markedAt: NOW,
    });
    return [id, { pledgeId: id, markedAt: NOW, meltableAt: at }];
  }),
);
const labels = groupItems(pledges, pledgeFacts)
  .filter((group) => group.count > 1)
  .flatMap((group) => {
    const badge = meltMarkBadge(group.items, marks, NOW, 'en');
    return badge ? [`${badge.text} (${badge.count})`] : [];
  });

describe('melt marks of groups in the demo (#554)', () => {
  it('shows every label of a group', () => {
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Melt in \d+ hr – \d+ hr \(2\)$/),
        expect.stringMatching(/^Melt now – \d+ hr \(2\)$/),
        expect.stringMatching(/^Melt now \(\d+\)$/),
        'Melt now (1)',
      ]),
    );
  });

  it('dates the items bought recently, never the demo’s pledge bought a few hours ago', () => {
    expect(cases.purchases.size).toBe(3);
    expect(justBought === undefined || !cases.marked.includes(justBought)).toBe(true);
    for (const [id, at] of cases.purchases) {
      expect(pledges.find((pledge) => pledge.id === id)?.createdAt).toBe(at.slice(0, 10));
    }
  });

  it('writes a time as the pledge log does, on the full hour', () => {
    expect(purchaseTimeOf(new Date(2026, 10, 22, 9, 41).getTime())).toBe('2026-11-22T09:00');
  });
});
