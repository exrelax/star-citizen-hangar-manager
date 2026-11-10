import { EVENTS } from '@/config';
import { localizedText, text, time, type LocalizedText } from '@/site-data/site-data';

export { localized, type LocalizedText } from '@/site-data/site-data';

/*
 * Events of Star Citizen (e.g. the Intergalactic Aerospace Expo), loaded from the project website
 * (#69) and shown in the Pledge Store tab while their display period lasts. The file is data only:
 * it is checked here field by field, entries that don't fit are left out silently, and its texts
 * are shown as plain text, never as HTML.
 *
 * Name and description are either one text or one per language of the extension, e.g.
 * `{ "en": "…", "de": "…" }`; English is required and stands in for a language not given.
 */

export interface StarCitizenEvent {
  /** Stable id, e.g. "iae-2956": the notification of an event is told once. */
  id: string;
  name: LocalizedText;
  /** Epoch milliseconds. */
  eventStart: number;
  eventEnd: number;
  /** When the Pledge Store tab shows it, in epoch milliseconds. */
  displayStart: number;
  displayEnd: number;
  description?: LocalizedText;
  /** A 16:9 image, only from the project website (`EVENTS.imageBase`). */
  image?: string;
  /**
   * The parts of a running event by their start, e.g. the manufacturer of each day of the IAE,
   * "Best in Show" and the finale; each lasts until the next one starts or the event ends.
   */
  phases?: EventPhase[];
}

/** A part of an event (see `StarCitizenEvent.phases`). */
export interface EventPhase {
  /** Epoch milliseconds. */
  start: number;
  name: LocalizedText;
  /** Shown in the countdowns, e.g. "RSI" for "Roberts Space Industries"; else the name. */
  shortName?: LocalizedText;
}

/** Upcoming (shown, not started yet) or running. */
export type EventState = 'upcoming' | 'running';

/** An image URL of the project website, else none. */
function imageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.href.startsWith(EVENTS.imageBase) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** One entry of the file, if it has everything it needs. */
function parseEvent(entry: unknown): StarCitizenEvent | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const raw = entry as Record<string, unknown>;
  const id = text(raw.id, 100);
  const name = localizedText(raw.name, 200);
  const eventStart = time(raw.eventStart);
  const eventEnd = time(raw.eventEnd);
  const displayStart = time(raw.displayStart);
  const displayEnd = time(raw.displayEnd);
  if (!id || !name) return undefined;
  if (eventStart === undefined || eventEnd === undefined || eventEnd <= eventStart) {
    return undefined;
  }
  if (displayStart === undefined || displayEnd === undefined || displayEnd <= displayStart) {
    return undefined;
  }
  const description = localizedText(raw.description);
  const phases = parsePhases(raw.phases, eventStart, eventEnd);
  const image = imageUrl(raw.image);
  return {
    id,
    name,
    eventStart,
    eventEnd,
    displayStart,
    displayEnd,
    ...(description && { description }),
    ...(image && { image }),
    ...(phases.length && { phases }),
  };
}

/** The phases within the event, by their start; others are left out. */
function parsePhases(value: unknown, eventStart: number, eventEnd: number): EventPhase[] {
  if (!Array.isArray(value)) return [];
  const starts = new Set<number>();
  return value
    .flatMap((entry): EventPhase[] => {
      if (!entry || typeof entry !== 'object') return [];
      const raw = entry as Record<string, unknown>;
      const start = time(raw.start);
      const name = localizedText(raw.name, 200);
      const shortName = localizedText(raw.shortName, 60);
      if (start === undefined || !name || start < eventStart || start >= eventEnd) return [];
      if (starts.has(start)) return [];
      starts.add(start);
      return [{ start, name, ...(shortName && { shortName }) }];
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * The events of the website's file; `undefined` if it isn't one of the format the extension
 * reads (another `schemaVersion`, no list), so the stored ones are kept.
 */
export function parseEvents(json: unknown): StarCitizenEvent[] | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const file = json as { schemaVersion?: unknown; events?: unknown };
  if (file.schemaVersion !== EVENTS.schemaVersion || !Array.isArray(file.events)) return undefined;
  const seen = new Set<string>();
  return file.events.flatMap((entry) => {
    const event = parseEvent(entry);
    if (!event || seen.has(event.id)) return [];
    seen.add(event.id);
    return [event];
  });
}

/** The events to show at `now`, by their start. */
export const shownEvents = (events: readonly StarCitizenEvent[], now: number) =>
  events
    .filter((event) => event.displayStart <= now && now < event.displayEnd)
    .sort((a, b) => a.eventStart - b.eventStart);

/** Where a running event stands: its current phase, the next one (if any), and its end. */
export interface EventProgress {
  current?: EventPhase;
  next?: EventPhase;
}

/** The current and the next phase of an event at `now`. */
export function eventProgress(event: StarCitizenEvent, now: number): EventProgress {
  const phases = event.phases ?? [];
  const index = phases.findIndex((phase) => phase.start > now);
  const current = index === -1 ? phases.at(-1) : phases[index - 1];
  const next = index === -1 ? undefined : phases[index];
  return { ...(current && { current }), ...(next && { next }) };
}

/** Whether a shown event has started. */
export const eventState = (event: StarCitizenEvent, now: number): EventState =>
  now < event.eventStart ? 'upcoming' : 'running';
