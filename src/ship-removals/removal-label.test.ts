import { describe, expect, it } from 'vitest';
import { removalLabel } from './removal-label';
import type { ShipRemoval } from './ship-removals';

/* The badge of a ship leaving the Pledge Store (#288), also in the table of all ships (#410). */

const removal = (removedAt: ShipRemoval['removedAt']): ShipRemoval => ({
  ship: { id: 45, name: 'Constellation Mk IV Andromeda' },
  removedAt,
  source: 'https://example.org',
});

describe('removalLabel', () => {
  it('counts down to the day and tells the date as CIG announced it', () => {
    const label = removalLabel(
      removal({ at: Date.UTC(2027, 0, 27), dayOnly: true }),
      Date.UTC(2026, 10, 19),
      'en',
    );
    expect(label.text).toBe('Removal: Jan 27');
    expect(label.hint).toBe(
      'CIG takes the Constellation Mk IV Andromeda out of the Pledge Store on Jan 27, 2027.\nThe date is CIG’s announcement.',
    );
  });

  it('counts down the days to a time', () => {
    const at = Date.UTC(2026, 10, 25, 16);
    const label = removalLabel(removal({ at }), at - 3.5 * 24 * 3600_000, 'en');
    expect(label.text).toBe('Removal: 3 days');
  });
});
