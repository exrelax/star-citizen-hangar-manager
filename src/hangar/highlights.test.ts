import { describe, expect, it } from 'vitest';
import { FILTER_HIGHLIGHTS } from '@/config';
import type { PledgeFilter } from './filters';
import { highlightClasses } from './highlights';

const states = (entries: [PledgeFilter, 'include' | 'exclude'][]) => new Map(entries);

describe('highlightClasses', () => {
  const hangar = FILTER_HIGHLIGHTS.hangar;

  it('highlights what the included filters are about, each once', () => {
    expect(
      highlightClasses(
        hangar,
        states([
          ['giftable', 'include'],
          ['meltable', 'include'],
        ]),
      ),
    ).toEqual(['shm-hl-value', 'shm-hl-giftBadge', 'shm-hl-meltBadge']);
  });

  it('highlights nothing for excluded filters or filters without targets', () => {
    expect(highlightClasses(hangar, states([['giftable', 'exclude']]))).toEqual([]);
    expect(highlightClasses(hangar, states([['ships', 'include']]))).toEqual([]);
  });

  it('adds what the sorting is about', () => {
    expect(
      highlightClasses(hangar, states([['lti', 'include']]), FILTER_HIGHLIGHTS.sorts.discountDesc),
    ).toEqual(['shm-hl-discount', 'shm-hl-insuranceBadge']);
    expect(highlightClasses(hangar, new Map(), FILTER_HIGHLIGHTS.sorts.newest)).toEqual([]);
  });

  it('works the same for the buy back', () => {
    expect(
      highlightClasses(FILTER_HIGHLIGHTS.buyback, new Map([['available', 'include' as const]])),
    ).toEqual(['shm-hl-price']);
  });
});
