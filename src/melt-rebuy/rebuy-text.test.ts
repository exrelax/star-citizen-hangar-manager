import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import type { RebuyReason } from './rebuyable';
import { rebuyLabelHint, rebuyReasonText } from './rebuy-text';

afterEach(() => setLocale('en'));

const reasons: RebuyReason[] = [
  { code: 'protected' },
  { code: 'reward' },
  { code: 'notMeltable' },
  { code: 'tooRecent', meltableAt: 0 },
  { code: 'giftable' },
  { code: 'refundPeriod', daysLeft: 18, until: '2026-12-10' },
  { code: 'package' },
  { code: 'pack' },
  { code: 'upgraded' },
  { code: 'extraItems' },
  { code: 'otherKind' },
  { code: 'notOnSale' },
  { code: 'discount', amount: 40, percent: 10, price: 400 },
  { code: 'paintVolumeDiscount', amount: 2.5, percent: 25, price: 10 },
  { code: 'insurance', insurance: { lifetime: true } },
  { code: 'priceIncrease', ship: 'Perseus', at: 0, confirmed: true },
  { code: 'priceIncrease', ship: 'Perseus', at: 0, confirmed: false },
  { code: 'removal', ship: 'Carrack', removedAt: { at: 0, dayOnly: true } },
  { code: 'notAlwaysAvailable', ship: 'Polaris' },
  { code: 'unknown', missing: 'price' },
  { code: 'unknown', missing: 'onSale' },
  { code: 'unknown', missing: 'insurance' },
  { code: 'unknown', missing: 'availability' },
];

describe('rebuyReasonText (#528)', () => {
  it('has a text for every reason in every language', () => {
    for (const locale of ['en', 'de', 'fr', 'es'] as const) {
      setLocale(locale);
      const texts = reasons.map(rebuyReasonText);
      for (const text of texts) {
        expect(text).not.toMatch(/meltRebuy|\$[1-9](?![\d.,])/);
      }
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('fills in amounts, ships, insurances and dates', () => {
    expect(reasons.map(rebuyReasonText)).toEqual([
      'Protected game access',
      'Reward',
      'Can’t be melted',
      'Bought less than 24 hours ago',
      'Giftable',
      'Refund possible until Dec 10, 2026',
      'Package with game access',
      'Several ships',
      'Upgraded',
      'Extra items',
      'No paint, ship or CCU',
      'Not on sale now',
      'Discount of $40',
      'Paint volume discount of $2.50',
      'LTI not on sale',
      'Price increase ahead: Perseus',
      'Price increase expected: Perseus',
      'Leaves the Pledge Store: Carrack',
      'Not always available: Polaris',
      'Price not known yet',
      'Not known yet whether it’s on sale',
      'Insurance in the Pledge Store not known',
      'Availability not known yet',
    ]);
  });

  it('speaks of the store credits in the plural in German', () => {
    setLocale('de');
    expect(rebuyLabelHint({ freedCredit: 55, rebuyPrice: 50 })).toMatch(
      /^Einschmelzen gibt dir 55\s\$ Store Credits frei\. .* 50\s\$ Store Credits/,
    );
  });
});

describe('rebuyLabelHint', () => {
  it('names the freed store credit and the rebuy price', () => {
    expect(rebuyLabelHint({ freedCredit: 55, rebuyPrice: 50 })).toBe(
      'Melting it frees $55 in store credit. Rebuying it in the Pledge Store costs $50 in store credit now – the same item with the same insurance.',
    );
  });
});
