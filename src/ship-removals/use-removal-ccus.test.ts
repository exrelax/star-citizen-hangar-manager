import { describe, expect, it } from 'vitest';
import type { RemovalCcus } from './removal-ccus';
import type { ShipRemoval } from './ship-removals';
import { removalCcusState } from './use-removal-ccus';

const removal = (id: number, name: string): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
  source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
});
const ccu = (source: 'hangar' | 'buyback', id: number) => ({ source, id, title: `CCU ${id}` });

describe('removalCcusState', () => {
  it('finds the removal of each hangar CCU by its base ship, not by its target', () => {
    const andromeda: RemovalCcus = {
      removal: removal(45, 'Constellation Mk IV Andromeda'),
      from: [ccu('hangar', 1), ccu('buyback', 2)],
      to: [ccu('hangar', 3)],
      level: 'warning',
    };
    const state = removalCcusState([andromeda]);
    expect(state.byHangarCcu.get(1)).toBe(andromeda);
    // A buy back pledge's id is another kind of id; a CCU to the ship gets no warning.
    expect(state.byHangarCcu.has(2)).toBe(false);
    expect(state.byHangarCcu.has(3)).toBe(false);
    expect(state.list).toEqual([andromeda]);
  });
});
