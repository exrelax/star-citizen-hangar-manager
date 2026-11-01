/**
 * Lower case words without diacritics or punctuation, each preceded by a space, e.g.
 * "Paints - Café L-22" → " paints cafe l 22". The leading spaces let `matchesSearch` find
 * word starts with a plain `includes`.
 */
export function normalizeSearchText(value: string): string {
  return ' ' + words(value).join(' ');
}

/** Splits a query into normalized terms; an empty query has no terms. */
export function parseSearchQuery(query: string): string[] {
  return words(query);
}

/** Whether every term starts a word of the (normalized) text, in any order. */
export function matchesSearch(normalizedText: string, terms: readonly string[]): boolean {
  return terms.every((term) => normalizedText.includes(' ' + term));
}

function words(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
