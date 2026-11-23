import { computed, shallowRef } from 'vue';

/*
 * The pledges selected in "My Hangar" (by their id), for the sidebar and later bulk actions.
 * Kept for the page only: a reload starts without a selection.
 */

const ids = shallowRef<ReadonlySet<number>>(new Set());

export const selection = {
  /** The selected pledge ids. */
  ids: computed(() => ids.value),
  has: (id: number) => ids.value.has(id),
  toggle(id: number) {
    const next = new Set(ids.value);
    if (!next.delete(id)) next.add(id);
    ids.value = next;
  },
  /** Selects exactly these pledges, e.g. all marked ones that can be melted now. */
  replace(next: Iterable<number>) {
    ids.value = new Set(next);
  },
  clear() {
    if (ids.value.size) ids.value = new Set();
  },
  /** Drops pledges that are gone from the hangar (melted, gifted, …). */
  keepOnly(existing: ReadonlySet<number>) {
    const kept = [...ids.value].filter((id) => existing.has(id));
    if (kept.length !== ids.value.size) ids.value = new Set(kept);
  },
};

/** The state of a "Select all" (#620) over `shown`: none, some or all of them selected. */
export function selectAllState<T>(
  selected: ReadonlySet<T>,
  shown: readonly T[],
): 'false' | 'mixed' | 'true' {
  const count = shown.filter((id) => selected.has(id)).length;
  return count && count === shown.length ? 'true' : count ? 'mixed' : 'false';
}

/**
 * "Select all" (#620): selects every one of `shown`, or none of them once all were. What is
 * selected besides them (e.g. hidden by a filter now) stays selected.
 */
export function toggleAll<T>(selected: ReadonlySet<T>, shown: readonly T[]): Set<T> {
  const next = new Set(selected);
  if (selectAllState(selected, shown) === 'true') for (const id of shown) next.delete(id);
  else for (const id of shown) next.add(id);
  return next;
}

/**
 * The pledges of "My Hangar" that search and filters leave visible, set by the list (see
 * `PledgeList.vue`): the sidebar counts these.
 */
export const visiblePledgeIds = shallowRef<ReadonlySet<number> | null>(null);
