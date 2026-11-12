import { describe, expect, it } from 'vitest';
import { confirmationNote, priceIncreaseLabel } from './price-increase-label';
import type { CcuPriceChange } from './ccu-price-change';
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

  it('tells a price increase confirmed by CIG as confirmed (#275)', () => {
    const confirmed = match({ confirmed: true, price: { from: 400, to: 450 } });
    const hint = priceIncreaseLabel(confirmed, 'buyback', AT - 3 * DAY, 'en')!.hint;
    expect(hint).toContain('The price of Galaxy rises on');
    expect(hint).toContain('The price of Galaxy goes from $400 to $450.');
    expect(hint).toContain('This price increase is confirmed by CIG.');
    expect(hint).not.toContain('expected');
  });
});

describe('priceIncreaseLabel with the change (#251)', () => {
  const prospector: ExpectedPriceIncrease = {
    ship: { id: 109, name: 'Prospector' },
    priceIncreaseAt: { at: AT },
    price: { from: 155, to: 175 },
  };
  const NOW = AT - 9 * DAY;
  const label = (
    m: PriceIncreaseMatch | undefined,
    place: 'buyback' | 'hangar',
    ccu?: CcuPriceChange,
    locale: 'en' | 'de' = 'en',
  ) => priceIncreaseLabel(m, place, NOW, locale, ccu)!;

  it('tells a ship’s price change in the badge and the prices in the tooltip', () => {
    const ship = label({ increase: prospector, reason: 'ship' }, 'hangar');
    expect(ship.text).toBe('Price +$20: 9 days');
    expect(ship.tone).toBe('info');
    expect(ship.hint).toContain('The price of Prospector is expected to go from $155 to $175.');
    expect(label({ increase: prospector, reason: 'ship' }, 'buyback').tone).toBe('warning');
  });

  it('warns of a CCU losing upgrade value, also in My Hangar', () => {
    const loses: CcuPriceChange = {
      base: prospector,
      direction: 'loses',
      amounts: { before: 20, after: 0, change: -20, discountBefore: 15, discountAfter: -5 },
    };
    const hangar = label(undefined, 'hangar', loses);
    expect(hangar.text).toBe('Upgrade value −$20: 9 days');
    expect(hangar.tone).toBe('warning');
    expect(hangar.hint).toContain('This CCU loses upgrade value when the price of Prospector');
    expect(hangar.hint).toContain('Upgrade value: $20 now, $0 after.');
    expect(hangar.hint).toContain('Discount: $15 now, -$5 after.');
    expect(hangar.hint).toContain('can still be applied');
    expect(label(undefined, 'hangar', loses, 'de').text).toBe('Upgrade-Wert −20\u00a0$: 9 Tage');
    // Without the new price: the direction only.
    // In the buy back: RSI can't sell it back once its value is gone (#207).
    const buyback = label(undefined, 'buyback', loses).hint;
    expect(buyback).toContain('From then on RSI can’t sell it back');
    expect(buyback).not.toContain('can still be applied');
    const unknown = label(undefined, 'buyback', { base: prospector, direction: 'loses' });
    expect(unknown.text).toBe('Upgrade value drops: 9 days');
    expect(unknown.hint).not.toContain('Upgrade value:');
  });

  it('informs of a CCU gaining upgrade value', () => {
    const gains: CcuPriceChange = {
      target: prospector,
      direction: 'gains',
      amounts: { before: 20, after: 40, change: 20 },
    };
    const hangar = label({ increase: prospector, reason: 'ccu' }, 'hangar', gains);
    expect(hangar.text).toBe('Upgrade value +$20: 9 days');
    expect(hangar.tone).toBe('info');
    expect(hangar.hint).not.toContain('can still be applied');
    // Without amounts the countdown as before.
    expect(label(undefined, 'hangar', { target: prospector, direction: 'gains' }).text).toBe(
      'Price increase: 9 days',
    );
  });
});

describe('confirmationNote (#275)', () => {
  it('says nothing while all are confirmed, else whether some or none are', () => {
    expect(confirmationNote([{ confirmed: true }, { confirmed: true }])).toBeUndefined();
    expect(confirmationNote([{ confirmed: true }, {}])).toBe('priceIncrease.partlyConfirmed');
    expect(confirmationNote([{}, {}])).toBe('priceIncrease.expected');
  });
});
