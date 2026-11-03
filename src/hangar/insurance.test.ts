import { describe, expect, it } from 'vitest';
import { bestInsurance, insuranceLabel, parseInsurance } from './insurance';

describe('parseInsurance', () => {
  it('reads lifetime and month insurances, nothing else', () => {
    expect(parseInsurance('Lifetime Insurance')).toEqual({ lifetime: true });
    expect(parseInsurance('120 Month Insurance')).toEqual({ lifetime: false, months: 120 });
    expect(parseInsurance('3 Months Insurance')).toEqual({ lifetime: false, months: 3 });
    expect(parseInsurance('Self-Land Hangar')).toBeUndefined();
  });
});

describe('bestInsurance', () => {
  it('takes lifetime insurance over any number of months', () => {
    expect(
      bestInsurance(['120 Month Insurance', 'Lifetime Insurance', '6 Month Insurance']),
    ).toEqual({ lifetime: true });
  });

  it('takes the most months otherwise, ignoring other items', () => {
    // Pledge #93305004: a Dragonfly with 120 months.
    expect(bestInsurance(['Dragonfly Star Kitten Edition', '120 Month Insurance'])).toEqual({
      lifetime: false,
      months: 120,
    });
    expect(bestInsurance(['6 Month Insurance', '12 Month Insurance'])).toEqual({
      lifetime: false,
      months: 12,
    });
    expect(bestInsurance(['Self-Land Hangar'])).toBeUndefined();
  });
});

describe('insuranceLabel', () => {
  it('shows LTI, whole years, or months', () => {
    expect(insuranceLabel({ lifetime: true })).toBe('LTI');
    expect(insuranceLabel({ lifetime: false, months: 120 })).toBe('10 years');
    expect(insuranceLabel({ lifetime: false, months: 12 })).toBe('1 year');
    expect(insuranceLabel({ lifetime: false, months: 6 })).toBe('6 months');
    expect(insuranceLabel({ lifetime: false, months: 1 })).toBe('1 month');
  });
});
