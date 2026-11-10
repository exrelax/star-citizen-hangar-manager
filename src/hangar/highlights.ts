import type { FilterStates } from './filters';

/*
 * The values a filter or a sorting is about, highlighted in the rows while it is on (#216), so the
 * list shows at a glance why each entry is there. Which filter highlights what is set in
 * `FILTER_HIGHLIGHTS` (config.ts); the targets are a fixed list per list, so the config can't
 * point at something the rows don't have. The list puts one class per target on its rows'
 * container (`shm-hl-<target>`), and row.css highlights the matching element of every row – the
 * rows themselves don't change.
 */

/** What "My Hangar" can highlight in a row. */
export const HANGAR_HIGHLIGHTS = [
  'value',
  'discount',
  'giftBadge',
  'meltBadge',
  'insuranceBadge',
  'gameAccessBadge',
] as const;
export type HangarHighlight = (typeof HANGAR_HIGHLIGHTS)[number];

/** What the buy back can highlight in a row. */
export const BUYBACK_HIGHLIGHTS = [
  'price',
  'giftableLabel',
  'insuranceBadge',
  'priceIncreaseLabel',
] as const;
export type BuybackHighlight = (typeof BUYBACK_HIGHLIGHTS)[number];

/** Filters (and sortings) with the targets they highlight. */
export type HighlightMap<K extends string, T extends string> = Partial<Record<K, readonly T[]>>;

/**
 * The classes for the rows' container: the targets of the included filters and of the sorting,
 * each once. Excluded filters highlight nothing: their property is missing from the rows.
 */
export function highlightClasses<F extends string, T extends string>(
  filters: HighlightMap<F, T>,
  states: FilterStates<F>,
  sortTargets: readonly T[] = [],
): string[] {
  const targets = new Set<T>(sortTargets);
  for (const [filter, state] of states) {
    if (state === 'include') for (const target of filters[filter] ?? []) targets.add(target);
  }
  return [...targets].map((target) => `shm-hl-${target}`);
}
