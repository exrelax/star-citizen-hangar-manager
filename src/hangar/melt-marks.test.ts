import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { MELT_COOLDOWN_MS } from '@/config';
import {
  demoMeltMarksItem,
  formatTimeLeft,
  marksInHangar,
  meltableAt,
  meltMarksItem,
  MeltMarksQuotaError,
  selectionMarks,
  setMeltMarks,
  toggledMarks,
  toggleMeltMark,
} from './melt-marks';

/** The later of the UTC and the local reading of a time without a time zone. */
const latest = (...parts: [number, number, number, number, number]) =>
  Math.max(Date.UTC(...parts), new Date(...parts).getTime());

describe('meltableAt', () => {
  it('is 24 hours after the purchase time of the pledge log', () => {
    expect(meltableAt({ boughtAt: '2026-10-30T19:55', boughtOn: '2026-10-30', markedAt: 0 })).toBe(
      latest(2026, 9, 30, 19, 55) + MELT_COOLDOWN_MS,
    );
  });

  it('takes the end of the purchase day without a time', () => {
    expect(meltableAt({ boughtOn: '2026-10-30', markedAt: 0 })).toBe(
      latest(2026, 9, 30, 23, 59) + MELT_COOLDOWN_MS,
    );
  });

  it('takes the time of the mark without a purchase date', () => {
    expect(meltableAt({ markedAt: 1_000 })).toBe(1_000 + MELT_COOLDOWN_MS);
    expect(meltableAt({ boughtAt: 'soon', markedAt: 1_000 })).toBe(1_000 + MELT_COOLDOWN_MS);
  });

  it('never comes before either reading of the time', () => {
    const at = meltableAt({ boughtAt: '2026-10-30T19:55', markedAt: 0 }) - MELT_COOLDOWN_MS;
    expect(at).toBeGreaterThanOrEqual(Date.UTC(2026, 9, 30, 19, 55));
    expect(at).toBeGreaterThanOrEqual(new Date(2026, 9, 30, 19, 55).getTime());
  });
});

describe('toggledMarks', () => {
  it('marks a pledge with the time', () => {
    expect(toggledMarks({}, 7, 5)).toEqual({ 7: 5 });
  });

  it('unmarks a marked pledge and keeps the others', () => {
    expect(toggledMarks({ 7: 5, 8: 6 }, 7, 9)).toEqual({ 8: 6 });
  });
});

describe('marksInHangar', () => {
  const marks = { 7: 5, 8: 6, 9: 50 };

  it('drops the marks of pledges gone since they were marked', () => {
    expect(marksInHangar(marks, new Set([8]), 40)).toEqual({ 8: 6, 9: 50 });
  });

  it('keeps marks newer than the hangar: another device may know the pledge already', () => {
    expect(marksInHangar({ 9: 50 }, new Set(), 40)).toEqual({ 9: 50 });
  });

  it('keeps the same object when nothing is gone', () => {
    expect(marksInHangar(marks, new Set([7, 8, 9]), 40)).toBe(marks);
  });
});

describe('formatTimeLeft', () => {
  it('shows hours and minutes, rounded up', () => {
    expect(formatTimeLeft((5 * 60 + 12) * 60_000, 'en')).toBe('5 hr 12 min');
    expect(formatTimeLeft(2 * 60 * 60_000, 'en')).toBe('2 hr');
    expect(formatTimeLeft(11 * 60_000 + 1, 'en')).toBe('12 min');
    expect(formatTimeLeft(0, 'en')).toBe('< 1 min');
  });
});

describe('setMeltMarks (#274)', () => {
  beforeEach(() => fakeBrowser.reset());

  it('marks all the pledges, keeping the time of marks already set, and unmarks them', async () => {
    await meltMarksItem.setValue({ 1: 100, 9: 900 });
    await setMeltMarks([1, 2, 3], true);
    const marks = await meltMarksItem.getValue();
    expect(marks[1]).toBe(100);
    expect(Object.keys(marks).sort()).toEqual(['1', '2', '3', '9']);
    await setMeltMarks([1, 2, 3], false);
    expect(await meltMarksItem.getValue()).toEqual({ 9: 900 });
  });

  it('keeps the demo’s marks apart', async () => {
    await setMeltMarks([5], true, true);
    expect(Object.keys(await demoMeltMarksItem.getValue())).toEqual(['5']);
    expect(await meltMarksItem.getValue()).toEqual({});
  });
});

describe('the limit of the synced storage (#658)', () => {
  beforeEach(() => fakeBrowser.reset());
  const ids = (from: number, count: number) =>
    Array.from({ length: count }, (_, index) => 100_000_000 + from + index);

  it('marks nothing and says how many more fit when a selection is too large', async () => {
    await setMeltMarks(ids(0, 200), true);
    const error = await setMeltMarks(ids(200, 400), true).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MeltMarksQuotaError);
    const { room } = error as MeltMarksQuotaError;
    expect(room).toBeGreaterThan(50);
    expect(room).toBeLessThan(200);
    expect(Object.keys(await meltMarksItem.getValue())).toHaveLength(200);
    // As many as it says do fit.
    await setMeltMarks(ids(200, room!), true);
    expect(Object.keys(await meltMarksItem.getValue())).toHaveLength(200 + room!);
  });

  it('unmarks also when the marks are full', async () => {
    const full = Object.fromEntries(ids(0, 400).map((id) => [id, 1_764_000_000_000]));
    await meltMarksItem.setValue(full);
    await expect(toggleMeltMark(100_000_999)).rejects.toBeInstanceOf(MeltMarksQuotaError);
    await toggleMeltMark(100_000_000);
    await setMeltMarks(ids(1, 10), false);
    expect(Object.keys(await meltMarksItem.getValue())).toHaveLength(389);
  });

  it('turns the browser’s quota error into one of its own', async () => {
    const setItem = fakeBrowser.storage.sync.set;
    fakeBrowser.storage.sync.set = () => Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
    try {
      const error = await setMeltMarks([1], true).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(MeltMarksQuotaError);
      expect((error as MeltMarksQuotaError).room).toBeUndefined();
    } finally {
      fakeBrowser.storage.sync.set = setItem;
    }
  });

  it('keeps no limit for the demo’s own marks', async () => {
    await setMeltMarks(ids(0, 600), true, true);
    expect(Object.keys(await demoMeltMarksItem.getValue())).toHaveLength(600);
  });
});

describe('selectionMarks (#551)', () => {
  const pledge = (id: number, isMeltable = true) => ({ id, isMeltable });

  it('marks the meltable ones not marked yet and skips the others', () => {
    const plan = selectionMarks([pledge(1), pledge(2), pledge(3, false)], new Set([2]));
    expect(plan).toEqual({ toMark: [1], skipped: 2, unmark: [] });
  });

  it('unmarks them once all meltable ones are marked', () => {
    const plan = selectionMarks([pledge(1), pledge(2), pledge(3, false)], new Set([1, 2]));
    expect(plan).toEqual({ toMark: [], skipped: 3, unmark: [1, 2] });
  });

  it('offers nothing without a meltable pledge', () => {
    expect(selectionMarks([pledge(3, false)], new Set())).toBeUndefined();
  });
});
