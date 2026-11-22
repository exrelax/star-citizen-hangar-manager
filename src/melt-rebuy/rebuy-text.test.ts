import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import type { RebuyReason } from './rebuyable';
import {
  rebuyGroupHint,
  rebuyLabelHint,
  rebuyReasonPlainText,
  rebuyReasonText,
  rebuyVolumeNote,
} from './rebuy-text';

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

  it('adds the hint on a paint bought at a volume discount (#593)', () => {
    const volumeDiscount = { percent: 35, paints: 10, price: 10 };
    expect(rebuyLabelHint({ freedCredit: 6.5, rebuyPrice: 6.5, volumeDiscount })).toMatch(
      /store credit now – the same item with the same insurance\. Bought at a 35 % volume discount: it comes back only with at least 10 paints in one cart\./,
    );
    expect(rebuyLabelHint({ freedCredit: 6.5, volumeDiscount }, { hideValues: true })).toContain(
      'at least 10 paints in one cart',
    );
  });
});

describe('rebuyVolumeNote (#593)', () => {
  const paint = (percent: number, paints: number, rebuyable = true) => ({
    pledgeId: percent,
    rebuyable,
    reasons: [],
    freedCredit: 5,
    volumeDiscount: { percent, paints, price: 10 },
  });

  it('counts the rebuyable paints bought at a volume discount, with the highest tier', () => {
    expect(rebuyVolumeNote([paint(25, 5), paint(35, 10), paint(15, 2, false), undefined])).toMatch(
      /^2 of these paints were bought at a volume discount of up to 35 %\. .* at least 10 paints/,
    );
    expect(rebuyVolumeNote([paint(20, 3)])).toMatch(/^1 of these paints was bought/);
  });

  it('has none without such paints', () => {
    expect(rebuyVolumeNote([])).toBeUndefined();
  });
});

describe('the texts without amounts, for "Hide melt value" (#530)', () => {
  it('leave the amount out of a discount', () => {
    expect(reasons.map(rebuyReasonPlainText).filter((text) => /\$/.test(text))).toEqual([]);
    expect(rebuyReasonPlainText({ code: 'discount', amount: 40, percent: 10, price: 400 })).toBe(
      'Discount',
    );
    expect(rebuyReasonPlainText({ code: 'giftable' })).toBe('Giftable');
  });

  it('tell what the label means', () => {
    const plain = rebuyLabelHint({ freedCredit: 55, rebuyPrice: 50 }, { hideValues: true });
    expect(plain).not.toMatch(/\$/);
    expect(rebuyGroupHint({ count: 2, freedCredit: 1, rebuyPrice: 1 }, { hideValues: true })).toBe(
      plain,
    );
  });
});

describe('rebuyGroupHint (#530)', () => {
  it('names the count, the freed store credit and the rebuy price', () => {
    expect(rebuyGroupHint({ count: 3, freedCredit: 55.3, rebuyPrice: 50 })).toBe(
      'Melting the 3 rebuyable pledges frees $55.30 in store credit. Rebuying them in the Pledge Store costs $50 in store credit now.',
    );
    expect(rebuyGroupHint({ count: 1, freedCredit: 10, rebuyPrice: 10 })).toBe(
      'Melting the rebuyable pledge frees $10 in store credit. Rebuying it in the Pledge Store costs $10 in store credit now.',
    );
  });

  it('has the plural forms in every language', () => {
    for (const locale of ['en', 'de', 'fr', 'es'] as const) {
      setLocale(locale);
      for (const count of [1, 2]) {
        const text = rebuyGroupHint({ count, freedCredit: 10, rebuyPrice: 10 });
        expect(text).not.toMatch(/meltRebuy|\$[1-9](?![\d.,])/);
      }
    }
  });
});
