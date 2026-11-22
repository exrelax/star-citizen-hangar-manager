import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  demoMeltMarksItem,
  meltableAt,
  meltMarksItem,
  selectionMarks,
  setMeltMarks,
} from '@/hangar/melt-marks';
import { FALLBACK_CATALOG } from './catalog';
import { demoPurchaseTime, generatedDemo, justBoughtOf } from './demo';

/*
 * Marking the selection to melt in the demo (#553, for #551): the demo hangar has what each case
 * needs, and the marks are the demo's own.
 */

const NOW = Date.parse('2026-11-22T12:00:00Z');
const { pledges } = generatedDemo(FALLBACK_CATALOG, 'key-a', '2026-11-22', NOW);

describe('marking the selection in the demo (#553)', () => {
  const justBought = justBoughtOf(pledges);
  const meltable = pledges.filter((pledge) => pledge.isMeltable && pledge.id !== justBought);
  const notMeltable = pledges.find((pledge) => !pledge.isMeltable)!;

  it('has pledges to mark, one bought a few hours ago and one that can’t be melted', () => {
    expect(justBought).toBeDefined();
    expect(meltable.length).toBeGreaterThan(2);
    expect(notMeltable).toBeDefined();
  });

  it('marks some, skips the one not meltable and the one marked already, then unmarks', () => {
    const selection = [meltable[0]!, meltable[1]!, meltable[2]!, notMeltable];
    const plan = selectionMarks(selection, new Set([meltable[2]!.id]));
    expect(plan).toEqual({
      toMark: [meltable[0]!.id, meltable[1]!.id],
      skipped: 2,
      unmark: [],
    });
    const all = selectionMarks(selection, new Set(meltable.slice(0, 3).map((p) => p.id)));
    expect(all?.unmark).toHaveLength(3);
  });

  it('shows "Melt in …" for the pledge bought a few hours ago, "Melt now" for the others', () => {
    expect(meltableAt({ boughtAt: demoPurchaseTime(), markedAt: Date.now() })).toBeGreaterThan(
      Date.now(),
    );
    const older = meltable[0]!;
    expect(meltableAt({ boughtOn: older.createdAt, markedAt: NOW })).toBeLessThanOrEqual(NOW);
  });

  it('keeps its marks apart from the account’s', async () => {
    fakeBrowser.reset();
    await setMeltMarks([meltable[0]!.id], true, true);
    expect(Object.keys(await demoMeltMarksItem.getValue())).toEqual([String(meltable[0]!.id)]);
    expect(await meltMarksItem.getValue()).toEqual({});
  });
});
