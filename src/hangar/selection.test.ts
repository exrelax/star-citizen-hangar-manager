import { afterEach, describe, expect, it } from 'vitest';
import { selectAllState, selection, toggleAll } from './selection';

afterEach(() => selection.clear());

describe('selection', () => {
  it('toggles pledges and clears them', () => {
    selection.toggle(1);
    selection.toggle(2);
    selection.toggle(1);
    expect([...selection.ids.value]).toEqual([2]);
    selection.clear();
    expect(selection.ids.value.size).toBe(0);
  });

  it('drops pledges that are gone from the hangar', () => {
    selection.toggle(1);
    selection.toggle(2);
    selection.keepOnly(new Set([2, 3]));
    expect([...selection.ids.value]).toEqual([2]);
  });
});

describe('"Select all" (#620)', () => {
  // The pledges search, filters or a List Shortcut leave visible.
  const shown = [2, 3, 4];

  it('tells none, some and all of the shown pledges selected', () => {
    expect(selectAllState(new Set([1]), shown)).toBe('false');
    expect(selectAllState(new Set([1, 3]), shown)).toBe('mixed');
    expect(selectAllState(new Set([2, 3, 4]), shown)).toBe('true');
    expect(selectAllState(new Set(), [])).toBe('false');
  });

  it('selects the shown pledges and keeps one selected before that is hidden now', () => {
    expect([...toggleAll(new Set([1, 3]), shown)].sort()).toEqual([1, 2, 3, 4]);
  });

  it('clears the shown pledges once all were selected, not the hidden ones', () => {
    expect([...toggleAll(new Set([1, 2, 3, 4]), shown)]).toEqual([1]);
  });

  it('selects a narrower search on top, e.g. after a filter', () => {
    const all = toggleAll(new Set<number>(), shown);
    expect([...toggleAll(all, [5, 6])].sort()).toEqual([2, 3, 4, 5, 6]);
  });
});
