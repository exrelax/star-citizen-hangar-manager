import { EVENTS } from '@/config';
import { createSiteDataSync, fetchSiteFile, siteDataDue } from '@/site-data/sync-site-data';
import type { StorageMeta } from '@/storage/meta';
import { noteShownEvents } from './event-notes';
import { parseEvents, type StarCitizenEvent } from './events';
import { eventsItem, eventsMeta, EVENTS_VERSION, type EventsSnapshot } from './events-storage';

/*
 * Keeps the stored events of the project website (#69) current, like every data file of the
 * website (`site-data/sync-site-data.ts`): at most once a day, after a failure again after an
 * hour. Each run also tells the events whose display period started (`event-notes.ts`).
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
    return withLocalImages(parseEvents(local.default));
  }
  return parseEvents(await fetchSiteFile(EVENTS.url));
}

/**
 * The development build: the images of the working copy (`site/public/images/events/`), inlined,
 * instead of their URLs on the website, which may not be deployed yet.
 */
async function withLocalImages(
  events: StarCitizenEvent[] | undefined,
): Promise<StarCitizenEvent[] | undefined> {
  if (!events) return undefined;
  const local = import.meta.glob<string>('../../site/public/images/events/*', {
    query: '?inline',
    import: 'default',
  });
  return Promise.all(
    events.map(async (event) => {
      const path = event.image?.slice(EVENTS.imageBase.length);
      const load = path && local[`../../site/public/${path}`];
      return load ? { ...event, image: await load() } : event;
    }),
  );
}

/** Whether the events are due to be read again. */
export const eventsDue = (meta: StorageMeta, now: number): boolean =>
  siteDataDue(meta, now, EVENTS);

const refreshEvents = createSiteDataSync(
  {
    name: 'Events',
    item: eventsItem,
    meta: eventsMeta,
    version: EVENTS_VERSION,
    refreshMs: EVENTS.refreshMs,
    retryMs: EVENTS.retryMs,
    fetch: () => fetchEvents(),
    toSnapshot: (events: StarCitizenEvent[]) => ({ version: EVENTS_VERSION, events }),
    fromSnapshot: (snapshot: EventsSnapshot) => snapshot.events,
  },
  // Without the file's events (never read), open notifications are not checked off.
  ({ data }, now) => noteShownEvents(data ?? [], now, { known: data !== undefined }),
);

/** Reads the events if due (`force`: in any case), then tells the newly shown ones. */
export async function maybeRefreshEvents(
  options: {
    force?: boolean;
    fetch?: () => Promise<StarCitizenEvent[] | undefined>;
    now?: () => number;
  } = {},
): Promise<void> {
  await refreshEvents(options);
}
