import { describe, expect, it } from 'vitest';
import type { Rebuy } from './rebuyable';
import { isRebuyable, rebuySummary } from './rebuy-summary';

const entry = (pledgeId: number, rebuyable: boolean, freedCredit: number, rebuyPrice?: number) =>
  [
    pledgeId,
    {
      pledgeId,
      rebuyable,
      reasons: rebuyable ? [] : [{ code: 'giftable' }],
      freedCredit,
      ...(rebuyPrice !== undefined && { rebuyPrice }),
    },
  ] as [number, Rebuy];

const rebuys = new Map([
  entry(1, true, 10.1, 10.1),
  entry(2, true, 45.2, 40),
  entry(3, false, 100, 120),
  entry(4, true, 5),
]);

describe('the List Shortcut "Melt and rebuy" (#530)', () => {
  it('lists only the rebuyable pledges', () => {
    expect([1, 2, 3, 4, 5].filter((id) => isRebuyable(rebuys, id))).toEqual([1, 2, 4]);
    expect(isRebuyable(new Map(), 1)).toBe(false);
  });
});

describe('rebuySummary (#530)', () => {
  it('counts the rebuyable ones of the given pledges, with what they free and cost', () => {
    expect(rebuySummary(rebuys, [1, 2, 3, 5])).toEqual({
      count: 2,
      freedCredit: 55.3,
      rebuyPrice: 50.1,
    });
  });

  it('counts a rebuy price not known as nothing', () => {
    expect(rebuySummary(rebuys, [4])).toEqual({ count: 1, freedCredit: 5, rebuyPrice: 0 });
  });

  it('is empty without rebuyable pledges, e.g. an empty selection', () => {
    expect(rebuySummary(rebuys, [])).toEqual({ count: 0, freedCredit: 0, rebuyPrice: 0 });
    expect(rebuySummary(rebuys, [3])).toEqual({ count: 0, freedCredit: 0, rebuyPrice: 0 });
  });
});
