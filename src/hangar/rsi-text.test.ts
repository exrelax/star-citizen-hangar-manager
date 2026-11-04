import { setLocale } from '@/i18n';
import { afterEach, describe, expect, it } from 'vitest';
import { rsiText } from './rsi-text';

describe('rsiText', () => {
  afterEach(() => setLocale('en'));

  it("keeps RSI's English unless translated texts are wanted", () => {
    setLocale('de');
    expect(rsiText(false, 'exchange.consentLimited')).toBe(
      'Some limited availability items included or contained within the exchanged pledge are permanently relinquished.',
    );
    expect(rsiText(true, 'exchange.consentLimited')).toMatch(/^Einige limitierte Items/);
    expect(rsiText(false, 'gift.intro', ['Polaris'])).toContain('your “Polaris” pledge');
  });
});
