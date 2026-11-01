import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserLocale, matchLocale, translate } from './index';

describe('matchLocale', () => {
  it('matches by base language', () => {
    expect(matchLocale('de')).toBe('de');
    expect(matchLocale('de-AT')).toBe('de');
    expect(matchLocale('en-US')).toBe('en');
  });

  it('falls back to English', () => {
    expect(matchLocale('fr-FR')).toBe('en');
    expect(matchLocale(undefined)).toBe('en');
  });
});

describe('translate', () => {
  it('returns the message of the locale', () => {
    expect(translate('en', 'settings.rewards')).toBe('Hide rewards');
    expect(translate('de', 'settings.rewards')).toBe('Rewards ausblenden');
  });

  it('fills in substitutions and unescapes dollar signs', () => {
    expect(translate('en', 'manager.countFiltered', [3, 986])).toBe('3 of 986 pledges');
    expect(translate('en', 'settings.hideMeltValueHint')).toBe(
      'Hides the $ values in the hangar list.',
    );
  });
});

describe('browserLocale', () => {
  afterEach(() => vi.restoreAllMocks());

  it('follows the interface or the preferred website language', () => {
    vi.spyOn(browser.i18n, 'getUILanguage').mockReturnValue('en-US');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de');

    expect(browserLocale('ui')).toBe('en');
    expect(browserLocale('preferred')).toBe('de');
  });
});
