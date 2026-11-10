import { describe, expect, it } from 'vitest';
import { priceIncreaseLabel } from './price-increase-label';
import type { PriceIncreaseMatch } from './price-increase-match';
import type { ExpectedPriceIncrease } from './price-increases';

const AT = Date.parse('2026-11-13T16:00:00Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const match = (increase: Partial<ExpectedPriceIncrease> = {}): PriceIncreaseMatch => ({
  increase: { ship: { id: 244, name: 'Galaxy' }, priceIncreaseAt: { at: AT }, ...increase },
  reason: 'ship',
});
const text = (m: PriceIncreaseMatch, now: number, locale: 'en' | 'de' = 'en') =>
  priceIncreaseLabel(m, 'buyback', now, locale)?.text;

describe('priceIncreaseLabel', () => {
  it('counts the days, on the last day hours and minutes', () => {
    expect(text(match(), AT - 3 * DAY - 5 * HOUR)).toBe('Price increase: 3 days');
    expect(text(match(), AT - DAY)).toBe('Price increase: 1 day');
    expect(text(match(), AT - 5 * HOUR - 20 * MINUTE)).toBe('Price increase: 5 h 20 min');
    expect(text(match(), AT - 2 * DAY, 'de')).toBe('Preiserhöhung: 2 Tage');
  });

  it('leaves out zero minutes', () => {
    expect(text(match(), AT - 3 * HOUR)).toBe('Price increase: 3 h');
    expect(text(match(), AT - 3 * HOUR - 30_000, 'de')).toBe('Preiserhöhung: 3 Std.');
    expect(text(match(), AT - 3 * HOUR + 1000)).toBe('Price increase: 2 h 59 min');
  });

  it('counts the last hour down in minutes and seconds', () => {
    expect(text(match(), AT - HOUR)).toBe('Price increase: 1 h');
    expect(text(match(), AT - HOUR + 1000)).toBe('Price increase: 59:59');
    expect(text(match(), AT - 46 * MINUTE - 12_000)).toBe('Price increase: 46:12');
    expect(text(match(), AT - 46 * MINUTE - 11_500)).toBe('Price increase: 46:11');
    expect(text(match(), AT - 9_000, 'de')).toBe('Preiserhöhung: 00:09');
  });

  it('shows only the day without a probable time, "today" on it', () => {
    const day = match({ priceIncreaseAt: { at: Date.parse('2026-11-16'), dayOnly: true } });
    expect(text(day, Date.parse('2026-11-10T12:00:00Z'))).toBe('Price increase: Nov 16');
    expect(text(day, Date.parse('2026-11-16T22:00:00Z'))).toBe('Price increase: today');
    expect(text(day, Date.parse('2026-11-17T00:00:00Z'))).toBeUndefined();
  });

  it('goes away once the price increase is reached', () => {
    expect(text(match(), AT)).toBeUndefined();
  });

  it('is more prominent on the last day', () => {
    expect(priceIncreaseLabel(match(), 'buyback', AT - 2 * DAY, 'en')?.soon).toBe(false);
    expect(priceIncreaseLabel(match(), 'buyback', AT - HOUR, 'en')?.soon).toBe(true);
  });

  it('tells the dates as expected, with the flight ready date while ahead and the note', () => {
    const full = match({
      flightReadyAt: { at: Date.parse('2026-11-12'), dayOnly: true },
      note: { en: 'Announced for the IAE.', de: 'Für die IAE angekündigt.' },
    });
    const early = priceIncreaseLabel(full, 'buyback', AT - 3 * DAY, 'en')!.hint;
    expect(early).toContain('The price of Galaxy is expected to rise on');
    expect(early).toContain('Buy it back or use it as a discount token before then.');
    expect(early).toContain('Expected to become flight ready on Nov 12, 2026.');
    expect(early).toContain('Announced for the IAE.');
    expect(early).toContain('These dates are expected, not confirmed by RSI.');
    // Flight ready already: only the price increase.
    const later = priceIncreaseLabel(full, 'hangar', AT - HOUR, 'de')!.hint;
    expect(later).not.toContain('flugbereit');
    expect(later).toContain('Wer das Item vorher schmilzt');
    expect(later).toContain('Für die IAE angekündigt.');
  });
});
