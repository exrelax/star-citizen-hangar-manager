import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { eventState, shownEvents } from '@/events/events';
import { noteText, openNotifications } from '@/notifications/notifications';
import { demoEventNotes, demoEvents } from './demo-events';
import { checkOffDemo, demoNotificationsItem, seedDemoNotes } from './demo-notes';

const NOW = Date.parse('2026-11-10T12:30:00Z');

beforeEach(() => fakeBrowser.reset());

describe('the events of the demo (#210)', () => {
  const events = demoEvents(NOW);

  it('are shown now: one running with description and image, one upcoming without', () => {
    expect(shownEvents(events, NOW)).toHaveLength(2);
    const running = events.find((event) => eventState(event, NOW) === 'running')!;
    const upcoming = events.find((event) => eventState(event, NOW) === 'upcoming')!;
    expect(running.description && running.image && running.phases?.length).toBeTruthy();
    expect(upcoming.description ?? upcoming.image).toBeUndefined();
  });

  it('have their sidebar notifications, kept apart from the real ones and checked off there', async () => {
    const notes = demoEventNotes(NOW, 'en');
    expect(notes.map((note) => note.kind)).toEqual(['events', 'events']);
    expect(noteText(notes[1]!, 'de')).toContain('Demo Free Fly');
    await seedDemoNotes('key', notes);
    await seedDemoNotes('key', []);
    expect(await demoNotificationsItem.getValue()).toHaveLength(2);
    await checkOffDemo([notes[0]!.id]);
    expect(openNotifications(await demoNotificationsItem.getValue())).toHaveLength(1);
  });
});
