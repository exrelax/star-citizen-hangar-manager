import { describe, expect, it } from 'vitest';
import { MELT_COOLDOWN_MS } from '@/config';
import { formatTimeLeft, marksInHangar, meltableAt, toggledMarks } from './melt-marks';

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
  const pledge = { id: 7, title: 'Paint' };

  it('marks a pledge with the time and its title', () => {
    expect(toggledMarks({}, pledge, 5)).toEqual({ 7: { markedAt: 5, title: 'Paint' } });
  });

  it('unmarks a marked pledge and keeps the others', () => {
    const marks = { 7: { markedAt: 5, title: 'Paint' }, 8: { markedAt: 6, title: 'Ship' } };
    expect(toggledMarks(marks, pledge, 9)).toEqual({ 8: { markedAt: 6, title: 'Ship' } });
  });
});

describe('marksInHangar', () => {
  const marks = { 7: { markedAt: 5, title: 'Paint' }, 8: { markedAt: 6, title: 'Ship' } };

  it('drops the marks of pledges gone from the hangar', () => {
    expect(marksInHangar(marks, new Set([8, 9]))).toEqual({ 8: { markedAt: 6, title: 'Ship' } });
  });

  it('keeps the same object when nothing is gone', () => {
    expect(marksInHangar(marks, new Set([7, 8]))).toBe(marks);
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
