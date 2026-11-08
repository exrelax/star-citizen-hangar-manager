import { describe, expect, it } from 'vitest';
import {
  NOTIFICATIONS_KEEP_DONE_MS,
  openNotifications,
  withAdded,
  withDone,
  withoutOld,
  type AppNotification,
} from './notifications';

const note = (id: number, overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: `test:${id}`,
  text: `Note ${id}`,
  at: id,
  ...overrides,
});

describe('withAdded', () => {
  it('adds only notifications it doesn’t have yet', () => {
    const list = [note(1, { doneAt: 5 })];
    expect(withAdded(list, [note(1), note(2)])).toEqual([note(1, { doneAt: 5 }), note(2)]);
  });

  it('keeps the same list without new ones', () => {
    const list = [note(1)];
    expect(withAdded(list, [note(1)])).toBe(list);
  });
});

describe('withDone and openNotifications', () => {
  it('checks off the open ones of the ids and lists the rest newest first', () => {
    const list = withDone([note(1), note(2), note(3)], new Set(['test:2']), 10);
    expect(list[1]).toEqual(note(2, { doneAt: 10 }));
    expect(openNotifications(list).map((entry) => entry.id)).toEqual(['test:3', 'test:1']);
  });

  it('keeps the time a notification was checked off', () => {
    const list = [note(1, { doneAt: 4 })];
    expect(withDone(list, new Set(['test:1']), 10)).toBe(list);
  });
});

describe('withoutOld', () => {
  it('removes notifications checked off long ago', () => {
    const now = NOTIFICATIONS_KEEP_DONE_MS + 100;
    const list = [note(1, { doneAt: 50 }), note(2, { doneAt: 200 }), note(3)];
    expect(withoutOld(list, now)).toEqual([note(2, { doneAt: 200 }), note(3)]);
  });
});
