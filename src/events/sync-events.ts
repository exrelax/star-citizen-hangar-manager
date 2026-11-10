import { EVENTS } from '@/config';
import { hashOf, recordCheck, recordSync, type StorageMeta } from '@/storage/meta';
import { noteShownEvents } from './event-notes';
import { parseEvents, type StarCitizenEvent } from './events';
import { eventsItem, eventsMeta, EVENTS_VERSION } from './events-storage';

/*
 * Keeps the stored events of the project website (#69) current: read at most once a day
 * (`EVENTS.refreshMs`), after a failure again after an hour. A file that can't be read or isn't
 * of the known format keeps the stored events. Each run also tells the events whose display
 * period started (`event-notes.ts`).
 */

/**
 * The events of the website's file, checked; throws if it can't be read. The development build
 * reads the file of the working copy instead (`site/public/data/events.json`), so events can be
 * tried before they go live – without a request to localhost, which Chrome would ask the user to
 * allow from RSI's page. "Stored data" in the settings reads it again at once.
 */
export async function fetchEvents(): Promise<StarCitizenEvent[] | undefined> {
  if (import.meta.env.DEV) {
    const local = await import('../../site/public/data/events.json');
    return parseEvents(local.default);
  }
  // No cookies: the website needs none, and it is another origin.
  const response = await fetch(EVENTS.url, { credentials: 'omit', cache: 'no-cache' });
  if (!response.ok) throw new Error(`Loading the events failed: HTTP ${response.status}`);
  return parseEvents(await response.json());
}

/** Whether the events are due to be read again. */
export function eventsDue(meta: StorageMeta, now: number): boolean {
  const wait = meta.lastOutcome?.status === 'failed' ? EVENTS.retryMs : EVENTS.refreshMs;
  return now - meta.checkedAt >= wait;
}

let running: Promise<void> | undefined;

/** Reads the events if due (`force`: in any case), then tells the newly shown ones. */
export function maybeRefreshEvents({
  force = false,
  fetch = fetchEvents,
  now = Date.now,
}: {
  force?: boolean;
  fetch?: () => Promise<StarCitizenEvent[] | undefined>;
  now?: () => number;
} = {}): Promise<void> {
  running ??= (async () => {
    const [stored, meta] = await Promise.all([eventsItem.getValue(), eventsMeta.getValue()]);
    const current = stored?.version === EVENTS_VERSION ? stored : null;
    let events = current?.events ?? [];
    // Without stored events too only when due: a missing file is tried again after an hour, not on
    // every check. Deleting them in the settings deletes their metadata, so they are read again.
    if (force || eventsDue(meta, now())) {
      events = (await readEvents(fetch, now, meta)) ?? events;
    }
    await noteShownEvents(events, now());
  })().finally(() => (running = undefined));
  return running;
}

/** Reads and stores the events; the events read, or none if they couldn't be. */
async function readEvents(
  fetch: () => Promise<StarCitizenEvent[] | undefined>,
  now: () => number,
  meta: StorageMeta,
): Promise<StarCitizenEvent[] | undefined> {
  try {
    const events = await fetch();
    if (!events) throw new Error('The events file has an unknown format');
    const value = { version: EVENTS_VERSION, events };
    const fingerprint = hashOf(value);
    const unchanged = meta.fingerprint === fingerprint;
    if (!unchanged) await eventsItem.setValue(value);
    await recordSync(eventsMeta, {
      at: now(),
      fingerprint,
      ...(unchanged && { updatedAt: meta.updatedAt }),
    });
    return events;
  } catch (error) {
    console.warn('[star-citizen-hangar-manager] Events unavailable', error);
    await recordCheck(eventsMeta, { status: 'failed' }, { at: now() });
    return undefined;
  }
}
