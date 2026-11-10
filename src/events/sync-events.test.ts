import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { noteText, notificationsItem } from '@/notifications/notifications';
import { settingsItem } from '@/settings/settings';
import { EMPTY_META } from '@/storage/meta';
import type { StarCitizenEvent } from './events';
import { eventsItem, eventsMeta } from './events-storage';
import { eventsDue, maybeRefreshEvents } from './sync-events';

/** 11:30 UTC: read at 11:00, next at 13:00 (`SITE_DATA.schedule`). */
const NOW = Date.UTC(2026, 10, 10, 11, 30);
const HOUR = 60 * 60 * 1000;

const iae: StarCitizenEvent = {
  id: 'iae-2956',
  name: { en: 'IAE 2956', de: 'IAE 2956 (de)' },
  eventStart: Date.parse('2026-11-13T16:00:00Z'),
  eventEnd: Date.parse('2026-11-27T20:00:00Z'),
  displayStart: Date.parse('2026-11-06T00:00:00Z'),
  displayEnd: Date.parse('2026-11-27T20:00:00Z'),
};

describe('eventsDue', () => {
  it('reads at the times of the schedule, after a failure again after an hour', () => {
    expect(eventsDue(EMPTY_META, NOW)).toBe(true);
    const read = { ...EMPTY_META, checkedAt: NOW - 20 * 60_000 };
    expect(eventsDue(read, NOW)).toBe(false);
    expect(eventsDue({ ...read, checkedAt: NOW - 40 * 60_000 }, NOW)).toBe(true);
    const failed = {
      ...read,
      lastOutcome: {
        at: read.checkedAt,
        status: 'failed' as const,
        added: 0,
        removed: 0,
        changed: 0,
      },
    };
    expect(eventsDue(failed, NOW)).toBe(false);
    expect(eventsDue(failed, NOW + 40 * 60_000)).toBe(true);
  });
});

describe('maybeRefreshEvents', () => {
  beforeEach(() => fakeBrowser.reset());

  it('stores the events and tells a shown one once in the sidebar', async () => {
    const fetch = vi.fn(async () => [iae]);
    await maybeRefreshEvents({ fetch, now: () => NOW });
    await maybeRefreshEvents({ fetch, now: () => NOW + HOUR });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await eventsItem.getValue())?.events).toEqual([iae]);
    const notes = await notificationsItem.getValue();
    expect(notes.map((note) => [note.id, note.kind])).toEqual([['events:iae-2956', 'events']]);
    expect(notes[0]?.text).toContain('IAE 2956');
  });

  it('keeps the stored events when the file can not be read', async () => {
    await maybeRefreshEvents({ fetch: async () => [iae], now: () => NOW });
    await maybeRefreshEvents({
      force: true,
      fetch: async () => {
        throw new Error('offline');
      },
      now: () => NOW,
    });
    expect((await eventsItem.getValue())?.events).toEqual([iae]);
    expect((await eventsMeta.getValue()).lastOutcome?.status).toBe('failed');
  });

  it('tells nothing while the kind is turned off', async () => {
    await settingsItem.setValue({ notificationsOff: ['events'] } as never);
    await maybeRefreshEvents({ fetch: async () => [iae], now: () => NOW });
    expect(await notificationsItem.getValue()).toEqual([]);
  });
});

describe('maybeRefreshEvents after a failure', () => {
  beforeEach(() => fakeBrowser.reset());

  it('tries again after an hour, also without stored events', async () => {
    const fetch = vi.fn(async (): Promise<StarCitizenEvent[]> => {
      throw new Error('HTTP 404');
    });
    await maybeRefreshEvents({ fetch, now: () => NOW });
    await maybeRefreshEvents({ fetch, now: () => NOW + 30_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await maybeRefreshEvents({ fetch, now: () => NOW + HOUR });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('maybeRefreshEvents with events of an earlier format', () => {
  beforeEach(() => fakeBrowser.reset());

  it('reads them again at once', async () => {
    await maybeRefreshEvents({ fetch: async () => [iae], now: () => NOW });
    await eventsItem.setValue({ version: 1, events: [] });
    const fetch = vi.fn(async () => [iae]);
    await maybeRefreshEvents({ fetch, now: () => NOW + 60_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await eventsItem.getValue())?.version).toBe(4);
  });
});

describe('event notifications', () => {
  beforeEach(() => fakeBrowser.reset());

  it('follow the language shown, with name and date', async () => {
    await maybeRefreshEvents({ fetch: async () => [iae], now: () => NOW });
    const [note] = await notificationsItem.getValue();
    const de = noteText(note!, 'de');
    expect(de).toContain('IAE 2956 (de) beginnt am');
    expect(de).toContain('13.11.2026');
    expect(noteText(note!, 'en')).toContain('IAE 2956 starts on');
  });

  it('give an open one added with only its text a message', async () => {
    await notificationsItem.setValue([
      { id: 'events:iae-2956', kind: 'events', text: 'Event: IAE 2956 starts on …', at: NOW },
    ]);
    await maybeRefreshEvents({ fetch: async () => [iae], now: () => NOW });
    const [note] = await notificationsItem.getValue();
    expect(noteText(note!, 'de')).toContain('beginnt am');
  });
});

describe('event notifications in step with the events', () => {
  beforeEach(() => fakeBrowser.reset());

  const read = (events: StarCitizenEvent[], at: number) =>
    maybeRefreshEvents({ force: true, fetch: async () => events, now: () => at });
  const openNotes = async () =>
    (await notificationsItem.getValue()).filter((note) => note.doneAt === undefined);

  it('take a date moved in the file', async () => {
    await read([iae], NOW);
    const moved = { ...iae, eventStart: Date.parse('2026-11-14T16:00:00Z') };
    await read([moved], NOW + HOUR);
    const [note] = await openNotes();
    expect(noteText(note!, 'de')).toContain('14.11.2026');
  });

  it('say the event runs once it started', async () => {
    await read([iae], NOW);
    await read([iae], Date.parse('2026-11-14T00:00:00Z'));
    const [note] = await openNotes();
    expect(noteText(note!, 'en')).toContain('is running until');
  });

  it('are checked off once the event is over or gone from the file', async () => {
    await read([iae], NOW);
    await read([iae], Date.parse('2026-11-28T00:00:00Z'));
    expect(await openNotes()).toEqual([]);

    await fakeBrowser.reset();
    await read([iae], NOW);
    await read([], NOW + HOUR);
    expect(await openNotes()).toEqual([]);
  });

  it('stay while the events are unknown', async () => {
    await notificationsItem.setValue([
      { id: 'events:iae-2956', kind: 'events', text: 'Event: IAE 2956', at: NOW },
    ]);
    await maybeRefreshEvents({
      fetch: async () => {
        throw new Error('offline');
      },
      now: () => NOW,
    });
    expect(await openNotes()).toHaveLength(1);
  });
});
