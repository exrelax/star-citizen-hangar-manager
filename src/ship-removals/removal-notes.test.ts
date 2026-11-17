import { describe, expect, it } from 'vitest';
import { withDismissed } from '@/price-increases/advisor-notes';
import { isKindOn, withKind } from '@/notifications/kinds';
import type { RemovalCcus } from './removal-ccus';
import { removalNoteKey, removalNoteKeys, removalNotes } from './removal-notes';
import type { ShipRemoval } from './ship-removals';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const removal = (id: number, name: string, at: string, dayOnly = true): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at: Date.parse(at), ...(dayOnly && { dayOnly: true as const }) },
  source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
});
const ccus = (count: number, source: 'hangar' | 'buyback' = 'hangar') =>
  Array.from({ length: count }, (_, index) => ({ source, id: index + 1, title: `CCU ${index}` }));
const entry = (ship: ShipRemoval, from: number, to: number): RemovalCcus => ({
  removal: ship,
  from: ccus(from),
  to: [...ccus(Math.ceil(to / 2)), ...ccus(Math.floor(to / 2), 'buyback')],
  ...(from && { level: to >= from ? ('warning' as const) : ('critical' as const) }),
});

const ANDROMEDA = removal(45, 'Constellation Mk IV Andromeda', '2027-01-27T00:00:00Z');
const AQUILA = removal(47, 'Constellation Mk IV Aquila', '2027-01-27T00:00:00Z');
const TAURUS = removal(46, 'Constellation Mk IV Taurus', '2027-01-27T00:00:00Z');
const HORNET = removal(15, 'F7C-M Super Hornet Mk I', '2026-12-10T16:00:00Z', false);

describe('removalNotes', () => {
  it('tells all ships of a date in one notification, the next date first', () => {
    const notes = removalNotes(
      [entry(ANDROMEDA, 0, 0), entry(HORNET, 0, 0), entry(AQUILA, 0, 0)],
      NOW,
      [],
    );
    expect(notes.map((note) => note.ships.map((ship) => ship.ship.id))).toEqual([[15], [45, 47]]);
    expect(notes.every((note) => note.warnings.length === 0 && !note.level)).toBe(true);
  });

  it('warns per ship with CCUs from it, red with fewer CCUs to it, red first', () => {
    const [note] = removalNotes(
      [entry(ANDROMEDA, 2, 2), entry(AQUILA, 0, 3), entry(TAURUS, 3, 1)],
      NOW,
      [],
    );
    expect(
      note!.warnings.map(({ removal: { ship }, from, to, level }) => [ship.id, from, to, level]),
    ).toEqual([
      [46, 3, 1, 'critical'],
      [45, 2, 2, 'warning'],
    ]);
    expect(note!.level).toBe('critical');

    const [warningOnly] = removalNotes([entry(ANDROMEDA, 1, 3)], NOW, []);
    expect(warningOnly!.level).toBe('warning');
  });

  it('stays closed for its ships and date; a new ship or date shows it again', () => {
    const list = [entry(ANDROMEDA, 1, 0), entry(AQUILA, 0, 0)];
    const key = removalNoteKey(ANDROMEDA.removedAt, [ANDROMEDA, AQUILA]);
    expect(removalNotes(list, NOW, [key])).toEqual([]);
    expect(removalNotes([...list, entry(TAURUS, 0, 0)], NOW, [key])).toHaveLength(1);
    const moved = removal(45, 'Constellation Mk IV Andromeda', '2027-02-01T00:00:00Z');
    expect(removalNotes([entry(moved, 1, 0), entry(AQUILA, 0, 0)], NOW, [key])).toHaveLength(2);
  });

  it('keeps only the dismissed dates still ahead', () => {
    const past = removalNoteKey(HORNET.removedAt, [HORNET]);
    const ahead = removalNoteKeys([ANDROMEDA, AQUILA], NOW);
    const key = removalNoteKey(ANDROMEDA.removedAt, [ANDROMEDA, AQUILA]);
    expect(withDismissed([past], key, ahead)).toEqual([key]);
  });

  it('leaves out dates that are past', () => {
    expect(removalNotes([entry(HORNET, 1, 0)], Date.parse('2026-12-10T16:00:00Z'), [])).toEqual([]);
  });
});

describe('the kind shipRemovals', () => {
  it('can be turned off and on', () => {
    expect(isKindOn([], 'shipRemovals')).toBe(true);
    const off = withKind([], 'shipRemovals', false);
    expect(isKindOn(off, 'shipRemovals')).toBe(false);
    expect(isKindOn(withKind(off, 'shipRemovals', true), 'shipRemovals')).toBe(true);
  });
});
