import { describe, expect, it } from 'vitest';
import {
  addItem,
  addItemCounts,
  createWatchlist,
  dueReminders,
  isReminderDue,
  nextReminderAt,
  reminderKey,
  withReminderDone,
  withReminderRestored,
  itemKey,
  listsWith,
  presenceOf,
  removeItem,
  setItemCount,
  updateWatchlist,
  withLastSeen,
  type PledgeLists,
  type WatchItem,
} from './watchlists';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const LATER = NOW + 60_000;
const list = () => createWatchlist({ name: '  Melt after the IAE  ' }, NOW, 'list1');

describe('a watchlist (#465)', () => {
  it('is made with a trimmed name, no date and no reminder, notifying on store changes', () => {
    expect(list()).toEqual({
      id: 'list1',
      name: 'Melt after the IAE',
      description: '',
      reminder: false,
      storeAlerts: true,
      items: [],
      createdAt: NOW,
      changedAt: NOW,
    });
  });

  it('has a reminder only with a date, and drops both with the date', () => {
    const dated = createWatchlist({ name: 'IAE', dueAt: LATER }, NOW, 'x');
    expect(dated.reminder).toBe(true);
    const off = updateWatchlist(dated, { reminder: false }, LATER);
    expect(off).toMatchObject({ dueAt: LATER, reminder: false, changedAt: LATER });
    const undated = updateWatchlist(dated, { dueAt: null }, LATER);
    expect(undated.dueAt).toBeUndefined();
    expect('dueAt' in undated).toBe(false);
    expect(undated.reminder).toBe(false);
  });

  it('keeps an item once, with its count for store items only', () => {
    let current = addItem(
      list(),
      { kind: 'hangar', pledgeId: 7, name: 'Cutlass', value: 100 },
      NOW,
    );
    current = addItem(current, { kind: 'hangar', pledgeId: 7, name: 'Cutlass Black' }, LATER);
    current = addItem(
      current,
      { kind: 'storeCcu', fromShipId: 1, toShipId: 2, name: 'Aurora to Mustang', count: 3 },
      LATER,
    );
    expect(current.items).toEqual([
      { kind: 'hangar', pledgeId: 7, name: 'Cutlass Black', addedAt: NOW },
      {
        kind: 'storeCcu',
        fromShipId: 1,
        toShipId: 2,
        name: 'Aurora to Mustang',
        count: 3,
        addedAt: LATER,
      },
    ]);
    const key = itemKey({ kind: 'storeCcu', fromShipId: 1, toShipId: 2 });
    expect(setItemCount(current, key, 500, LATER).items[1]!.count).toBe(99);
    expect(setItemCount(current, 'h:7', 4, LATER)).toBe(current);
    expect(removeItem(current, 'h:7', LATER).items).toHaveLength(1);
    expect(removeItem(current, 'h:8', LATER)).toBe(current);
  });

  it('finds the watchlists an item is on', () => {
    const a = addItem(list(), { kind: 'buyback', pledgeId: 3, name: 'Paint' }, NOW);
    const b = createWatchlist({ name: 'Other' }, NOW, 'list2');
    expect(listsWith([a, b], 'b:3').map((entry) => entry.id)).toEqual(['list1']);
  });
});

describe('items that left the hangar or the buy back (#465)', () => {
  const item = (kind: 'hangar' | 'buyback', pledgeId: number, addedAt = NOW): WatchItem => ({
    kind,
    pledgeId,
    name: 'Old name',
    addedAt,
  });
  const lists: PledgeLists = {
    hangar: { pledges: [{ id: 1, title: 'Carrack', valueUsd: 600 }], updatedAt: LATER },
    buyback: { pledges: [{ id: 2, title: 'Melted', price: { amount: 30 } }], updatedAt: LATER },
  };

  it('is present while its list has it', () => {
    expect(presenceOf(item('hangar', 1), lists)).toEqual({ state: 'present' });
    expect(presenceOf(item('buyback', 2), lists)).toEqual({ state: 'present' });
  });

  it('is gone once its list was read without it, with where it went', () => {
    expect(presenceOf(item('hangar', 2), lists)).toEqual({ state: 'gone', nowIn: 'buyback' });
    expect(presenceOf(item('buyback', 1), lists)).toEqual({ state: 'gone', nowIn: 'hangar' });
    expect(presenceOf(item('hangar', 9), lists)).toEqual({ state: 'gone' });
  });

  it("isn't known as gone while its list wasn't read since it was added", () => {
    expect(presenceOf(item('hangar', 9, LATER + 1), lists)).toEqual({ state: 'unknown' });
    expect(presenceOf(item('hangar', 9), {})).toEqual({ state: 'unknown' });
  });

  it('takes the names and values the lists show now, a gone item keeps its own', () => {
    const watched = {
      ...list(),
      items: [item('hangar', 1), item('buyback', 2), item('hangar', 9)],
    };
    const seen = withLastSeen(watched, lists);
    expect(seen.items.map(({ name, value }) => [name, value])).toEqual([
      ['Carrack', 600],
      ['Melted', 30],
      ['Old name', undefined],
    ]);
    expect(withLastSeen(seen, lists)).toBe(seen);
  });
});

describe('reminders (#469)', () => {
  const dated = (id: string, dueAt: number, reminder = true) =>
    createWatchlist({ name: id, dueAt, reminder }, NOW, id);

  it('is due from its date on, while on and not dismissed', () => {
    const due = dated('a', LATER);
    expect(isReminderDue(due, NOW)).toBe(false);
    expect(isReminderDue(due, LATER)).toBe(true);
    expect(isReminderDue(dated('b', NOW, false), LATER)).toBe(false);
    expect(isReminderDue(list(), LATER)).toBe(false);
  });

  it('stays dismissed for its date, and reminds again at a new one', () => {
    const done = withReminderDone(dated('a', NOW));
    expect(isReminderDue(done, LATER)).toBe(false);
    const moved = updateWatchlist(done, { dueAt: LATER }, NOW);
    expect(isReminderDue(moved, LATER)).toBe(true);
    expect(isReminderDue(withReminderRestored(done), LATER)).toBe(true);
    expect(reminderKey(moved)).toBe(`a@${LATER}`);
  });

  it('lists the due ones by date and tells the next one ahead', () => {
    const lists = [dated('late', NOW - 1000), dated('early', NOW - 5000), dated('ahead', LATER)];
    expect(dueReminders(lists, NOW).map((entry) => entry.id)).toEqual(['early', 'late']);
    expect(nextReminderAt(lists, NOW)).toBe(LATER);
    expect(nextReminderAt([dated('off', LATER, false)], NOW)).toBeUndefined();
  });
});

describe('addItemCounts (#531)', () => {
  it('adds the counts to those on it already, and tells new from counted up', () => {
    const start = addItem(
      list(),
      { kind: 'storePaint', skuId: 7, name: 'Dusk', value: 10, count: 2 },
      NOW,
    );
    const {
      list: next,
      added,
      raised,
    } = addItemCounts(
      start,
      [
        { kind: 'storePaint', skuId: 7, name: 'Dusk', value: 11, count: 3 },
        { kind: 'storeShip', shipId: 2, insurance: 'lti', name: 'Cutlass Black - LTI', count: 1 },
      ],
      NOW + 1,
    );
    expect({ added, raised }).toEqual({ added: 1, raised: 1 });
    expect(next.items.map((entry) => [itemKey(entry), entry.count, entry.value])).toEqual([
      ['p:7', 5, 11],
      ['s:2:lti', 1, undefined],
    ]);
    expect(next.items[0]!.addedAt).toBe(NOW);
  });

  it('keeps a count at its limit', () => {
    const start = addItem(list(), { kind: 'storePaint', skuId: 7, name: 'Dusk', count: 98 }, NOW);
    const { list: next } = addItemCounts(
      start,
      [{ kind: 'storePaint', skuId: 7, name: 'Dusk', count: 5 }],
      NOW,
    );
    expect(next.items[0]!.count).toBe(99);
  });
});
