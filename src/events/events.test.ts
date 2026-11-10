import { describe, expect, it } from 'vitest';
import { eventState, parseEvents, shownEvents } from './events';

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'iae-2956',
  name: 'Intergalactic Aerospace Expo 2956',
  eventStart: '2026-11-13T16:00:00Z',
  eventEnd: '2026-11-27T20:00:00Z',
  displayStart: '2026-11-06T00:00:00Z',
  displayEnd: '2026-11-27T20:00:00Z',
  ...overrides,
});

const file = (...events: unknown[]) => ({ schemaVersion: 1, events });

describe('parseEvents', () => {
  it('reads the events with their times', () => {
    expect(parseEvents(file(entry({ description: ' Free fly. ' })))).toEqual([
      {
        id: 'iae-2956',
        name: 'Intergalactic Aerospace Expo 2956',
        eventStart: Date.parse('2026-11-13T16:00:00Z'),
        eventEnd: Date.parse('2026-11-27T20:00:00Z'),
        displayStart: Date.parse('2026-11-06T00:00:00Z'),
        displayEnd: Date.parse('2026-11-27T20:00:00Z'),
        description: 'Free fly.',
      },
    ]);
  });

  it('ignores files of another format', () => {
    expect(parseEvents({ schemaVersion: 2, events: [entry()] })).toBeUndefined();
    expect(parseEvents({ schemaVersion: 1 })).toBeUndefined();
    expect(parseEvents('nope')).toBeUndefined();
  });

  it('leaves out entries without what they need, and repeated ids', () => {
    const events = parseEvents(
      file(
        entry(),
        entry(),
        entry({ id: 'no-name', name: '' }),
        entry({ id: 'bad-date', eventStart: 'soon' }),
        entry({ id: 'reversed', eventEnd: '2026-11-01T00:00:00Z' }),
        entry({ id: 'no-display', displayEnd: undefined }),
        'text',
      ),
    );
    expect(events?.map((event) => event.id)).toEqual(['iae-2956']);
  });

  it('takes icons only from the project website', () => {
    const [own, other, broken] = parseEvents(
      file(
        entry({ id: 'a', icon: 'https://exrelax.github.io/star-citizen-hangar-manager/i.svg' }),
        entry({ id: 'b', icon: 'https://example.com/i.svg' }),
        entry({ id: 'c', icon: 'javascript:alert(1)' }),
      ),
    )!;
    expect(own?.icon).toBe('https://exrelax.github.io/star-citizen-hangar-manager/i.svg');
    expect(other?.icon).toBeUndefined();
    expect(broken?.icon).toBeUndefined();
  });
});

describe('shownEvents and eventState', () => {
  const events = parseEvents(
    file(
      entry(),
      entry({
        id: 'later',
        eventStart: '2026-12-11T16:00:00Z',
        eventEnd: '2026-12-23T16:00:00Z',
        displayStart: '2026-12-04T00:00:00Z',
        displayEnd: '2026-12-23T16:00:00Z',
      }),
    ),
  )!;

  it('shows events during their display period only', () => {
    expect(shownEvents(events, Date.parse('2026-11-05T00:00:00Z'))).toEqual([]);
    expect(shownEvents(events, Date.parse('2026-11-10T00:00:00Z')).map((e) => e.id)).toEqual([
      'iae-2956',
    ]);
    expect(shownEvents(events, Date.parse('2026-11-27T20:00:00Z'))).toEqual([]);
  });

  it('tells upcoming from running', () => {
    expect(eventState(events[0]!, Date.parse('2026-11-10T00:00:00Z'))).toBe('upcoming');
    expect(eventState(events[0]!, Date.parse('2026-11-13T16:00:00Z'))).toBe('running');
  });
});
