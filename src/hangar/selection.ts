import { computed, shallowRef } from 'vue';

/*
 * The pledges selected in "My Hangar" (by their id), for the summary box and later bulk actions.
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
  clear() {
    if (ids.value.size) ids.value = new Set();
  },
  /** Drops pledges that are gone from the hangar (melted, gifted, …). */
  keepOnly(existing: ReadonlySet<number>) {
    const kept = [...ids.value].filter((id) => existing.has(id));
    if (kept.length !== ids.value.size) ids.value = new Set(kept);
  },
};

/**
 * The pledges of "My Hangar" that search and filters leave visible, set by the list (see
 * `PledgeList.vue`): the summary box counts these.
 */
export const visiblePledgeIds = shallowRef<ReadonlySet<number> | null>(null);
