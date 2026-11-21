import { describe, expect, it } from 'vitest';
import { reminderSchedule } from './reminder-browser-notification';
import { createWatchlist, reminderKey, withReminderDone } from './watchlists';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const dated = (id: string, dueAt: number) =>
  createWatchlist({ name: id, dueAt, reminder: true }, NOW - 86_400_000, id);

describe('the browser notification of a reminder (#469)', () => {
  it('tells each due reminder once and looks again at the next date', () => {
    const due = dated('due', NOW - 1000);
    const told = dated('told', NOW - 2000);
    const ahead = dated('ahead', NOW + 60_000);
    const schedule = reminderSchedule([due, told, ahead], [reminderKey(told)], NOW);
    expect(schedule.due.map((list) => list.id)).toEqual(['due']);
    expect([...schedule.open]).toEqual([reminderKey(told), reminderKey(due)]);
    expect(schedule.next).toBe(NOW + 60_000);
  });

  it('no longer counts a dismissed reminder as due', () => {
    const schedule = reminderSchedule([withReminderDone(dated('a', NOW - 1000))], [], NOW);
    expect(schedule.due).toEqual([]);
    expect(schedule.open.size).toBe(0);
    expect(schedule.next).toBeUndefined();
  });
});
