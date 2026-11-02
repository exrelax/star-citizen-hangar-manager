import { describe, expect, it } from 'vitest';
import { formatDiscount } from './discount-format';

describe('formatDiscount', () => {
  const ships = [
    { name: 'Guardian QI', price: 260 },
    { name: 'Constellation Mk V Centaurus', price: 300 },
  ];

  it('shows the saved amount and share, and explains it in the tooltip', () => {
    const { text, title, isSurcharge } = formatDiscount(
      { original: 40, paid: 15, amount: 25, percent: 62.5, ships },
      'en',
    );
    expect(isSurcharge).toBe(false);
    expect(text).toBe('−$25 (62.5%)');
    expect(title).toContain('Constellation Mk V Centaurus $300 − Guardian QI $260 = $40');
    expect(title).toContain('$15');
  });

  it('marks a surcharge and keeps cents where there are any', () => {
    const { text, isSurcharge } = formatDiscount(
      { original: 60, paid: 72.5, amount: -12.5, percent: -20.83, ships: [ships[0]!] },
      'en',
    );
    expect(isSurcharge).toBe(true);
    expect(text).toBe('+$12.50 (20.8%)');
  });
});
