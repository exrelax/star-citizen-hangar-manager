import { describe, expect, it } from 'vitest';
import { matchesSearch, normalizeSearchText, parseSearchQuery } from './search';

const matches = (title: string, query: string) =>
  matchesSearch(normalizeSearchText(title), parseSearchQuery(query));

describe('parseSearchQuery', () => {
  it('splits into normalized terms and ignores extra whitespace', () => {
    expect(parseSearchQuery('  Mk  V ')).toEqual(['mk', 'v']);
    expect(parseSearchQuery('L-22')).toEqual(['l', '22']);
    expect(parseSearchQuery('   ')).toEqual([]);
  });
});

describe('matchesSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matches('Polaris', '')).toBe(true);
  });

  it('ignores case and diacritics', () => {
    expect(matches('Paints - Ursa - Respite Paint', 'URSA')).toBe(true);
    expect(matches('Mirai Pulse & ‘GCD-Army’ Paint', 'mirai')).toBe(true);
    expect(matches('Café Racer', 'cafe')).toBe(true);
  });

  it('requires all terms, in any order', () => {
    expect(matches('Upgrade - Mercury to Constellation Mk V', 'constellation mercury')).toBe(true);
    expect(matches('Upgrade - Mercury to Constellation Mk V', 'constellation polaris')).toBe(false);
  });

  it('matches the start of words', () => {
    expect(matches('Constellation Andromeda', 'androm')).toBe(true);
    expect(matches('Upgrade - Mercury to Constellation Mk V', 'mk v')).toBe(true);
    expect(matches('Upgrade - MPUV Cargo to Aurora Mk I LN', 'mk v')).toBe(false);
    expect(matches('Standalone Ships - HoverQuad', 'quad')).toBe(false);
  });

  it('finds pledge ids from their start, with or without #', () => {
    const text = normalizeSearchText('Polaris 114816820');
    expect(matchesSearch(text, parseSearchQuery('114816820'))).toBe(true);
    expect(matchesSearch(text, parseSearchQuery('#1148'))).toBe(true);
    expect(matchesSearch(text, parseSearchQuery('816820'))).toBe(false);
  });

  it('ignores punctuation in titles and queries', () => {
    expect(matches('L-22 Alpha Wolf', 'l-22')).toBe(true);
    expect(matches('L-22 Alpha Wolf', 'l22')).toBe(false);
  });
});
