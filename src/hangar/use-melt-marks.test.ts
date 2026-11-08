import { describe, expect, it } from 'vitest';
import { readyToMelt } from './use-melt-marks';

const mark = (pledgeId: number, meltableAt: number) => ({ pledgeId, markedAt: 0, meltableAt });

describe('readyToMelt', () => {
  it('gives the marked pledges of the hangar that can be melted now', () => {
    const marks = new Map([
      [1, mark(1, 100)],
      [2, mark(2, 300)],
      // Gone from this device's hangar: not offered to filter or select.
      [3, mark(3, 100)],
    ]);
    expect([...readyToMelt(marks, new Set([1, 2]), 200)]).toEqual([1]);
    expect([...readyToMelt(marks, new Set([1, 2]), 300)]).toEqual([1, 2]);
  });
});
