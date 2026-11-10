import { describe, expect, it } from 'vitest';
import { eventProgress, eventState, localized, parseEvents, shownEvents } from './events';

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
        name: { en: 'Intergalactic Aerospace Expo 2956' },
        eventStart: Date.parse('2026-11-13T16:00:00Z'),
        eventEnd: Date.parse('2026-11-27T20:00:00Z'),
        displayStart: Date.parse('2026-11-06T00:00:00Z'),
        displayEnd: Date.parse('2026-11-27T20:00:00Z'),
        description: { en: 'Free fly.' },
      },
    ]);
  });

  it('reads texts per language, with English required', () => {
    const [event] = parseEvents(
      file(
        entry({
          name: { en: 'Expo', de: 'Messe', xx: 'unknown' },
          description: { de: 'Nur Deutsch' },
        }),
      ),
    )!;
    expect(event?.name).toEqual({ en: 'Expo', de: 'Messe' });
    expect(event?.description).toBeUndefined();
    expect(localized(event!.name, 'de')).toBe('Messe');
    expect(localized(event!.name, 'fr')).toBe('Expo');
    expect(parseEvents(file(entry({ name: { de: 'Messe' } })))).toEqual([]);
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

  it('takes images only from the project website', () => {
    const [own, other, sibling, broken] = parseEvents(
      file(
        entry({ id: 'a', image: 'https://exrelax.github.io/star-citizen-hangar-manager/i.jpg' }),
        entry({ id: 'b', image: 'https://example.com/i.jpg' }),
        entry({ id: 'c', image: 'https://exrelax.github.io/other-project/i.jpg' }),
        entry({ id: 'd', image: 'javascript:alert(1)' }),
      ),
    )!;
    expect(own?.image).toBe('https://exrelax.github.io/star-citizen-hangar-manager/i.jpg');
    expect(other?.image).toBeUndefined();
    expect(sibling?.image).toBeUndefined();
    expect(broken?.image).toBeUndefined();
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

describe('phases', () => {
  const [event] = parseEvents(
    file(
      entry({
        phases: [
          { start: '2026-11-14T16:00:00Z', name: 'Origin Jumpworks' },
          { start: '2026-11-13T16:00:00Z', name: 'Roberts Space Industries', shortName: 'RSI' },
          { start: '2026-11-23T16:00:00Z', name: { en: 'Finale', es: 'Final' } },
          { start: '2026-12-01T16:00:00Z', name: 'After the end' },
          { start: 'soon', name: 'No time' },
        ],
      }),
    ),
  )!;

  it('reads the phases within the event, by their start', () => {
    expect(event?.phases?.map((phase) => phase.name.en)).toEqual([
      'Roberts Space Industries',
      'Origin Jumpworks',
      'Finale',
    ]);
  });

  it('keeps a short name if given', () => {
    expect(event?.phases?.[0]?.shortName).toEqual({ en: 'RSI' });
    expect(event?.phases?.[1]?.shortName).toBeUndefined();
  });

  it('tells the current and the next phase', () => {
    const at = (iso: string) => eventProgress(event!, Date.parse(iso));
    expect(at('2026-11-10T00:00:00Z').current).toBeUndefined();
    expect(at('2026-11-10T00:00:00Z').next?.name.en).toBe('Roberts Space Industries');
    expect(at('2026-11-14T15:59:59Z').current?.name.en).toBe('Roberts Space Industries');
    expect(at('2026-11-14T16:00:00Z').current?.name.en).toBe('Origin Jumpworks');
    expect(at('2026-11-14T16:00:00Z').next?.name.en).toBe('Finale');
    expect(at('2026-11-25T00:00:00Z').next).toBeUndefined();
  });
});
