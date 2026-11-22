import { describe, expect, it } from 'vitest';
import { warbondEndLabel } from './warbond-end';

const END = Date.parse('2026-12-13T16:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('warbondEndLabel (#569)', () => {
  it('counts down to the expected end, with its date and that it is expected', () => {
    const label = warbondEndLabel(END, 'Galaxy', END - 21 * DAY - HOUR, 'en')!;
    expect(label.text).toBe('Expected gone in 21 days');
    expect(label.hint).toMatch(
      /^The warbond offer of the Galaxy is expected to leave the Pledge Store on /,
    );
    expect(label.hint).toContain('\nAn expectation, not confirmed by CIG.');
    expect(label.soon).toBe(false);
  });

  it('marks the last day, and counts the seconds in the last hour', () => {
    const lastDay = warbondEndLabel(END, 'Galaxy', END - 5 * HOUR - 12 * 60_000, 'en')!;
    expect(lastDay.text).toBe('Expected gone in 5 h 12 min');
    expect(lastDay.soon).toBe(true);
    expect(warbondEndLabel(END, 'Galaxy', END - 46 * 60_000 - 12_000, 'en')!.text).toBe(
      'Expected gone in 46:12',
    );
  });

  it('has none without an expected end, nor once it passed', () => {
    expect(warbondEndLabel(undefined, 'Galaxy', END - DAY, 'en')).toBeUndefined();
    expect(warbondEndLabel(END, 'Galaxy', END, 'en')).toBeUndefined();
    expect(warbondEndLabel(END, 'Galaxy', END + DAY, 'en')).toBeUndefined();
  });

  it('is in each language', () => {
    expect(warbondEndLabel(END, 'Galaxy', END - 2 * DAY - HOUR, 'de')!.text).toBe(
      'Voraussichtliches Ende: 2 Tage',
    );
  });
});
