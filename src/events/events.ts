import { EVENTS } from '@/config';

/*
 * Events of Star Citizen (e.g. the Intergalactic Aerospace Expo), loaded from the project website
 * (#69) and shown in the Pledge Store tab while their display period lasts. The file is data only:
 * it is checked here field by field, entries that don't fit are left out silently, and its texts
 * are shown as plain text, never as HTML.
 */

export interface StarCitizenEvent {
  /** Stable id, e.g. "iae-2956": the notification of an event is told once. */
  id: string;
  name: string;
  /** Epoch milliseconds. */
  eventStart: number;
  eventEnd: number;
  /** When the Pledge Store tab shows it, in epoch milliseconds. */
  displayStart: number;
  displayEnd: number;
  description?: string;
  /** Only from the project website (`EVENTS.iconOrigin`). */
  icon?: string;
}

/** Upcoming (shown, not started yet) or running. */
export type EventState = 'upcoming' | 'running';

const MAX_TEXT = 500;

const text = (value: unknown, max = MAX_TEXT): string | undefined =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined;

const time = (value: unknown): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : undefined;
};

/** An icon URL of the project website, else none. */
function iconUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.origin === EVENTS.iconOrigin ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** One entry of the file, if it has everything it needs. */
function parseEvent(entry: unknown): StarCitizenEvent | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const raw = entry as Record<string, unknown>;
  const id = text(raw.id, 100);
  const name = text(raw.name, 200);
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
  const description = text(raw.description);
  const icon = iconUrl(raw.icon);
  return {
    id,
    name,
    eventStart,
    eventEnd,
    displayStart,
    displayEnd,
    ...(description && { description }),
    ...(icon && { icon }),
  };
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

/** Whether a shown event has started. */
export const eventState = (event: StarCitizenEvent, now: number): EventState =>
  now < event.eventStart ? 'upcoming' : 'running';
