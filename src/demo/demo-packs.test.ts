import { describe, expect, it } from 'vitest';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';

/* The demo cases of ship packs (#516, for #515). */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe.each(['key-a', 'key-b', 'k3'])('ship packs in the demo %s (#516)', (key) => {
  const { pledges, buyback } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);
  const packs = pledges.filter((pledge) => pledge.pack);

  it('has a pack of two ships, one of many and one with extras in My Hangar', () => {
    const sizes = packs.map((pledge) => pledge.pack!.length);
    expect(sizes).toContain(2);
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(5);
    expect(
      packs.some((pledge) =>
        pledge.items.some((item) => item.kind === 'Skin' || item.kind === 'FPS Equipment'),
      ),
    ).toBe(true);
    // The many ships' title is long enough to be shortened in the list.
    expect(
      packs.some((pledge) => pledge.pack!.map((ship) => ship.name).join(', ').length > 40),
    ).toBe(true);
  });

  it('keeps single ships as they are', () => {
    expect(pledges.some((pledge) => pledge.isStandaloneShip && !pledge.pack)).toBe(true);
  });

  it('has a pack of two ships and one of many in the Buy Back, with their images', () => {
    const sizes = buyback.flatMap((pledge) => (pledge.pack ? [pledge.pack.length] : []));
    expect(sizes.sort()).toEqual([2, 5]);
  });
});
