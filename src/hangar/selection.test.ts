import { afterEach, describe, expect, it } from 'vitest';
import { selection } from './selection';

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
