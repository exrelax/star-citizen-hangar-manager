import { afterEach, describe, expect, it, vi } from 'vitest';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import { browserLocale, matchLocale, translate } from './index';

describe('matchLocale', () => {
  it('matches by base language', () => {
    expect(matchLocale('de')).toBe('de');
    expect(matchLocale('de-AT')).toBe('de');
    expect(matchLocale('en-US')).toBe('en');
    expect(matchLocale('fr-CA')).toBe('fr');
    expect(matchLocale('es-MX')).toBe('es');
  });

  it('falls back to English', () => {
    expect(matchLocale('it-IT')).toBe('en');
    expect(matchLocale(undefined)).toBe('en');
  });
});

describe('translate', () => {
  it('returns the message of the locale', () => {
    expect(translate('en', 'settings.smartUpdates')).toBe('Smart updates');
    expect(translate('de', 'settings.smartUpdates')).toBe('Intelligente Updates');
    expect(translate('fr', 'settings.smartUpdates')).toBe('Mises à jour intelligentes');
    expect(translate('es', 'settings.smartUpdates')).toBe('Actualizaciones inteligentes');
  });

  it('fills in substitutions and unescapes dollar signs', () => {
    expect(translate('en', 'manager.countFiltered', [3, 986])).toBe('3 of 986 pledges');
    expect(translate('en', 'settings.hideMeltValueHint')).toBe(
      'Hides the $ values: pledge values, discounts and the costs of applied upgrades.',
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

describe('locale files', () => {
  type Messages = { [key: string]: string | Messages };
  /** Every key of the file with the placeholders of its message, e.g. "manager.count $1". */
  const keys = (messages: Messages, prefix = ''): string[] =>
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [`${prefix}${key} ${(value.match(/\$[1-9]/g) ?? []).sort().join(' ')}`]
        : keys(value, `${prefix}${key}.`),
    );

  it('have the same keys and placeholders as English', () => {
    expect(keys(de)).toEqual(keys(en));
    expect(keys(fr)).toEqual(keys(en));
    expect(keys(es)).toEqual(keys(en));
  });
});
