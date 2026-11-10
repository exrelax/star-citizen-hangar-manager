import { defineMeta } from '@/storage/meta';
import type { StarCitizenEvent } from './events';

/** Format version of the stored events; others are ignored and read again. 2: texts per language, `image`. */
export const EVENTS_VERSION = 2;

export interface EventsSnapshot {
  version: number;
  events: StarCitizenEvent[];
}

/** The events of the project website (#69), as last read. */
export const eventsItem = storage.defineItem<EventsSnapshot | null>('local:events', {
  fallback: null,
});

/** Last read, check and fingerprint of the events (see `storage/meta.ts`). */
export const eventsMeta = defineMeta('local:events');
